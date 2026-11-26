-- ==============================================================================
-- Migration: 005_institutional_gateways.sql
-- Description: Security Definer Institutional Business Mutation & Read Gateways
-- Database: PostgreSQL 14+
-- Gate: B1 SQL Migration Authoring (Security & Integrity Corrections)
-- ==============================================================================

-- ==============================================================================
-- 1. Initial Disclosure Submission Gateway (B-2, P215-01, P215-02)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.submit_initial_disclosure_v3(
    p_assertion JSONB,
    p_disclosure_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_disclosure RECORD;
    v_total_basis_points INTEGER;
    v_unverified_count INTEGER;
    v_unclean_attachments INTEGER;
    v_spec_attachment_count INTEGER;
    v_period_key VARCHAR(6);
    v_allocated_seq INTEGER;
    v_tracking_number VARCHAR(64);
    v_suffix VARCHAR(3);
    v_actor_roles TEXT[];
    v_bytes BYTEA;
    v_charset CONSTANT TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    v_byte_val INTEGER;
BEGIN
    -- 1. Cryptographically verify request assertion and consume nonce
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_SUBMIT_DISCLOSURE');

    -- Authoritative role verification: only Student or Faculty inventors submit disclosures
    PERFORM auth_internal.verify_actor_any_role_context(v_actor_id, ARRAY['Student', 'Faculty']);

    SELECT roles INTO v_actor_roles
    FROM public.portal_users
    WHERE id = v_actor_id;

    -- 2. Fetch and Validate Disclosure State
    SELECT * INTO v_disclosure
    FROM public.disclosures
    WHERE id = p_disclosure_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Disclosure "%" does not exist', p_disclosure_id;
    END IF;

    IF v_disclosure.status != 'DRAFT' THEN
        RAISE EXCEPTION 'INVALID_STATE: Disclosure is in status "%", expected "DRAFT"', v_disclosure.status;
    END IF;

    -- Least Privilege: Actor must strictly be the primary inventor
    IF v_disclosure.primary_inventor_id != v_actor_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Only the primary inventor may submit this disclosure'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 3. Validate Inventor Consents and 10,000 Basis Points Distribution
    SELECT COALESCE(SUM(share_basis_points), 0),
           COUNT(*) FILTER (WHERE status != 'VERIFIED')
    INTO v_total_basis_points, v_unverified_count
    FROM public.inventor_consents
    WHERE disclosure_id = p_disclosure_id
      AND status IN ('PENDING', 'VERIFIED');

    IF v_total_basis_points != 10000 THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: Total inventor share must equal exactly 10,000 basis points (100%%), found %', v_total_basis_points;
    END IF;

    IF v_unverified_count > 0 THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: All inventor consents must be institutional VERIFIED before submission (% unverified)', v_unverified_count;
    END IF;

    -- 4. Validate Attachments and Antivirus Scan Cleanliness (Requirement 8)
    -- Must have at least one specification attachment; consent evidence attachments do NOT satisfy this requirement
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE a.scan_status != 'CLEAN')
    INTO v_spec_attachment_count, v_unclean_attachments
    FROM public.attachments a
    WHERE a.disclosure_id = p_disclosure_id
      AND NOT EXISTS (
          SELECT 1 FROM public.inventor_consents ic
          WHERE ic.signature_evidence_id = a.id
      );

    IF v_spec_attachment_count = 0 THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: At least one specification attachment is required for disclosure submission; consent evidence does not satisfy this requirement';
    END IF;

    -- Ensure ALL attachments belonging to this disclosure (specification and evidence) are clean
    IF EXISTS (
        SELECT 1 FROM public.attachments
        WHERE disclosure_id = p_disclosure_id AND scan_status != 'CLEAN'
    ) THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Cannot submit disclosure with pending, infected, or unscanned attachments';
    END IF;

    -- 5. Atomic Transactional Monthly Counter Allocation (B-2)
    -- Generate tracking period key strictly in UTC
    v_period_key := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMM');

    -- Ensure monthly counter row exists
    INSERT INTO public.tracking_number_counters (period_key, current_seq, updated_at)
    VALUES (v_period_key, 0, clock_timestamp())
    ON CONFLICT (period_key) DO NOTHING;

    -- Lock and increment atomically
    UPDATE public.tracking_number_counters
    SET current_seq = current_seq + 1,
        updated_at = clock_timestamp()
    WHERE period_key = v_period_key
    RETURNING current_seq INTO v_allocated_seq;

    -- Cryptographically secure 3-character uppercase alphanumeric suffix [0-9A-Z] using gen_random_bytes (Requirement 7)
    v_bytes := public.gen_random_bytes(16);
    v_suffix := '';
    FOR i IN 0..15 LOOP
        v_byte_val := get_byte(v_bytes, i);
        -- Rejection sampling (252 = 7 * 36) to guarantee uniform distribution without modulo bias
        IF v_byte_val < 252 THEN
            v_suffix := v_suffix || substr(v_charset, (v_byte_val % 36) + 1, 1);
            IF length(v_suffix) = 3 THEN
                EXIT;
            END IF;
        END IF;
    END LOOP;

    -- Safeguard for the astronomically improbable case that < 3 bytes were below 252
    IF length(v_suffix) < 3 THEN
        v_bytes := public.gen_random_bytes(6);
        FOR i IN 0..5 LOOP
            v_byte_val := get_byte(v_bytes, i);
            v_suffix := v_suffix || substr(v_charset, (v_byte_val % 36) + 1, 1);
            IF length(v_suffix) = 3 THEN
                EXIT;
            END IF;
        END LOOP;
    END IF;

    -- Exact canonical format: IPR-YYYYMMNNN-XXX
    v_tracking_number := 'IPR-' || v_period_key || lpad(v_allocated_seq::text, 3, '0') || '-' || v_suffix;

    -- 6. Transition Disclosure State
    UPDATE public.disclosures
    SET status = 'SUBMITTED',
        tracking_number = v_tracking_number,
        submission_timestamp = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE id = p_disclosure_id;

    -- 7. Emit Transactional Outbox Event
    INSERT INTO public.outbox_messages (
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        created_at
    ) VALUES (
        'DISCLOSURE_SUBMITTED',
        'DISCLOSURE',
        p_disclosure_id,
        jsonb_build_object(
            'disclosure_id', p_disclosure_id,
            'tracking_number', v_tracking_number,
            'primary_inventor_id', v_disclosure.primary_inventor_id,
            'submitted_by', v_actor_id,
            'submission_timestamp', clock_timestamp()
        ),
        clock_timestamp()
    );

    RETURN v_tracking_number;
END;
$$;

ALTER FUNCTION public.submit_initial_disclosure_v3(JSONB, UUID) OWNER TO ipr_definer;

-- ==============================================================================
-- 2. Draft Disclosure Creation & Update Gateways (Requirement 9)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_draft_disclosure_v1(
    p_assertion JSONB,
    p_title VARCHAR,
    p_pidcs_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_disclosure_id UUID;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_CREATE_DRAFT');
    PERFORM auth_internal.verify_actor_any_role_context(v_actor_id, ARRAY['Student', 'Faculty']);

    IF p_title IS NULL OR btrim(p_title) = '' THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: Disclosure title cannot be empty';
    END IF;

    INSERT INTO public.disclosures (
        title,
        status,
        primary_inventor_id,
        pidcs_data,
        created_at,
        updated_at
    ) VALUES (
        p_title,
        'DRAFT',
        v_actor_id,
        COALESCE(p_pidcs_data, '{}'::jsonb),
        clock_timestamp(),
        clock_timestamp()
    ) RETURNING id INTO v_disclosure_id;

    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'DISCLOSURE_DRAFT_CREATED',
        'DISCLOSURE',
        v_disclosure_id,
        jsonb_build_object(
            'disclosure_id', v_disclosure_id,
            'primary_inventor_id', v_actor_id,
            'title', p_title
        ),
        clock_timestamp()
    );

    RETURN v_disclosure_id;
END;
$$;

ALTER FUNCTION public.create_draft_disclosure_v1(JSONB, VARCHAR, JSONB) OWNER TO ipr_definer;

CREATE OR REPLACE FUNCTION public.update_draft_disclosure_v1(
    p_assertion JSONB,
    p_disclosure_id UUID,
    p_title VARCHAR,
    p_pidcs_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_disclosure RECORD;
    v_actor_roles TEXT[];
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_UPDATE_DRAFT');
    PERFORM auth_internal.verify_actor_any_role_context(v_actor_id, ARRAY['Student', 'Faculty']);

    SELECT roles INTO v_actor_roles
    FROM public.portal_users
    WHERE id = v_actor_id;

    SELECT * INTO v_disclosure
    FROM public.disclosures
    WHERE id = p_disclosure_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Disclosure "%" does not exist', p_disclosure_id;
    END IF;

    IF v_disclosure.status != 'DRAFT' THEN
        RAISE EXCEPTION 'INVALID_STATE: Only DRAFT disclosures can be updated (current: %)', v_disclosure.status;
    END IF;

    IF v_disclosure.primary_inventor_id != v_actor_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Only primary inventor may update draft disclosure'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    UPDATE public.disclosures
    SET title = COALESCE(p_title, title),
        pidcs_data = COALESCE(p_pidcs_data, pidcs_data),
        updated_at = clock_timestamp()
    WHERE id = p_disclosure_id;

    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'DISCLOSURE_DRAFT_UPDATED',
        'DISCLOSURE',
        p_disclosure_id,
        jsonb_build_object(
            'disclosure_id', p_disclosure_id,
            'updated_by', v_actor_id,
            'updated_at', clock_timestamp()
        ),
        clock_timestamp()
    );
END;
$$;

ALTER FUNCTION public.update_draft_disclosure_v1(JSONB, UUID, VARCHAR, JSONB) OWNER TO ipr_definer;

-- ==============================================================================
-- 3. Attachment Creation & Scan Token Binding Gateway (Requirement 6 & 9)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_attachment_metadata_v1(
    p_assertion JSONB,
    p_disclosure_id UUID,
    p_file_name VARCHAR,
    p_file_size_bytes BIGINT,
    p_mime_type VARCHAR,
    p_sha256_hash VARCHAR,
    p_storage_path TEXT
)
RETURNS TABLE (
    out_attachment_id UUID,
    out_token_id UUID,
    out_token_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_disclosure RECORD;
    v_actor_roles TEXT[];
    v_new_attachment_id UUID;
    v_new_token_id UUID;
    v_token_expiry TIMESTAMPTZ;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_UPLOAD_ATTACHMENT');
    PERFORM auth_internal.verify_actor_any_role_context(v_actor_id, ARRAY['Student', 'Faculty']);

    SELECT roles INTO v_actor_roles
    FROM public.portal_users
    WHERE id = v_actor_id;

    SELECT * INTO v_disclosure
    FROM public.disclosures
    WHERE id = p_disclosure_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Disclosure "%" does not exist', p_disclosure_id;
    END IF;

    IF v_disclosure.status != 'DRAFT' THEN
        RAISE EXCEPTION 'INVALID_STATE: Attachments can only be uploaded to DRAFT disclosures';
    END IF;

    IF v_disclosure.primary_inventor_id != v_actor_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Only primary inventor may upload attachments'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_file_size_bytes <= 0 OR length(p_sha256_hash) != 64 THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: Invalid file size or SHA256 checksum';
    END IF;

    -- Create attachment record in PENDING_SCAN status
    INSERT INTO public.attachments (
        disclosure_id,
        file_name,
        file_size_bytes,
        mime_type,
        sha256_hash,
        storage_path,
        scan_status,
        uploaded_by_id,
        created_at,
        updated_at
    ) VALUES (
        p_disclosure_id,
        p_file_name,
        p_file_size_bytes,
        p_mime_type,
        p_sha256_hash,
        p_storage_path,
        'PENDING_SCAN',
        v_actor_id,
        clock_timestamp(),
        clock_timestamp()
    ) RETURNING id INTO v_new_attachment_id;

    -- Bind scan token to immutable expected storage path and checksum
    v_token_expiry := clock_timestamp() + INTERVAL '1 hour';

    INSERT INTO public.attachment_scan_tokens (
        attachment_id,
        expected_storage_path,
        expected_sha256_hash,
        status,
        expires_at,
        created_at
    ) VALUES (
        v_new_attachment_id,
        p_storage_path,
        p_sha256_hash,
        'ACTIVE',
        v_token_expiry,
        clock_timestamp()
    ) RETURNING token_id INTO v_new_token_id;

    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'ATTACHMENT_UPLOADED',
        'ATTACHMENT',
        v_new_attachment_id,
        jsonb_build_object(
            'attachment_id', v_new_attachment_id,
            'disclosure_id', p_disclosure_id,
            'scan_token_id', v_new_token_id,
            'sha256_hash', p_sha256_hash
        ),
        clock_timestamp()
    );

    RETURN QUERY SELECT v_new_attachment_id, v_new_token_id, v_token_expiry;
END;
$$;

ALTER FUNCTION public.create_attachment_metadata_v1(JSONB, UUID, VARCHAR, BIGINT, VARCHAR, VARCHAR, TEXT) OWNER TO ipr_definer;

-- ==============================================================================
-- 4. Inventor Consent Request Gateway (C-1)
-- Supports internal portal users and external inventors without portal accounts
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_inventor_consent_request_v1(
    p_assertion JSONB,
    p_disclosure_id UUID,
    p_share_basis_points INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_is_external BOOLEAN DEFAULT FALSE,
    p_external_name TEXT DEFAULT NULL,
    p_external_email TEXT DEFAULT NULL,
    p_external_organization TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_disclosure RECORD;
    v_consent_id UUID;
    v_actor_roles TEXT[];
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_CREATE_CONSENT');
    PERFORM auth_internal.verify_actor_any_role_context(v_actor_id, ARRAY['Student', 'Faculty']);

    SELECT roles INTO v_actor_roles
    FROM public.portal_users
    WHERE id = v_actor_id;

    SELECT * INTO v_disclosure
    FROM public.disclosures
    WHERE id = p_disclosure_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Disclosure "%" does not exist', p_disclosure_id;
    END IF;

    IF v_disclosure.status != 'DRAFT' THEN
        RAISE EXCEPTION 'INVALID_STATE: Consents can only be requested on DRAFT disclosures';
    END IF;

    IF v_disclosure.primary_inventor_id != v_actor_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Only the primary inventor may create consent requests'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_share_basis_points <= 0 OR p_share_basis_points > 10000 THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Share basis points must be between 1 and 10,000';
    END IF;

    IF p_is_external THEN
        IF p_external_name IS NULL OR btrim(p_external_name) = '' OR
           p_external_email IS NULL OR btrim(p_external_email) = '' THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: External inventors require valid name and email';
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.inventor_consents
            WHERE disclosure_id = p_disclosure_id
              AND is_external = TRUE
              AND lower(external_email) = lower(p_external_email)
              AND status IN ('PENDING', 'VERIFIED')
        ) THEN
            RAISE EXCEPTION 'CONFLICT: An active consent record already exists for external inventor "%"', p_external_email;
        END IF;
    ELSE
        IF p_user_id IS NULL THEN
            RAISE EXCEPTION 'INVALID_ARGUMENT: Internal institutional inventors require valid user_id';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.portal_users WHERE id = p_user_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'NOT_FOUND: Institutional inventor user "%" does not exist or is not active', p_user_id;
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.inventor_consents
            WHERE disclosure_id = p_disclosure_id
              AND is_external = FALSE
              AND user_id = p_user_id
              AND status IN ('PENDING', 'VERIFIED')
        ) THEN
            RAISE EXCEPTION 'CONFLICT: An active consent record already exists for internal inventor "%"', p_user_id;
        END IF;
    END IF;

    INSERT INTO public.inventor_consents (
        disclosure_id,
        user_id,
        is_external,
        external_name,
        external_email,
        external_organization,
        share_basis_points,
        status,
        created_at,
        updated_at
    ) VALUES (
        p_disclosure_id,
        p_user_id,
        p_is_external,
        p_external_name,
        p_external_email,
        p_external_organization,
        p_share_basis_points,
        'PENDING',
        clock_timestamp(),
        clock_timestamp()
    ) RETURNING id INTO v_consent_id;

    RETURN v_consent_id;
END;
$$;

ALTER FUNCTION public.create_inventor_consent_request_v1(JSONB, UUID, INTEGER, UUID, BOOLEAN, TEXT, TEXT, TEXT) OWNER TO ipr_definer;

-- ==============================================================================
-- 5. Institutional Inventor Consent Verification Gateway
-- Requires verified evidence attachment and enforces evidence uniqueness (Requirement 5)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.verify_inventor_consent_v1(
    p_assertion JSONB,
    p_consent_id UUID,
    p_verification_notes TEXT,
    p_evidence_attachment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_consent RECORD;
    v_evidence RECORD;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_VERIFY_CONSENT');

    -- Only institutional Administrator may verify inventor consent (database verified)
    PERFORM auth_internal.verify_actor_role_context(v_actor_id, 'Administrator');

    SELECT * INTO v_consent
    FROM public.inventor_consents
    WHERE id = p_consent_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Consent record "%" does not exist', p_consent_id;
    END IF;

    IF v_consent.status != 'PENDING' THEN
        RAISE EXCEPTION 'INVALID_STATE: Only PENDING consents may be verified (current: %)', v_consent.status;
    END IF;

    IF p_evidence_attachment_id IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: Verification requires a valid signature or consent evidence attachment';
    END IF;

    -- Concurrency-safe verification: Lock target evidence attachment row FOR UPDATE (Requirement 5)
    SELECT * INTO v_evidence
    FROM public.attachments
    WHERE id = p_evidence_attachment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Evidence attachment "%" does not exist', p_evidence_attachment_id;
    END IF;

    -- Ensure evidence attachment is not already attached to another consent record
    IF EXISTS (
        SELECT 1 FROM public.inventor_consents
        WHERE signature_evidence_id = p_evidence_attachment_id
          AND id != p_consent_id
    ) THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Evidence attachment is already bound to another inventor consent';
    END IF;

    IF v_evidence.disclosure_id != v_consent.disclosure_id THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Evidence attachment does not belong to the target disclosure';
    END IF;

    IF v_evidence.scan_status != 'CLEAN' THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Evidence attachment must be verified CLEAN by scanner (current: %)', v_evidence.scan_status;
    END IF;

    UPDATE public.inventor_consents
    SET status = 'VERIFIED',
        signature_evidence_id = p_evidence_attachment_id,
        verification_notes = p_verification_notes,
        verified_by_id = v_actor_id,
        verified_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE id = p_consent_id;

    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'INVENTOR_CONSENT_VERIFIED',
        'INVENTOR_CONSENT',
        p_consent_id,
        jsonb_build_object(
            'consent_id', p_consent_id,
            'disclosure_id', v_consent.disclosure_id,
            'evidence_attachment_id', p_evidence_attachment_id,
            'verified_by', v_actor_id,
            'verified_at', clock_timestamp()
        ),
        clock_timestamp()
    );
END;
$$;

ALTER FUNCTION public.verify_inventor_consent_v1(JSONB, UUID, TEXT, UUID) OWNER TO ipr_definer;

-- ==============================================================================
-- 6. Inventor Consent Revocation Gateway (Requirement 8)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.revoke_inventor_consent_v1(
    p_assertion JSONB,
    p_consent_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_consent RECORD;
    v_actor_roles TEXT[];
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_REVOKE_CONSENT');
    PERFORM auth_internal.verify_actor_any_role_context(v_actor_id, ARRAY['Student', 'Faculty']);

    SELECT * INTO v_consent
    FROM public.inventor_consents
    WHERE id = p_consent_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Consent record "%" does not exist', p_consent_id;
    END IF;

    SELECT roles INTO v_actor_roles
    FROM public.portal_users
    WHERE id = v_actor_id;

    -- Actor must be the consenting inventor
    IF (v_consent.user_id IS NULL OR v_consent.user_id != v_actor_id) THEN
        RAISE EXCEPTION 'FORBIDDEN: Only the consenting inventor may revoke consent'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_consent.status NOT IN ('PENDING', 'VERIFIED') THEN
        RAISE EXCEPTION 'INVALID_STATE: Only PENDING or VERIFIED consents may be revoked (current: %)', v_consent.status;
    END IF;

    UPDATE public.inventor_consents
    SET status = 'REVOKED',
        updated_at = clock_timestamp()
    WHERE id = p_consent_id;

    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'INVENTOR_CONSENT_REVOKED',
        'INVENTOR_CONSENT',
        p_consent_id,
        jsonb_build_object(
            'consent_id', p_consent_id,
            'disclosure_id', v_consent.disclosure_id,
            'revoked_by', v_actor_id,
            'revoked_at', clock_timestamp()
        ),
        clock_timestamp()
    );
END;
$$;

ALTER FUNCTION public.revoke_inventor_consent_v1(JSONB, UUID) OWNER TO ipr_definer;

-- ==============================================================================
-- 7. Reviewer Assignment Gateway
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.assign_disclosure_reviewer_v1(
    p_assertion JSONB,
    p_disclosure_id UUID,
    p_reviewer_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_disclosure RECORD;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_ASSIGN_REVIEWER');

    -- Administrator-only assignment
    PERFORM auth_internal.verify_actor_role_context(v_actor_id, 'Administrator');

    -- Verify target reviewer possesses Reviewer role
    PERFORM auth_internal.verify_actor_role_context(p_reviewer_id, 'Reviewer');

    SELECT * INTO v_disclosure
    FROM public.disclosures
    WHERE id = p_disclosure_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Disclosure "%" does not exist', p_disclosure_id;
    END IF;

    IF v_disclosure.status NOT IN ('SUBMITTED', 'APPROVED') THEN
        RAISE EXCEPTION 'INVALID_STATE: Reviewers can only be assigned to SUBMITTED or APPROVED disclosures (current: %)', v_disclosure.status;
    END IF;

    UPDATE public.disclosures
    SET assigned_reviewer_id = p_reviewer_id,
        review_status = 'ASSIGNED',
        updated_at = clock_timestamp()
    WHERE id = p_disclosure_id;

    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'DISCLOSURE_REVIEWER_ASSIGNED',
        'DISCLOSURE',
        p_disclosure_id,
        jsonb_build_object(
            'disclosure_id', p_disclosure_id,
            'assigned_reviewer_id', p_reviewer_id,
            'assigned_by', v_actor_id,
            'assigned_at', clock_timestamp()
        ),
        clock_timestamp()
    );
END;
$$;

ALTER FUNCTION public.assign_disclosure_reviewer_v1(JSONB, UUID, UUID) OWNER TO ipr_definer;

-- ==============================================================================
-- 8. Legal Clearance Gateway
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_legal_clearance_v1(
    p_assertion JSONB,
    p_disclosure_id UUID,
    p_clearance_status VARCHAR,
    p_clearance_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_disclosure RECORD;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_LEGAL_CLEARANCE');

    -- Legal Officer authorized (Least Privilege: Legal Officer conducts legal clearance)
    PERFORM auth_internal.verify_actor_role_context(v_actor_id, 'Legal');

    IF p_clearance_status NOT IN ('CLEARED', 'REJECTED') THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Legal clearance status must be CLEARED or REJECTED';
    END IF;

    SELECT * INTO v_disclosure
    FROM public.disclosures
    WHERE id = p_disclosure_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Disclosure "%" does not exist', p_disclosure_id;
    END IF;

    IF v_disclosure.status NOT IN ('SUBMITTED', 'APPROVED') THEN
        RAISE EXCEPTION 'INVALID_STATE: Legal clearance can only be recorded on SUBMITTED or APPROVED disclosures';
    END IF;

    UPDATE public.disclosures
    SET legal_clearance_status = p_clearance_status,
        legal_cleared_by_id = v_actor_id,
        legal_cleared_at = clock_timestamp(),
        legal_clearance_notes = p_clearance_notes,
        updated_at = clock_timestamp()
    WHERE id = p_disclosure_id;

    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'DISCLOSURE_LEGAL_CLEARED',
        'DISCLOSURE',
        p_disclosure_id,
        jsonb_build_object(
            'disclosure_id', p_disclosure_id,
            'clearance_status', p_clearance_status,
            'cleared_by', v_actor_id,
            'cleared_at', clock_timestamp()
        ),
        clock_timestamp()
    );
END;
$$;

ALTER FUNCTION public.record_legal_clearance_v1(JSONB, UUID, VARCHAR, TEXT) OWNER TO ipr_definer;

-- ==============================================================================
-- 9. Patent Application Creation Gateway (D-1 & Requirement 8)
-- Enforces Administrator-only assignment of legal officers
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_patent_application_v1(
    p_assertion JSONB,
    p_disclosure_id UUID,
    p_assigned_legal_officer_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_disclosure RECORD;
    v_application_id UUID;
    v_history_id UUID;
    v_actor_roles TEXT[];
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_CREATE_PATENT_APPLICATION');
    PERFORM auth_internal.verify_actor_any_role_context(v_actor_id, ARRAY['Administrator', 'Legal']);

    SELECT roles INTO v_actor_roles
    FROM public.portal_users
    WHERE id = v_actor_id;

    -- Enforce Administrator-only assignment of Legal Officers (Requirement 8)
    IF p_assigned_legal_officer_id IS NOT NULL AND NOT ('Administrator' = ANY(v_actor_roles)) THEN
        RAISE EXCEPTION 'FORBIDDEN: Only Administrator may assign legal officers to patent applications'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_assigned_legal_officer_id IS NOT NULL THEN
        PERFORM auth_internal.verify_actor_role_context(p_assigned_legal_officer_id, 'Legal');
    END IF;

    SELECT * INTO v_disclosure
    FROM public.disclosures
    WHERE id = p_disclosure_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Disclosure "%" does not exist', p_disclosure_id;
    END IF;

    IF v_disclosure.status NOT IN ('SUBMITTED', 'APPROVED') THEN
        RAISE EXCEPTION 'INVALID_STATE: Patent applications can only be created from SUBMITTED or APPROVED disclosures (current: %)', v_disclosure.status;
    END IF;

    -- Legal Clearance Verification: caller cannot bypass clearance requirement
    IF v_disclosure.legal_clearance_status != 'CLEARED' THEN
        RAISE EXCEPTION 'INVALID_STATE: Patent applications can only be created from disclosures with CLEARED legal clearance (current: %)',
            v_disclosure.legal_clearance_status;
    END IF;

    -- Duplicate & Concurrent Creation Protection:
    -- Multiple patent applications can be created per disclosure, but concurrent or duplicate double-creation
    -- of an unfiled docket in FILING_PREPARATION is rejected.
    IF EXISTS (
        SELECT 1 FROM public.patent_applications
        WHERE disclosure_id = p_disclosure_id
          AND current_stage = 'FILING_PREPARATION'
    ) THEN
        RAISE EXCEPTION 'DUPLICATE_APPLICATION: An active patent application is already in FILING_PREPARATION for disclosure "%"', p_disclosure_id;
    END IF;

    INSERT INTO public.patent_applications (
        disclosure_id,
        current_stage,
        assigned_legal_officer_id,
        created_at,
        updated_at
    ) VALUES (
        p_disclosure_id,
        'FILING_PREPARATION',
        p_assigned_legal_officer_id,
        clock_timestamp(),
        clock_timestamp()
    ) RETURNING id INTO v_application_id;

    INSERT INTO public.patent_stage_history (
        patent_application_id,
        from_stage,
        to_stage,
        transition_reason,
        transitioned_by_id,
        transitioned_at
    ) VALUES (
        v_application_id,
        NULL,
        'FILING_PREPARATION',
        'Initial patent application filing preparation opened',
        v_actor_id,
        clock_timestamp()
    ) RETURNING id INTO v_history_id;

    UPDATE public.patent_applications
    SET current_history_id = v_history_id,
        updated_at = clock_timestamp()
    WHERE id = v_application_id;

    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'PATENT_APPLICATION_CREATED',
        'PATENT_APPLICATION',
        v_application_id,
        jsonb_build_object(
            'application_id', v_application_id,
            'disclosure_id', p_disclosure_id,
            'assigned_legal_officer_id', p_assigned_legal_officer_id,
            'initial_stage', 'FILING_PREPARATION'
        ),
        clock_timestamp()
    );

    RETURN v_application_id;
END;
$$;

ALTER FUNCTION public.create_patent_application_v1(JSONB, UUID, UUID) OWNER TO ipr_definer;

-- ==============================================================================
-- 10. Patent Legal Officer Assignment Gateway (Requirement 8 & 9)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.assign_patent_legal_officer_v1(
    p_assertion JSONB,
    p_patent_application_id UUID,
    p_legal_officer_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_app RECORD;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_ASSIGN_LEGAL_OFFICER');

    -- Strictly Administrator-only assignment
    PERFORM auth_internal.verify_actor_role_context(v_actor_id, 'Administrator');

    IF p_legal_officer_id IS NOT NULL THEN
        PERFORM auth_internal.verify_actor_role_context(p_legal_officer_id, 'Legal');
    END IF;

    SELECT * INTO v_app
    FROM public.patent_applications
    WHERE id = p_patent_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Patent application "%" does not exist', p_patent_application_id;
    END IF;

    UPDATE public.patent_applications
    SET assigned_legal_officer_id = p_legal_officer_id,
        updated_at = clock_timestamp()
    WHERE id = p_patent_application_id;

    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'PATENT_LEGAL_OFFICER_ASSIGNED',
        'PATENT_APPLICATION',
        p_patent_application_id,
        jsonb_build_object(
            'application_id', p_patent_application_id,
            'assigned_legal_officer_id', p_legal_officer_id,
            'assigned_by', v_actor_id,
            'assigned_at', clock_timestamp()
        ),
        clock_timestamp()
    );
END;
$$;

ALTER FUNCTION public.assign_patent_legal_officer_v1(JSONB, UUID, UUID) OWNER TO ipr_definer;

-- ==============================================================================
-- 11. Patent Stage Transition Gateway (D-1 & Requirement 8)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_patent_stage_transition_v2(
    p_assertion JSONB,
    p_patent_application_id UUID,
    p_to_stage VARCHAR,
    p_transition_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_app RECORD;
    v_history_id UUID;
    v_actor_roles TEXT[];
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_TRANSITION_PATENT_STAGE');
    PERFORM auth_internal.verify_actor_any_role_context(v_actor_id, ARRAY['Legal', 'Administrator']);

    SELECT * INTO v_app
    FROM public.patent_applications
    WHERE id = p_patent_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Patent application "%" does not exist', p_patent_application_id;
    END IF;

    SELECT roles INTO v_actor_roles
    FROM public.portal_users
    WHERE id = v_actor_id;

    -- Enforce institutional boundaries:
    -- Administrators can transition patent applications under institutional oversight.
    -- Legal Officers can transition only patent applications assigned to them.
    IF 'Administrator' = ANY(v_actor_roles) THEN
        NULL; -- Administrator permitted under institutional oversight
    ELSIF 'Legal' = ANY(v_actor_roles) THEN
        IF v_app.assigned_legal_officer_id IS NULL OR v_app.assigned_legal_officer_id != v_actor_id THEN
            RAISE EXCEPTION 'FORBIDDEN: Legal officer is not assigned to patent application "%"', p_patent_application_id
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    ELSE
        RAISE EXCEPTION 'FORBIDDEN: Insufficient privileges to perform patent stage transition'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Terminal Stage Lockout
    IF v_app.current_stage IN ('GRANTED', 'REJECTED', 'ABANDONED') THEN
        RAISE EXCEPTION 'INVALID_OPERATION: Cannot transition out of terminal patent stage "%"', v_app.current_stage;
    END IF;

    -- Transition Matrix Validation Check
    IF NOT EXISTS (
        SELECT 1 FROM public.patent_stage_allowed_transitions
        WHERE from_stage = v_app.current_stage
          AND to_stage = p_to_stage
    ) THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: Stage transition from "%" to "%" is not permitted by institutional matrix',
            v_app.current_stage, p_to_stage;
    END IF;

    INSERT INTO public.patent_stage_history (
        patent_application_id,
        from_stage,
        to_stage,
        transition_reason,
        transitioned_by_id,
        transitioned_at
    ) VALUES (
        p_patent_application_id,
        v_app.current_stage,
        p_to_stage,
        p_transition_reason,
        v_actor_id,
        clock_timestamp()
    ) RETURNING id INTO v_history_id;

    UPDATE public.patent_applications
    SET current_stage = p_to_stage,
        current_history_id = v_history_id,
        updated_at = clock_timestamp()
    WHERE id = p_patent_application_id;

    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'PATENT_STAGE_TRANSITIONED',
        'PATENT_APPLICATION',
        p_patent_application_id,
        jsonb_build_object(
            'application_id', p_patent_application_id,
            'from_stage', v_app.current_stage,
            'to_stage', p_to_stage,
            'transition_history_id', v_history_id,
            'transitioned_by', v_actor_id,
            'reason', p_transition_reason
        ),
        clock_timestamp()
    );

    RETURN v_history_id;
END;
$$;

ALTER FUNCTION public.record_patent_stage_transition_v2(JSONB, UUID, VARCHAR, TEXT) OWNER TO ipr_definer;

-- ==============================================================================
-- 12. Antivirus Scan Result Recording Gateway (A-3 & Requirement 6)
-- Cryptographically binds scan result to expected object path and SHA-256 checksum
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_antivirus_scan_result_v5(
    p_token_id UUID,
    p_attachment_id UUID,
    p_scanned_sha256 VARCHAR,
    p_scanned_storage_path TEXT,
    p_scan_status VARCHAR,
    p_scan_details TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_attachment RECORD;
BEGIN
    -- Strict Identity Boundary Check: Session user MUST be ipr_scanner login role
    IF SESSION_USER != 'ipr_scanner' THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Only ipr_scanner runtime role may invoke antivirus gateway (caller: %)', SESSION_USER
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_scan_status NOT IN ('CLEAN', 'INFECTED', 'SCAN_FAILED') THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Invalid scan status "%"', p_scan_status;
    END IF;

    -- Verify attachment existence and checksum/path match
    SELECT * INTO v_attachment
    FROM public.attachments
    WHERE id = p_attachment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Attachment "%" does not exist', p_attachment_id;
    END IF;

    -- Immutable physical storage object identity/version and checksum binding (Requirement 6)
    IF v_attachment.scan_status != 'PENDING_SCAN' THEN
        RAISE EXCEPTION 'INVALID_STATE: Attachment is not in PENDING_SCAN state (current: %)', v_attachment.scan_status;
    END IF;

    IF v_attachment.sha256_hash != p_scanned_sha256 OR v_attachment.storage_path != p_scanned_storage_path THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Scanned physical object identity, version, or checksum differs from registered attachment';
    END IF;

    -- Atomically consume single-use token binding expected path and hash
    UPDATE public.attachment_scan_tokens
    SET status = 'CONSUMED',
        consumed_at = clock_timestamp(),
        consumed_by_session = SESSION_USER
    WHERE token_id = p_token_id
      AND attachment_id = p_attachment_id
      AND expected_sha256_hash = p_scanned_sha256
      AND expected_storage_path = p_scanned_storage_path
      AND status = 'ACTIVE'
      AND expires_at > clock_timestamp();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SCAN_TOKEN: Scan token is invalid, expired, already consumed, or object identity mismatch';
    END IF;

    UPDATE public.attachments
    SET scan_status = p_scan_status,
        scan_details = p_scan_details,
        scanned_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE id = p_attachment_id;

    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'ATTACHMENT_SCAN_COMPLETED',
        'ATTACHMENT',
        p_attachment_id,
        jsonb_build_object(
            'attachment_id', p_attachment_id,
            'scan_status', p_scan_status,
            'scan_details', p_scan_details,
            'scanned_at', clock_timestamp()
        ),
        clock_timestamp()
    );
END;
$$;

ALTER FUNCTION public.record_antivirus_scan_result_v5(UUID, UUID, VARCHAR, TEXT, VARCHAR, TEXT) OWNER TO ipr_definer;

-- ==============================================================================
-- 13. Transactional Outbox Batch Task Claiming Gateway (F-1 & Requirement 7)
-- Disambiguates output columns; recovers expired crash leases with bounded retries
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.claim_outbox_tasks_v1(
    p_worker_id TEXT,
    p_batch_size INTEGER,
    p_lease_duration_seconds INTEGER
)
RETURNS TABLE (
    out_task_id UUID,
    out_task_type VARCHAR,
    out_payload JSONB,
    out_lease_token UUID,
    out_lease_expires_at TIMESTAMPTZ,
    out_retry_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
BEGIN
    -- Strict Identity Boundary Check: Session user MUST be ipr_worker role (Requirement 2)
    IF SESSION_USER != 'ipr_worker' THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Outbox task operations may only be executed by session user "ipr_worker" (current: %)', SESSION_USER
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 100 THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: p_batch_size must be between 1 and 100 (got %)', p_batch_size;
    END IF;

    IF p_lease_duration_seconds IS NULL OR p_lease_duration_seconds < 5 OR p_lease_duration_seconds > 3600 THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: p_lease_duration_seconds must be between 5 and 3600 (got %)', p_lease_duration_seconds;
    END IF;

    IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: p_worker_id must not be empty';
    END IF;

    -- First auto-dead-letter tasks whose crashed leases reached or exceeded max_retries (Requirement 10)
    UPDATE public.outbox_tasks
    SET status = 'DEAD_LETTER',
        last_error = 'EXPIRED_LEASE_MAX_RETRIES_EXCEEDED: Task abandoned after repeated worker lease timeouts',
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = clock_timestamp()
    WHERE status = 'RUNNING'
      AND lease_expires_at < clock_timestamp()
      AND retry_count >= max_retries;

    -- Claim eligible tasks atomically with SKIP LOCKED
    RETURN QUERY
    WITH eligible AS (
        SELECT t_sub.id
        FROM public.outbox_tasks t_sub
        WHERE t_sub.status = 'PENDING'
           OR (t_sub.status = 'RUNNING' AND t_sub.lease_expires_at < clock_timestamp() AND t_sub.retry_count < t_sub.max_retries)
        ORDER BY t_sub.priority DESC, t_sub.created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.outbox_tasks t
    SET status = 'RUNNING',
        worker_id = p_worker_id,
        lease_token = public.gen_random_uuid(),
        lease_expires_at = clock_timestamp() + (p_lease_duration_seconds * INTERVAL '1 second'),
        -- Crash recovery: increment retry count when claiming an expired lease, but not on initial PENDING claim
        retry_count = CASE WHEN t.status = 'RUNNING' THEN t.retry_count + 1 ELSE t.retry_count END,
        updated_at = clock_timestamp()
    FROM eligible
    WHERE t.id = eligible.id
    RETURNING
        t.id AS out_task_id,
        t.task_type AS out_task_type,
        t.payload AS out_payload,
        t.lease_token AS out_lease_token,
        t.lease_expires_at AS out_lease_expires_at,
        t.retry_count AS out_retry_count;
END;
$$;

ALTER FUNCTION public.claim_outbox_tasks_v1(TEXT, INTEGER, INTEGER) OWNER TO ipr_definer;

-- ==============================================================================
-- 14. Transactional Outbox Task Lease Renewal Gateway (F-1 & Requirement 7)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.renew_outbox_task_lease_v1(
    p_task_id UUID,
    p_lease_token UUID,
    p_lease_duration_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_updated_rows INTEGER;
BEGIN
    -- Strict Identity Boundary Check: Session user MUST be ipr_worker role (Requirement 2)
    IF SESSION_USER != 'ipr_worker' THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Outbox task operations may only be executed by session user "ipr_worker" (current: %)', SESSION_USER
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_task_id IS NULL OR p_lease_token IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: p_task_id and p_lease_token are required';
    END IF;

    IF p_lease_duration_seconds IS NULL OR p_lease_duration_seconds < 5 OR p_lease_duration_seconds > 3600 THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: p_lease_duration_seconds must be between 5 and 3600 (got %)', p_lease_duration_seconds;
    END IF;

    UPDATE public.outbox_tasks
    SET lease_expires_at = clock_timestamp() + (p_lease_duration_seconds * INTERVAL '1 second'),
        updated_at = clock_timestamp()
    WHERE id = p_task_id
      AND lease_token = p_lease_token
      AND status = 'RUNNING'
      AND lease_expires_at >= clock_timestamp();

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    RETURN v_updated_rows > 0;
END;
$$;

ALTER FUNCTION public.renew_outbox_task_lease_v1(UUID, UUID, INTEGER) OWNER TO ipr_definer;

-- ==============================================================================
-- 15. Transactional Outbox Task Completion Gateway (F-1 & Requirement 7)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.complete_outbox_task_v1(
    p_task_id UUID,
    p_lease_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_updated_rows INTEGER;
BEGIN
    -- Strict Identity Boundary Check: Session user MUST be ipr_worker role (Requirement 2)
    IF SESSION_USER != 'ipr_worker' THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Outbox task operations may only be executed by session user "ipr_worker" (current: %)', SESSION_USER
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_task_id IS NULL OR p_lease_token IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: p_task_id and p_lease_token are required';
    END IF;

    UPDATE public.outbox_tasks
    SET status = 'COMPLETED',
        completed_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE id = p_task_id
      AND lease_token = p_lease_token
      AND status = 'RUNNING'
      AND lease_expires_at >= clock_timestamp();

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    RETURN v_updated_rows > 0;
END;
$$;

ALTER FUNCTION public.complete_outbox_task_v1(UUID, UUID) OWNER TO ipr_definer;

-- ==============================================================================
-- 16. Transactional Outbox Task Failure Gateway (F-1 & Requirement 7)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fail_outbox_task_v1(
    p_task_id UUID,
    p_lease_token UUID,
    p_error_message TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_task RECORD;
BEGIN
    -- Strict Identity Boundary Check: Session user MUST be ipr_worker role (Requirement 2)
    IF SESSION_USER != 'ipr_worker' THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Outbox task operations may only be executed by session user "ipr_worker" (current: %)', SESSION_USER
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_task_id IS NULL OR p_lease_token IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: p_task_id and p_lease_token are required';
    END IF;

    SELECT * INTO v_task
    FROM public.outbox_tasks
    WHERE id = p_task_id
      AND lease_token = p_lease_token
      AND status = 'RUNNING'
      AND lease_expires_at >= clock_timestamp()
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_task.retry_count + 1 >= v_task.max_retries THEN
        UPDATE public.outbox_tasks
        SET status = 'DEAD_LETTER',
            last_error = p_error_message,
            retry_count = retry_count + 1,
            lease_token = NULL,
            lease_expires_at = NULL,
            updated_at = clock_timestamp()
        WHERE id = p_task_id;
    ELSE
        UPDATE public.outbox_tasks
        SET status = 'PENDING',
            last_error = p_error_message,
            retry_count = retry_count + 1,
            lease_token = NULL,
            lease_expires_at = NULL,
            updated_at = clock_timestamp()
        WHERE id = p_task_id;
    END IF;

    RETURN TRUE;
END;
$$;

ALTER FUNCTION public.fail_outbox_task_v1(UUID, UUID, TEXT) OWNER TO ipr_definer;

-- ==============================================================================
-- 17. Restricted Read Gateways (Requirement 4: Database Read Authorization)
-- Protects storage paths, consent evidence, and enforces legal officer case isolation
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_disclosure_v1(
    p_assertion JSONB,
    p_disclosure_id UUID
)
RETURNS TABLE (
    out_id UUID,
    out_tracking_number VARCHAR,
    out_title VARCHAR,
    out_status VARCHAR,
    out_primary_inventor_id UUID,
    out_assigned_reviewer_id UUID,
    out_review_status VARCHAR,
    out_legal_clearance_status VARCHAR,
    out_pidcs_data JSONB,
    out_submission_timestamp TIMESTAMPTZ,
    out_created_at TIMESTAMPTZ,
    out_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_roles TEXT[];
    v_row RECORD;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_VIEW_DISCLOSURE');

    SELECT roles INTO v_roles
    FROM public.portal_users
    WHERE id = v_actor_id;

    SELECT * INTO v_row
    FROM public.disclosures
    WHERE id = p_disclosure_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Disclosure "%" does not exist', p_disclosure_id;
    END IF;

    -- Authorization matrix:
    -- 1. Administrator can view any disclosure
    -- 2. Primary inventor can view
    -- 3. Active/verified consenting co-inventors can view (Requirement 4)
    -- 4. Assigned reviewer can view
    -- 5. Legal Officer assigned to a patent application for this disclosure can view
    IF 'Administrator' = ANY(v_roles) THEN
        v_is_authorized := TRUE;
    ELSIF v_row.primary_inventor_id = v_actor_id THEN
        v_is_authorized := TRUE;
    ELSIF v_row.assigned_reviewer_id = v_actor_id THEN
        v_is_authorized := TRUE;
    ELSIF EXISTS (
        SELECT 1 FROM public.inventor_consents
        WHERE disclosure_id = p_disclosure_id
          AND user_id = v_actor_id
          AND status IN ('PENDING', 'VERIFIED')
    ) THEN
        v_is_authorized := TRUE;
    ELSIF EXISTS (
        SELECT 1 FROM public.patent_applications
        WHERE disclosure_id = p_disclosure_id AND assigned_legal_officer_id = v_actor_id
    ) THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor not authorized to read disclosure "%"', p_disclosure_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN QUERY SELECT
        v_row.id,
        v_row.tracking_number,
        v_row.title,
        v_row.status,
        v_row.primary_inventor_id,
        v_row.assigned_reviewer_id,
        v_row.review_status,
        v_row.legal_clearance_status,
        v_row.pidcs_data,
        v_row.submission_timestamp,
        v_row.created_at,
        v_row.updated_at;
END;
$$;

ALTER FUNCTION public.get_disclosure_v1(JSONB, UUID) OWNER TO ipr_definer;

CREATE OR REPLACE FUNCTION public.get_patent_application_v1(
    p_assertion JSONB,
    p_patent_application_id UUID
)
RETURNS TABLE (
    out_id UUID,
    out_disclosure_id UUID,
    out_current_stage VARCHAR,
    out_assigned_legal_officer_id UUID,
    out_current_history_id UUID,
    out_filing_date DATE,
    out_application_number VARCHAR,
    out_created_at TIMESTAMPTZ,
    out_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_roles TEXT[];
    v_app RECORD;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_VIEW_DISCLOSURE');

    SELECT roles INTO v_roles
    FROM public.portal_users
    WHERE id = v_actor_id;

    SELECT * INTO v_app
    FROM public.patent_applications
    WHERE id = p_patent_application_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Patent application "%" does not exist', p_patent_application_id;
    END IF;

    -- Enforce case isolation: Legal Officers can only view their assigned cases
    IF 'Administrator' = ANY(v_roles) THEN
        NULL;
    ELSIF 'Legal' = ANY(v_roles) THEN
        IF v_app.assigned_legal_officer_id IS NULL OR v_app.assigned_legal_officer_id != v_actor_id THEN
            RAISE EXCEPTION 'FORBIDDEN: Legal officer not assigned to this patent case'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    ELSIF EXISTS (
        SELECT 1 FROM public.disclosures d
        WHERE d.id = v_app.disclosure_id AND (
            d.primary_inventor_id = v_actor_id OR EXISTS (
                SELECT 1 FROM public.inventor_consents ic
                WHERE ic.disclosure_id = d.id
                  AND ic.user_id = v_actor_id
                  AND ic.status IN ('PENDING', 'VERIFIED')
            )
        )
    ) THEN
        NULL;
    ELSE
        RAISE EXCEPTION 'FORBIDDEN: Actor not authorized to read patent application'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN QUERY SELECT
        v_app.id,
        v_app.disclosure_id,
        v_app.current_stage,
        v_app.assigned_legal_officer_id,
        v_app.current_history_id,
        v_app.filing_date,
        v_app.application_number,
        v_app.created_at,
        v_app.updated_at;
END;
$$;

ALTER FUNCTION public.get_patent_application_v1(JSONB, UUID) OWNER TO ipr_definer;

CREATE OR REPLACE FUNCTION public.get_attachment_metadata_v1(
    p_assertion JSONB,
    p_attachment_id UUID
)
RETURNS TABLE (
    out_id UUID,
    out_disclosure_id UUID,
    out_file_name VARCHAR,
    out_file_size_bytes BIGINT,
    out_mime_type VARCHAR,
    out_sha256_hash VARCHAR,
    out_scan_status VARCHAR,
    out_uploaded_by_id UUID,
    out_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_roles TEXT[];
    v_att RECORD;
    v_is_evidence BOOLEAN;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_VIEW_DISCLOSURE');

    SELECT roles INTO v_roles
    FROM public.portal_users
    WHERE id = v_actor_id;

    SELECT * INTO v_att
    FROM public.attachments
    WHERE id = p_attachment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Attachment "%" does not exist', p_attachment_id;
    END IF;

    -- Parent disclosure authorization check (Requirement 3 & 4)
    -- Actor must have legitimate read access to the parent disclosure
    IF 'Administrator' = ANY(v_roles) THEN
        NULL; -- Administrator has global disclosure read access
    ELSIF EXISTS (
        SELECT 1 FROM public.disclosures d
        WHERE d.id = v_att.disclosure_id AND (
            d.primary_inventor_id = v_actor_id
            OR d.assigned_reviewer_id = v_actor_id
            OR EXISTS (
                SELECT 1 FROM public.inventor_consents ic
                WHERE ic.disclosure_id = d.id
                  AND ic.user_id = v_actor_id
                  AND ic.status IN ('PENDING', 'VERIFIED')
            )
            OR EXISTS (
                SELECT 1 FROM public.patent_applications pa
                WHERE pa.disclosure_id = d.id
                  AND pa.assigned_legal_officer_id = v_actor_id
            )
        )
    ) THEN
        NULL; -- Authorized via parent disclosure relationship
    ELSE
        RAISE EXCEPTION 'FORBIDDEN: Actor not authorized to read attachments for disclosure "%"', v_att.disclosure_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Storage path metadata protection: physical storage path is never exposed in client queries
    -- Check if attachment is a consent evidence document
    SELECT EXISTS (
        SELECT 1 FROM public.inventor_consents WHERE signature_evidence_id = p_attachment_id
    ) INTO v_is_evidence;

    IF v_is_evidence THEN
        -- Evidence documents can only be viewed by Administrator or the specific consenting inventor
        IF NOT ('Administrator' = ANY(v_roles)) AND NOT EXISTS (
            SELECT 1 FROM public.inventor_consents
            WHERE signature_evidence_id = p_attachment_id AND user_id = v_actor_id
        ) THEN
            RAISE EXCEPTION 'FORBIDDEN: Consent evidence attachments can only be accessed by Administrator or consenting inventor'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END IF;

    RETURN QUERY SELECT
        v_att.id,
        v_att.disclosure_id,
        v_att.file_name,
        v_att.file_size_bytes,
        v_att.mime_type,
        v_att.sha256_hash,
        v_att.scan_status,
        v_att.uploaded_by_id,
        v_att.created_at;
END;
$$;

ALTER FUNCTION public.get_attachment_metadata_v1(JSONB, UUID) OWNER TO ipr_definer;
