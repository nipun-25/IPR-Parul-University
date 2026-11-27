-- ==============================================================================
-- Migration 011: Consent and Attachment Remediation (Stage 2G.7 Final)
-- 
-- Scope:
-- 1. Updates chk_inventor_consents_status constraint to support 'CANCELLED'.
-- 2. Updates chk_attachments_scan_status constraint to support 'ABANDONED'.
-- 3. Adds claimed_at and claimed_by_actor columns to public.attachment_scan_tokens
--    to support atomic single-claim upload concurrency safety.
-- 4. Implements public.cancel_consent_invitation_v1 (SECURITY DEFINER, ipr_definer owned)
--    allowing primary inventor to cancel pending co-inventor consent invitations
--    while preserving full audit history and preventing alteration of verified consent.
-- 5. Implements public.get_attachment_upload_context_v1 (SECURITY DEFINER, ipr_definer owned)
--    with row-level locking (FOR UPDATE) and atomic single-token claim mechanism,
--    preventing concurrent upload races and avoiding token reuse.
-- 6. Implements public.abandon_attachment_v1 (SECURITY DEFINER, ipr_definer owned)
--    allowing primary inventor of draft disclosure to abandon failed/interrupted uploads,
--    marking attachment ABANDONED, expiring active scan tokens, and emitting audit events.
-- 7. Updates public.submit_initial_disclosure_v3 (SECURITY DEFINER, ipr_definer owned)
--    to ensure ABANDONED attachments do not block submission while requiring that
--    at least one valid specification attachment is present and CLEAN.
-- 8. Strict least-privilege boundary enforcement: revoked from PUBLIC, granted to ipr_app.
--    No table privileges granted to ipr_app.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Expand Consent Status Check Constraint to Support 'CANCELLED'
-- ------------------------------------------------------------------------------
ALTER TABLE public.inventor_consents
    DROP CONSTRAINT IF EXISTS chk_inventor_consents_status;

ALTER TABLE public.inventor_consents
    ADD CONSTRAINT chk_inventor_consents_status
    CHECK (status IN ('PENDING', 'VERIFIED', 'REVOKED', 'EXPIRED', 'SUPERSEDED', 'CANCELLED'));

-- ------------------------------------------------------------------------------
-- 2. Expand Attachment Scan Status Check Constraint to Support 'ABANDONED'
-- ------------------------------------------------------------------------------
ALTER TABLE public.attachments
    DROP CONSTRAINT IF EXISTS chk_attachments_scan_status;

ALTER TABLE public.attachments
    ADD CONSTRAINT chk_attachments_scan_status
    CHECK (scan_status IN ('PENDING_SCAN', 'CLEAN', 'INFECTED', 'SCAN_FAILED', 'ABANDONED'));

-- ------------------------------------------------------------------------------
-- 3. Concurrency Safety: Attachment Scan Token Claim Tracking
-- ------------------------------------------------------------------------------
ALTER TABLE public.attachment_scan_tokens
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS claimed_by_actor UUID NULL;

CREATE INDEX IF NOT EXISTS idx_attachment_scan_tokens_claim
    ON public.attachment_scan_tokens (attachment_id, status, claimed_at, expires_at);

-- ------------------------------------------------------------------------------
-- 4. Inventor Consent Invitation Cancellation Gateway
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_consent_invitation_v1(
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
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_CANCEL_CONSENT_INVITATION');
    PERFORM auth_internal.verify_actor_any_role_context(v_actor_id, ARRAY['Student', 'Faculty']);

    SELECT ic.*, d.primary_inventor_id
    INTO v_consent
    FROM public.inventor_consents ic
    JOIN public.disclosures d ON d.id = ic.disclosure_id
    WHERE ic.id = p_consent_id
    FOR UPDATE OF ic;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Consent record "%" does not exist', p_consent_id;
    END IF;

    -- Only the primary inventor may cancel pending consent invitations
    IF v_consent.primary_inventor_id != v_actor_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Only the primary inventor may cancel pending consent invitations'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Verified consent cannot be cancelled; only PENDING invitations can be cancelled
    IF v_consent.status != 'PENDING' THEN
        IF v_consent.status = 'VERIFIED' THEN
            RAISE EXCEPTION 'INVALID_STATE: Verified consent cannot be cancelled (current: %)', v_consent.status
                USING ERRCODE = 'check_violation';
        ELSE
            RAISE EXCEPTION 'INVALID_STATE: Only PENDING consent invitations may be cancelled (current: %)', v_consent.status;
        END IF;
    END IF;

    -- Preserve the record and transition status to CANCELLED
    UPDATE public.inventor_consents
    SET status = 'CANCELLED',
        updated_at = clock_timestamp()
    WHERE id = p_consent_id;

    -- Traceable audit history via outbox architecture
    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'INVENTOR_CONSENT_INVITATION_CANCELLED',
        'INVENTOR_CONSENT',
        p_consent_id,
        jsonb_build_object(
            'consent_id', p_consent_id,
            'disclosure_id', v_consent.disclosure_id,
            'cancelled_by', v_actor_id,
            'is_external', v_consent.is_external,
            'external_name', v_consent.external_name,
            'external_email', v_consent.external_email,
            'external_organization', v_consent.external_organization,
            'share_basis_points', v_consent.share_basis_points,
            'user_id', v_consent.user_id,
            'signature_evidence_id', v_consent.signature_evidence_id,
            'cancelled_at', clock_timestamp()
        ),
        clock_timestamp()
    );
END;
$$;

ALTER FUNCTION public.cancel_consent_invitation_v1(JSONB, UUID) OWNER TO ipr_definer;
REVOKE ALL ON FUNCTION public.cancel_consent_invitation_v1(JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_consent_invitation_v1(JSONB, UUID) TO ipr_app;

-- ------------------------------------------------------------------------------
-- 5. Attachment Upload Context & Atomic Token Claim Gateway
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_attachment_upload_context_v1(
    p_assertion JSONB,
    p_attachment_id UUID
)
RETURNS TABLE (
    out_attachment_id UUID,
    out_disclosure_id UUID,
    out_file_name VARCHAR,
    out_file_size_bytes BIGINT,
    out_mime_type VARCHAR,
    out_sha256_hash VARCHAR,
    out_storage_path TEXT,
    out_token_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_att RECORD;
    v_token_id UUID;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_UPLOAD_ATTACHMENT');
    PERFORM auth_internal.verify_actor_any_role_context(v_actor_id, ARRAY['Student', 'Faculty']);

    -- 1. Row-level lock on target attachment to serialize concurrent upload operations
    SELECT
        a.id AS attachment_id,
        a.disclosure_id,
        a.file_name,
        a.file_size_bytes,
        a.mime_type,
        a.sha256_hash,
        a.storage_path,
        a.scan_status,
        d.status AS disclosure_status,
        d.primary_inventor_id
    INTO v_att
    FROM public.attachments a
    JOIN public.disclosures d ON d.id = a.disclosure_id
    WHERE a.id = p_attachment_id
    FOR UPDATE OF a;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Attachment "%" does not exist', p_attachment_id;
    END IF;

    -- Actor must be the primary inventor of the associated disclosure
    IF v_att.primary_inventor_id != v_actor_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Only the primary inventor may upload file content to this disclosure'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Attachments can only be uploaded to DRAFT disclosures
    IF v_att.disclosure_status != 'DRAFT' THEN
        RAISE EXCEPTION 'INVALID_STATE: Attachments can only be uploaded to DRAFT disclosures (current: %)', v_att.disclosure_status;
    END IF;

    -- Prevent duplicate or re-uploads
    IF v_att.scan_status != 'PENDING_SCAN' THEN
        RAISE EXCEPTION 'DUPLICATE_UPLOAD: Attachment has already been processed with status "%"', v_att.scan_status;
    END IF;

    -- 2. Concurrency-safe single-use token claim with row lock (FOR UPDATE OF ast)
    -- Atomically select the active, unexpired, and unclaimed scan token
    SELECT ast.token_id INTO v_token_id
    FROM public.attachment_scan_tokens ast
    WHERE ast.attachment_id = p_attachment_id
      AND ast.status = 'ACTIVE'
      AND ast.claimed_at IS NULL
      AND ast.expires_at > clock_timestamp()
    ORDER BY ast.created_at DESC
    LIMIT 1
    FOR UPDATE OF ast;

    IF v_token_id IS NULL THEN
        -- Check if an upload already claimed the token vs expired or missing
        IF EXISTS (
            SELECT 1 FROM public.attachment_scan_tokens
            WHERE attachment_id = p_attachment_id
              AND status = 'ACTIVE'
              AND claimed_at IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'INVALID_SCAN_TOKEN: Scan token for attachment "%" is already claimed by an active upload in progress', p_attachment_id;
        ELSE
            RAISE EXCEPTION 'INVALID_SCAN_TOKEN: No active scan token found for this attachment. Token may have expired or already been consumed';
        END IF;
    END IF;

    -- 3. Atomically transition token to claimed state (preventing concurrent reuse)
    UPDATE public.attachment_scan_tokens
    SET claimed_at = clock_timestamp(),
        claimed_by_actor = v_actor_id
    WHERE token_id = v_token_id;

    RETURN QUERY SELECT
        v_att.attachment_id,
        v_att.disclosure_id,
        v_att.file_name,
        v_att.file_size_bytes,
        v_att.mime_type,
        v_att.sha256_hash,
        v_att.storage_path,
        v_token_id;
END;
$$;

ALTER FUNCTION public.get_attachment_upload_context_v1(JSONB, UUID) OWNER TO ipr_definer;
REVOKE ALL ON FUNCTION public.get_attachment_upload_context_v1(JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_attachment_upload_context_v1(JSONB, UUID) TO ipr_app;

-- ------------------------------------------------------------------------------
-- 6. Attachment Abandonment Gateway
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.abandon_attachment_v1(
    p_assertion JSONB,
    p_attachment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_att RECORD;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_ABANDON_ATTACHMENT');
    PERFORM auth_internal.verify_actor_any_role_context(v_actor_id, ARRAY['Student', 'Faculty']);

    -- 1. Row-level lock on target attachment to serialize with active scans / uploads
    -- Use NOWAIT to immediately reject if an active transaction holds the row lock
    BEGIN
        SELECT
            a.id AS attachment_id,
            a.disclosure_id,
            a.file_name,
            a.storage_path,
            a.scan_status,
            d.status AS disclosure_status,
            d.primary_inventor_id
        INTO v_att
        FROM public.attachments a
        JOIN public.disclosures d ON d.id = a.disclosure_id
        WHERE a.id = p_attachment_id
        FOR UPDATE OF a NOWAIT;
    EXCEPTION WHEN lock_not_available THEN
        RAISE EXCEPTION 'LOCK_CONFLICT: Attachment is actively being processed or scanned; cannot abandon while scan is in progress'
            USING ERRCODE = '55P03';
    END;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Attachment "%" does not exist', p_attachment_id;
    END IF;

    -- Actor must be the primary inventor of the associated disclosure
    IF v_att.primary_inventor_id != v_actor_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Only the primary inventor may abandon an attachment for this disclosure'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Attachments can only be abandoned on DRAFT disclosures
    IF v_att.disclosure_status != 'DRAFT' THEN
        RAISE EXCEPTION 'INVALID_STATE: Only attachments on DRAFT disclosures may be abandoned (current: %)', v_att.disclosure_status;
    END IF;

    -- Attachments bound as inventor signature evidence cannot be abandoned
    IF EXISTS (
        SELECT 1 FROM public.inventor_consents
        WHERE signature_evidence_id = p_attachment_id
    ) THEN
        RAISE EXCEPTION 'INVALID_STATE: Cannot abandon an attachment that is linked as inventor signature evidence';
    END IF;

    -- CLEAN attachments cannot be abandoned
    IF v_att.scan_status = 'CLEAN' THEN
        RAISE EXCEPTION 'INVALID_STATE: Successfully scanned CLEAN attachments cannot be abandoned'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Prevent redundant abandonment
    IF v_att.scan_status = 'ABANDONED' THEN
        RAISE EXCEPTION 'INVALID_STATE: Attachment is already abandoned';
    END IF;

    -- Only PENDING_SCAN, INFECTED, or SCAN_FAILED attachments may be abandoned
    IF v_att.scan_status NOT IN ('PENDING_SCAN', 'INFECTED', 'SCAN_FAILED') THEN
        RAISE EXCEPTION 'INVALID_STATE: Attachment with status "%" cannot be abandoned', v_att.scan_status;
    END IF;

    -- 2. Transition attachment status to ABANDONED (preserves record and audit trail)
    UPDATE public.attachments
    SET scan_status = 'ABANDONED',
        updated_at = clock_timestamp()
    WHERE id = p_attachment_id;

    -- 3. Expire active scan tokens to preserve single-use invariants
    UPDATE public.attachment_scan_tokens
    SET status = 'EXPIRED'
    WHERE attachment_id = p_attachment_id
      AND status = 'ACTIVE';

    -- 4. Emit traceable outbox event
    INSERT INTO public.outbox_messages (
        event_type, aggregate_type, aggregate_id, payload, created_at
    ) VALUES (
        'ATTACHMENT_ABANDONED',
        'ATTACHMENT',
        p_attachment_id,
        jsonb_build_object(
            'attachment_id', p_attachment_id,
            'disclosure_id', v_att.disclosure_id,
            'file_name', v_att.file_name,
            'storage_path', v_att.storage_path,
            'previous_scan_status', v_att.scan_status,
            'abandoned_by', v_actor_id,
            'abandoned_at', clock_timestamp()
        ),
        clock_timestamp()
    );
END;
$$;

ALTER FUNCTION public.abandon_attachment_v1(JSONB, UUID) OWNER TO ipr_definer;
REVOKE ALL ON FUNCTION public.abandon_attachment_v1(JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.abandon_attachment_v1(JSONB, UUID) TO ipr_app;

-- ------------------------------------------------------------------------------
-- 7. Updated Initial Disclosure Submission Gateway (Excludes ABANDONED)
-- ------------------------------------------------------------------------------
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

    -- 4. Validate Attachments and Antivirus Scan Cleanliness (Excludes ABANDONED)
    -- Must have at least one specification attachment; consent evidence attachments and ABANDONED attachments do NOT satisfy this requirement
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE a.scan_status != 'CLEAN')
    INTO v_spec_attachment_count, v_unclean_attachments
    FROM public.attachments a
    WHERE a.disclosure_id = p_disclosure_id
      AND a.scan_status != 'ABANDONED'
      AND NOT EXISTS (
          SELECT 1 FROM public.inventor_consents ic
          WHERE ic.signature_evidence_id = a.id
      );

    IF v_spec_attachment_count = 0 THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: At least one specification attachment is required for disclosure submission; consent evidence does not satisfy this requirement';
    END IF;

    -- Ensure ALL non-abandoned attachments belonging to this disclosure (specification and evidence) are clean
    IF EXISTS (
        SELECT 1 FROM public.attachments
        WHERE disclosure_id = p_disclosure_id
          AND scan_status != 'ABANDONED'
          AND scan_status != 'CLEAN'
    ) THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Cannot submit disclosure with pending, infected, or unscanned attachments';
    END IF;

    -- 5. Atomic Transactional Monthly Counter Allocation
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

    -- Cryptographically secure 3-character uppercase alphanumeric suffix [0-9A-Z] using gen_random_bytes
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
REVOKE ALL ON FUNCTION public.submit_initial_disclosure_v3(JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_initial_disclosure_v3(JSONB, UUID) TO ipr_app;
