-- ==============================================================================
-- Migration: 007_authentication.sql
-- Description: User registration, email verification, credentials and sessions
-- Database: PostgreSQL 19
-- ==============================================================================

-- Temporary permission required to transfer function ownership
GRANT CREATE ON SCHEMA auth_internal TO ipr_definer;

-- Enforce case-insensitive uniqueness for institutional user emails
CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_users_email_lower
    ON public.portal_users (lower(email));

-- 1. User Authentication Credentials
CREATE TABLE IF NOT EXISTS auth_internal.user_credentials (
    user_id UUID PRIMARY KEY
        REFERENCES public.portal_users(id) ON DELETE RESTRICT,

    password_hash TEXT NOT NULL
    CHECK (password_hash LIKE '$argon2id$%'),

    password_changed_at TIMESTAMPTZ NOT NULL
        DEFAULT clock_timestamp(),

    failed_login_attempts INTEGER NOT NULL DEFAULT 0,

    locked_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT chk_user_credentials_failed_attempts
        CHECK (failed_login_attempts >= 0)
);

ALTER TABLE auth_internal.user_credentials OWNER TO ipr_admin;

COMMENT ON TABLE auth_internal.user_credentials IS
'Stores Argon2id password hashes and login security metadata for portal users. Never stores plaintext passwords.';

-- 2. Pending Student Registrations
CREATE TABLE IF NOT EXISTS auth_internal.pending_registrations (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),

    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,

    password_hash TEXT NOT NULL
    CHECK (password_hash LIKE '$argon2id$%'),

    verification_token_hash VARCHAR(128) NOT NULL UNIQUE,

    verification_expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT chk_pending_student_email_domain
        CHECK (
            lower(email) = email
            AND email ~ '^[^@]+@paruluniversity[.]ac[.]in$'
        )
);

ALTER TABLE auth_internal.pending_registrations OWNER TO ipr_admin;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_registrations_email
    ON auth_internal.pending_registrations (lower(email));

CREATE INDEX IF NOT EXISTS idx_pending_registrations_expiry
    ON auth_internal.pending_registrations (verification_expires_at);

COMMENT ON TABLE auth_internal.pending_registrations IS
'Stores unverified student registration requests. Passwords and verification tokens are stored only as hashes.';

-- 3. Server-Side Authentication Sessions
CREATE TABLE IF NOT EXISTS auth_internal.user_sessions (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.portal_users(id) ON DELETE RESTRICT,

    session_token_hash VARCHAR(64) NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    expires_at TIMESTAMPTZ NOT NULL,

    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    revoked_at TIMESTAMPTZ,

    CONSTRAINT chk_user_sessions_expiry
        CHECK (expires_at > created_at),

    CONSTRAINT chk_user_sessions_token_hash
        CHECK (session_token_hash ~ '^[a-f0-9]{64}$')
);

ALTER TABLE auth_internal.user_sessions OWNER TO ipr_admin;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
    ON auth_internal.user_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry
    ON auth_internal.user_sessions (expires_at);

COMMENT ON TABLE auth_internal.user_sessions IS
'Stores hashed opaque session tokens. Raw session tokens are never stored in the database.';

-- 4. Create Pending Student Registration Function

GRANT SELECT, INSERT ON public.portal_users TO ipr_definer;

GRANT SELECT, INSERT, UPDATE, DELETE
ON auth_internal.pending_registrations TO ipr_definer;

CREATE OR REPLACE FUNCTION auth_internal.create_pending_registration_v1(
    p_email VARCHAR(255),
    p_full_name VARCHAR(255),
    p_password_hash TEXT,
    p_verification_token_hash VARCHAR(128),
    p_verification_expires_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_registration_id UUID;
    v_email VARCHAR(255);
BEGIN
    v_email := lower(btrim(p_email));

    IF v_email !~ '^[^@]+@paruluniversity[.]ac[.]in$' THEN
        RAISE EXCEPTION 'INVALID_STUDENT_EMAIL';
    END IF;

    IF btrim(p_full_name) = '' THEN
        RAISE EXCEPTION 'INVALID_FULL_NAME';
    END IF;

    IF p_password_hash IS NULL OR p_password_hash = '' THEN
        RAISE EXCEPTION 'INVALID_PASSWORD_HASH';
    END IF;

    IF p_verification_token_hash !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'INVALID_VERIFICATION_TOKEN_HASH';
    END IF;

    IF p_verification_expires_at <= clock_timestamp()
       OR p_verification_expires_at >
          clock_timestamp() + INTERVAL '24 hours' THEN
        RAISE EXCEPTION 'INVALID_VERIFICATION_EXPIRY';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.portal_users
        WHERE lower(email) = v_email
    ) THEN
        RAISE EXCEPTION 'REGISTRATION_NOT_AVAILABLE';
    END IF;

    INSERT INTO auth_internal.pending_registrations (
        email,
        full_name,
        password_hash,
        verification_token_hash,
        verification_expires_at
    )
    VALUES (
        v_email,
        btrim(p_full_name),
        p_password_hash,
        p_verification_token_hash,
        p_verification_expires_at
    )
    RETURNING id INTO v_registration_id;

    RETURN v_registration_id;
END;
$$;

ALTER FUNCTION auth_internal.create_pending_registration_v1(
    VARCHAR, VARCHAR, TEXT, VARCHAR, TIMESTAMPTZ
) OWNER TO ipr_definer;

REVOKE ALL ON FUNCTION auth_internal.create_pending_registration_v1(
    VARCHAR, VARCHAR, TEXT, VARCHAR, TIMESTAMPTZ
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION auth_internal.create_pending_registration_v1(
    VARCHAR, VARCHAR, TEXT, VARCHAR, TIMESTAMPTZ
) TO ipr_app;

-- 5. Verify Student Email and Activate Account

GRANT INSERT ON auth_internal.user_credentials TO ipr_definer;

CREATE OR REPLACE FUNCTION auth_internal.verify_student_registration_v1(
    p_verification_token_hash VARCHAR(128)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_registration auth_internal.pending_registrations%ROWTYPE;
    v_user_id UUID;
BEGIN
    IF p_verification_token_hash !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'INVALID_VERIFICATION_TOKEN';
    END IF;

    SELECT *
    INTO v_registration
    FROM auth_internal.pending_registrations
    WHERE verification_token_hash = p_verification_token_hash
      AND verification_expires_at > clock_timestamp()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_OR_EXPIRED_VERIFICATION_TOKEN';
    END IF;

    INSERT INTO public.portal_users (
        email,
        full_name,
        roles,
        status
    )
    VALUES (
        v_registration.email,
        v_registration.full_name,
        ARRAY['Student']::TEXT[],
        'ACTIVE'
    )
    RETURNING id INTO v_user_id;

    INSERT INTO auth_internal.user_credentials (
        user_id,
        password_hash
    )
    VALUES (
        v_user_id,
        v_registration.password_hash
    );

    DELETE FROM auth_internal.pending_registrations
    WHERE id = v_registration.id;

    RETURN v_user_id;
END;
$$;

ALTER FUNCTION auth_internal.verify_student_registration_v1(VARCHAR)
    OWNER TO ipr_definer;

REVOKE ALL ON FUNCTION auth_internal.verify_student_registration_v1(VARCHAR)
    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION auth_internal.verify_student_registration_v1(VARCHAR)
    TO ipr_app;

-- 6. Retrieve Authentication Details for Login

GRANT SELECT, UPDATE
ON auth_internal.user_credentials TO ipr_definer;

CREATE OR REPLACE FUNCTION auth_internal.get_login_credentials_v1(
    p_email VARCHAR(255)
)
RETURNS TABLE (
    user_id UUID,
    email VARCHAR(255),
    full_name VARCHAR(255),
    roles TEXT[],
    account_status VARCHAR(50),
    password_hash TEXT,
    failed_login_attempts INTEGER,
    locked_until TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
    SELECT
        u.id,
        u.email,
        u.full_name,
        u.roles,
        u.status,
        c.password_hash,
        c.failed_login_attempts,
        c.locked_until
    FROM public.portal_users u
    JOIN auth_internal.user_credentials c
        ON c.user_id = u.id
    WHERE lower(u.email) = lower(btrim(p_email))
    LIMIT 1;
$$;

ALTER FUNCTION auth_internal.get_login_credentials_v1(VARCHAR)
    OWNER TO ipr_definer;

REVOKE ALL ON FUNCTION auth_internal.get_login_credentials_v1(VARCHAR)
    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION auth_internal.get_login_credentials_v1(VARCHAR)
    TO ipr_app;

-- 7. Record Login Attempt Results

CREATE OR REPLACE FUNCTION auth_internal.record_login_attempt_v1(
    p_user_id UUID,
    p_success BOOLEAN
)
RETURNS TABLE (
    failed_attempts INTEGER,
    account_locked_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
BEGIN
    IF p_success THEN
        RETURN QUERY
        UPDATE auth_internal.user_credentials c
        SET
            failed_login_attempts = 0,
            locked_until = NULL
        WHERE c.user_id = p_user_id
        RETURNING c.failed_login_attempts, c.locked_until;
        ELSE
        RETURN QUERY
        UPDATE auth_internal.user_credentials c
        SET
            failed_login_attempts = c.failed_login_attempts + 1,
            locked_until = CASE
                WHEN c.failed_login_attempts + 1 >= 5
                     AND (
                         c.locked_until IS NULL
                         OR c.locked_until <= clock_timestamp()
                     )
                THEN clock_timestamp() + INTERVAL '15 minutes'
                ELSE c.locked_until
            END
        WHERE c.user_id = p_user_id
        RETURNING c.failed_login_attempts, c.locked_until;
    END IF;
END;
$$;

ALTER FUNCTION auth_internal.record_login_attempt_v1(UUID, BOOLEAN)
    OWNER TO ipr_definer;

REVOKE ALL ON FUNCTION auth_internal.record_login_attempt_v1(UUID, BOOLEAN)
    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION auth_internal.record_login_attempt_v1(UUID, BOOLEAN)
    TO ipr_app;

-- 8. Create Authenticated User Session

GRANT SELECT, INSERT, UPDATE
ON auth_internal.user_sessions TO ipr_definer;

CREATE OR REPLACE FUNCTION auth_internal.create_user_session_v1(
    p_user_id UUID,
    p_session_token_hash VARCHAR(64),
    p_expires_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_session_id UUID;
BEGIN
    IF p_session_token_hash !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'INVALID_SESSION_TOKEN_HASH';
    END IF;

    IF p_expires_at <= clock_timestamp()
       OR p_expires_at > clock_timestamp() + INTERVAL '30 days' THEN
        RAISE EXCEPTION 'INVALID_SESSION_EXPIRY';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.portal_users
        WHERE id = p_user_id
          AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE';
    END IF;

    INSERT INTO auth_internal.user_sessions (
        user_id,
        session_token_hash,
        expires_at
    )
    VALUES (
        p_user_id,
        p_session_token_hash,
        p_expires_at
    )
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
END;
$$;

ALTER FUNCTION auth_internal.create_user_session_v1(
    UUID, VARCHAR, TIMESTAMPTZ
) OWNER TO ipr_definer;

REVOKE ALL ON FUNCTION auth_internal.create_user_session_v1(
    UUID, VARCHAR, TIMESTAMPTZ
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION auth_internal.create_user_session_v1(
    UUID, VARCHAR, TIMESTAMPTZ
) TO ipr_app;

-- 9. Validate Authenticated User Session

CREATE OR REPLACE FUNCTION auth_internal.validate_user_session_v1(
    p_session_token_hash VARCHAR(64)
)
RETURNS TABLE (
    session_id UUID,
    user_id UUID,
    email VARCHAR(255),
    full_name VARCHAR(255),
    roles TEXT[],
    expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
    UPDATE auth_internal.user_sessions s
    SET last_seen_at = clock_timestamp()
    FROM public.portal_users u
    WHERE s.user_id = u.id
      AND s.session_token_hash = p_session_token_hash
      AND s.revoked_at IS NULL
      AND s.expires_at > clock_timestamp()
      AND u.status = 'ACTIVE'
    RETURNING
        s.id,
        u.id,
        u.email,
        u.full_name,
        u.roles,
        s.expires_at;
$$;

ALTER FUNCTION auth_internal.validate_user_session_v1(VARCHAR)
    OWNER TO ipr_definer;

REVOKE ALL ON FUNCTION auth_internal.validate_user_session_v1(VARCHAR)
    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION auth_internal.validate_user_session_v1(VARCHAR)
    TO ipr_app;

-- 10. Revoke Authenticated User Session (Logout)

CREATE OR REPLACE FUNCTION auth_internal.revoke_user_session_v1(
    p_session_token_hash VARCHAR(64)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_revoked BOOLEAN;
BEGIN
    IF p_session_token_hash !~ '^[a-f0-9]{64}$' THEN
        RETURN FALSE;
    END IF;

    UPDATE auth_internal.user_sessions
    SET revoked_at = clock_timestamp()
    WHERE session_token_hash = p_session_token_hash
      AND revoked_at IS NULL
    RETURNING TRUE INTO v_revoked;

    RETURN COALESCE(v_revoked, FALSE);
END;
$$;

ALTER FUNCTION auth_internal.revoke_user_session_v1(VARCHAR)
    OWNER TO ipr_definer;

REVOKE ALL ON FUNCTION auth_internal.revoke_user_session_v1(VARCHAR)
    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION auth_internal.revoke_user_session_v1(VARCHAR)
    TO ipr_app;

-- 11. Allow Backend Runtime to Resolve Controlled Authentication Functions
-- This grants schema access only, NOT direct access to internal tables.

GRANT USAGE ON SCHEMA auth_internal TO ipr_app;

-- Remove temporary function-creation permission
REVOKE CREATE ON SCHEMA auth_internal FROM ipr_definer;