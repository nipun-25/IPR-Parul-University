-- ==============================================================================
-- Migration: 004_auth_internal_routines.sql
-- Description: Internal authentication & cryptographic validation routines
-- Database: PostgreSQL 14+
-- Gate: B1 SQL Migration Authoring (Security & Integrity Corrections)
-- ==============================================================================

-- 1. Truly Constant-Time Hexadecimal Comparison Routine (Requirement 10)
-- Does NOT return early on length mismatch; loops through max_len accumulating all differences
CREATE OR REPLACE FUNCTION auth_internal.secure_compare_hex_v2(
    a TEXT,
    b TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    len_a CONSTANT INTEGER := length(a);
    len_b CONSTANT INTEGER := length(b);
    max_len CONSTANT INTEGER := CASE WHEN len_a > len_b THEN len_a ELSE len_b END;
    diff INTEGER := len_a # len_b; -- Bitwise difference non-zero if lengths differ
    i INTEGER;
    char_a INTEGER;
    char_b INTEGER;
BEGIN
    FOR i IN 1..max_len LOOP
        char_a := CASE WHEN i <= len_a THEN ascii(substr(a, i, 1)) ELSE 0 END;
        char_b := CASE WHEN i <= len_b THEN ascii(substr(b, i, 1)) ELSE 0 END;
        diff := diff | (char_a # char_b);
    END LOOP;

    RETURN diff = 0;
END;
$$;

ALTER FUNCTION auth_internal.secure_compare_hex_v2(TEXT, TEXT) OWNER TO ipr_definer;
COMMENT ON FUNCTION auth_internal.secure_compare_hex_v2(TEXT, TEXT) IS 'Truly constant-time string comparison without early-exit length leaks';

-- 2. Authoritative Database-Verified Actor Role Context
CREATE OR REPLACE FUNCTION auth_internal.verify_actor_role_context(
    p_actor_id UUID,
    p_required_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_status VARCHAR(50);
    v_roles TEXT[];
BEGIN
    IF p_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Actor ID must not be null'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT status, roles
    INTO v_status, v_roles
    FROM public.portal_users
    WHERE id = p_actor_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Actor "%" not found in portal users', p_actor_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor account "%" is in "%" status (expected ACTIVE)', p_actor_id, v_status
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NOT (p_required_role = ANY(v_roles)) THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor "%" does not possess authoritative role "%"', p_actor_id, p_required_role
            USING ERRCODE = 'insufficient_privilege';
    END IF;
END;
$$;

ALTER FUNCTION auth_internal.verify_actor_role_context(UUID, TEXT) OWNER TO ipr_definer;

-- 3. Authoritative Multi-Role Any-Of Verification Routine
CREATE OR REPLACE FUNCTION auth_internal.verify_actor_any_role_context(
    p_actor_id UUID,
    p_allowed_roles TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_status VARCHAR(50);
    v_roles TEXT[];
    matched BOOLEAN := FALSE;
    req_role TEXT;
BEGIN
    IF p_actor_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Actor ID must not be null'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT status, roles
    INTO v_status, v_roles
    FROM public.portal_users
    WHERE id = p_actor_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Actor "%" not found in portal users', p_actor_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor account "%" is in "%" status (expected ACTIVE)', p_actor_id, v_status
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_roles IS NOT NULL AND p_allowed_roles IS NOT NULL THEN
        FOREACH req_role IN ARRAY p_allowed_roles LOOP
            IF req_role = ANY(v_roles) THEN
                matched := TRUE;
                EXIT;
            END IF;
        END LOOP;
    END IF;

    IF NOT matched THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor "%" does not possess any of the permitted roles', p_actor_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;
END;
$$;

ALTER FUNCTION auth_internal.verify_actor_any_role_context(UUID, TEXT[]) OWNER TO ipr_definer;

-- 4. Durable Replay Protection Nonce Consumption Routine
CREATE OR REPLACE FUNCTION auth_internal.consume_assertion_nonce(
    p_nonce VARCHAR,
    p_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
BEGIN
    IF p_nonce IS NULL OR btrim(p_nonce) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Nonce cannot be empty'
            USING ERRCODE = 'data_exception';
    END IF;

    IF p_expires_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'EXPIRED_NONCE: Assertion nonce "%" has already expired', p_nonce
            USING ERRCODE = 'data_exception';
    END IF;

    INSERT INTO auth_internal.consumed_assertion_nonces (nonce, consumed_at, expires_at)
    VALUES (p_nonce, clock_timestamp(), p_expires_at)
    ON CONFLICT (nonce) DO NOTHING;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ASSERTION_REPLAY_DETECTED: Nonce "%" was already consumed', p_nonce
            USING ERRCODE = 'unique_violation';
    END IF;
END;
$$;

ALTER FUNCTION auth_internal.consume_assertion_nonce(VARCHAR, TIMESTAMPTZ) OWNER TO ipr_definer;

-- 5. Cryptographic Request Assertion Verification & Nonce Consumption (Requirement 2)
-- Binds HTTP method, canonical path/query, operation scope, actor ID, authoritative roles,
-- timestamp, nonce, and request body hash against BFF HMAC signature.
CREATE OR REPLACE FUNCTION auth_internal.verify_and_consume_request_assertion_v1(
    p_assertion JSONB,
    p_expected_scope TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_method TEXT;
    v_path TEXT;
    v_query TEXT;
    v_scope TEXT;
    v_actor_id UUID;
    v_asserted_roles TEXT[];
    v_timestamp TIMESTAMPTZ;
    v_nonce VARCHAR;
    v_body_hash VARCHAR;
    v_signature VARCHAR;
    v_formatted_ts TEXT;
    v_sorted_roles TEXT;
    v_canonical_string TEXT;
    v_secret_hex VARCHAR;
    v_computed_signature VARCHAR;
    v_user_status VARCHAR(50);
    v_authoritative_roles TEXT[];
BEGIN
    IF p_assertion IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Request assertion is missing'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Extract assertion fields
    v_method := upper(COALESCE(p_assertion->>'method', ''));
    v_path := COALESCE(p_assertion->>'canonical_path', '');
    v_query := COALESCE(p_assertion->>'canonical_query', '');
    v_scope := COALESCE(p_assertion->>'operation_scope', '');
    v_actor_id := (p_assertion->>'actor_id')::UUID;
    v_timestamp := (p_assertion->>'timestamp')::TIMESTAMPTZ;
    v_nonce := COALESCE(p_assertion->>'nonce', '');
    v_body_hash := lower(COALESCE(p_assertion->>'body_hash', ''));
    v_signature := lower(COALESCE(p_assertion->>'signature', ''));

    -- Extract asserted roles array from jsonb
    SELECT array_agg(elem::text)
    INTO v_asserted_roles
    FROM jsonb_array_elements_text(COALESCE(p_assertion->'asserted_roles', '[]'::jsonb)) elem;

    IF v_actor_id IS NULL OR v_scope = '' OR v_nonce = '' OR v_signature = '' THEN
        RAISE EXCEPTION 'BFF_ASSERTION_MALFORMED: Missing mandatory assertion fields'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 1. Bind to exact expected operation scope
    IF v_scope != p_expected_scope THEN
        RAISE EXCEPTION 'BFF_SCOPE_AUTHORIZATION_DENIED: Assertion scope "%" does not match required gateway scope "%"',
            v_scope, p_expected_scope
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 2. Verify clock skew window (300 seconds maximum skew)
    IF ABS(EXTRACT(EPOCH FROM (clock_timestamp() - v_timestamp))) > 300 THEN
        RAISE EXCEPTION 'BFF_ASSERTION_TIMESTAMP_EXPIRED: Assertion timestamp is outside validity window'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Format UTC ISO-8601 timestamp YYYY-MM-DDTHH:MI:SSZ
    v_formatted_ts := to_char(v_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

    -- Deduplicate and sort asserted roles lexicographically
    SELECT COALESCE(string_agg(r, ',' ORDER BY r), '')
    INTO v_sorted_roles
    FROM (SELECT DISTINCT unnest(v_asserted_roles) AS r) sub;

    IF v_sorted_roles = '' THEN
        RAISE EXCEPTION 'BFF_ASSERTION_EMPTY_ROLES: Assertion must supply at least one role'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 3. Construct 9-element canonical assertion string
    v_canonical_string := v_method || E'\n' ||
                          v_path || E'\n' ||
                          v_query || E'\n' ||
                          v_scope || E'\n' ||
                          v_actor_id::text || E'\n' ||
                          v_sorted_roles || E'\n' ||
                          v_formatted_ts || E'\n' ||
                          v_nonce || E'\n' ||
                          v_body_hash;

    -- 4. Retrieve BFF shared secret from locked-down table
    SELECT secret_key_hex INTO v_secret_hex
    FROM auth_internal.system_secrets
    WHERE key_name = 'bff_assertion_key';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CONFIGURATION_ERROR: BFF assertion secret key not configured'
            USING ERRCODE = 'config_file_error';
    END IF;

    -- 5. Compute HMAC-SHA256 signature
    v_computed_signature := encode(public.hmac(v_canonical_string::bytea, decode(v_secret_hex, 'hex'), 'sha256'), 'hex');

    -- 6. Verify signature in constant time
    IF NOT auth_internal.secure_compare_hex_v2(v_computed_signature, v_signature) THEN
        RAISE EXCEPTION 'BFF_SIGNATURE_INVALID: Cryptographic request signature verification failed'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 7. Durable single-use nonce consumption
    PERFORM auth_internal.consume_assertion_nonce(v_nonce, v_timestamp + INTERVAL '300 second');

    -- 8. Verify actor account existence, ACTIVE status, and authoritative roles in portal_users
    SELECT status, roles
    INTO v_user_status, v_authoritative_roles
    FROM public.portal_users
    WHERE id = v_actor_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Actor "%" not found in portal accounts', v_actor_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_user_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor account "%" is in "%" status', v_actor_id, v_user_status
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Ensure every claimed asserted role exists in authoritative roles
    IF NOT (v_asserted_roles <@ v_authoritative_roles) THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor does not possess claimed authoritative roles'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN v_actor_id;
END;
$$;

ALTER FUNCTION auth_internal.verify_and_consume_request_assertion_v1(JSONB, TEXT) OWNER TO ipr_definer;
COMMENT ON FUNCTION auth_internal.verify_and_consume_request_assertion_v1(JSONB, TEXT) IS 'Cryptographic HMAC assertion verification and atomic nonce consumption';
