-- ==============================================================================
-- Migration: 009_verification_resend.sql
-- Description: Verification token reissue and cooldown for pending registrations
-- Database: PostgreSQL 19
-- Security Context: auth_internal helper restricted to ipr_definer; gateway callable by ipr_app.
-- ==============================================================================

-- 1. Extend pending_registrations table with cooldown tracking
ALTER TABLE auth_internal.pending_registrations
    ADD COLUMN IF NOT EXISTS last_resend_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    ADD COLUMN IF NOT EXISTS resend_count INTEGER NOT NULL DEFAULT 0;

-- 2. Routine: auth_internal.reissue_pending_verification_token_v1
-- Reissues verification token and resets expiry for an unverified pending student registration.
-- Enforces per-email cooldown and row locking to prevent concurrent races.
-- Returns generic result (reissued BOOLEAN, full_name VARCHAR) without revealing account state.

CREATE OR REPLACE FUNCTION auth_internal.reissue_pending_verification_token_v1(
    p_email VARCHAR(255),
    p_verification_token_hash VARCHAR(128),
    p_verification_expires_at TIMESTAMPTZ,
    p_cooldown_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (
    reissued BOOLEAN,
    full_name VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_email VARCHAR(255);
    v_registration RECORD;
    v_effective_cooldown INTEGER;
BEGIN
    v_email := lower(btrim(p_email));

    -- Validate email domain
    IF v_email !~ '^[^@]+@paruluniversity[.]ac[.]in$' THEN
        RAISE EXCEPTION 'INVALID_STUDENT_EMAIL';
    END IF;

    -- Validate verification token hash format (64-char lowercase hex SHA-256)
    IF p_verification_token_hash !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'INVALID_VERIFICATION_TOKEN_HASH';
    END IF;

    -- Validate expiry: must be future and <= 24 hours
    IF p_verification_expires_at <= clock_timestamp()
       OR p_verification_expires_at > clock_timestamp() + INTERVAL '24 hours' THEN
        RAISE EXCEPTION 'INVALID_VERIFICATION_EXPIRY';
    END IF;

    v_effective_cooldown := GREATEST(COALESCE(p_cooldown_seconds, 60), 0);

    -- 1. If email is already active/verified in portal_users, return generic negative result
    IF EXISTS (
        SELECT 1
        FROM public.portal_users
        WHERE lower(email) = v_email
    ) THEN
        RETURN QUERY SELECT FALSE AS reissued, NULL::VARCHAR(255) AS full_name;
        RETURN;
    END IF;

    -- 2. Lock pending registration row for atomic evaluation and update
    SELECT id, pending_registrations.full_name, last_resend_at
    INTO v_registration
    FROM auth_internal.pending_registrations
    WHERE lower(email) = v_email
    FOR UPDATE;

    -- If no pending registration exists, return generic negative result
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE AS reissued, NULL::VARCHAR(255) AS full_name;
        RETURN;
    END IF;

    -- 3. Check database-backed per-email cooldown: silently suppress reissuance if cooldown active
    IF v_registration.last_resend_at IS NOT NULL
       AND clock_timestamp() < v_registration.last_resend_at + (v_effective_cooldown * INTERVAL '1 second') THEN
        RETURN QUERY SELECT FALSE AS reissued, NULL::VARCHAR(255) AS full_name;
        RETURN;
    END IF;

    -- 4. Rotate token hash, refresh expiry, and record resend timestamp atomically
    UPDATE auth_internal.pending_registrations
    SET
        verification_token_hash = p_verification_token_hash,
        verification_expires_at = p_verification_expires_at,
        last_resend_at = clock_timestamp(),
        resend_count = pending_registrations.resend_count + 1
    WHERE id = v_registration.id;

    RETURN QUERY SELECT TRUE AS reissued, v_registration.full_name;
END;
$$;

-- Secure gateway ownership and permissions
ALTER FUNCTION auth_internal.reissue_pending_verification_token_v1(VARCHAR, VARCHAR, TIMESTAMPTZ, INTEGER) OWNER TO ipr_definer;

REVOKE ALL ON FUNCTION auth_internal.reissue_pending_verification_token_v1(VARCHAR, VARCHAR, TIMESTAMPTZ, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION auth_internal.reissue_pending_verification_token_v1(VARCHAR, VARCHAR, TIMESTAMPTZ, INTEGER) TO ipr_app;
