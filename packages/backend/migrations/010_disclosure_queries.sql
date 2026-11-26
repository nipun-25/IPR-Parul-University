-- ==============================================================================
-- Migration: 010_disclosure_queries.sql
-- Description: SECURITY DEFINER query routines for student disclosure workflows:
--              1. public.list_disclosures_v1(p_assertion JSONB)
--              2. public.get_disclosure_consents_v1(p_assertion JSONB, p_disclosure_id UUID)
--              3. public.get_disclosure_attachments_v1(p_assertion JSONB, p_disclosure_id UUID)
-- Database: PostgreSQL 19
-- Security Context: Restricted SECURITY DEFINER owned by ipr_definer; callable only by ipr_app.
-- Privilege Model: Enforces least privilege under REVOKE ALL PRIVILEGES ON ALL TABLES FROM ipr_app.
-- ==============================================================================

-- 1. Routine: public.list_disclosures_v1
-- Lists disclosures accessible to the caller verified via request assertion.
-- Scope: OP_VIEW_DISCLOSURE
-- Authorization:
--   - Administrator: can view all disclosures
--   - Reviewer: can view assigned disclosures or disclosures where they are inventor
--   - Student/Faculty: can view disclosures where they are primary inventor or co-inventor
--   - Legal Officer: can view disclosures tied to assigned patent applications

CREATE OR REPLACE FUNCTION public.list_disclosures_v1(
    p_assertion JSONB
)
RETURNS TABLE (
    out_id UUID,
    out_tracking_number VARCHAR(64),
    out_title VARCHAR(500),
    out_status VARCHAR(50),
    out_primary_inventor_id UUID,
    out_assigned_reviewer_id UUID,
    out_review_status VARCHAR(50),
    out_legal_clearance_status VARCHAR(50),
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
    v_user_status VARCHAR(50);
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_VIEW_DISCLOSURE');

    SELECT roles, status INTO v_roles, v_user_status
    FROM public.portal_users
    WHERE id = v_actor_id;

    IF NOT FOUND OR v_user_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'FORBIDDEN: Inactive or nonexistent user'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN QUERY
    SELECT
        d.id,
        d.tracking_number,
        d.title,
        d.status,
        d.primary_inventor_id,
        d.assigned_reviewer_id,
        d.review_status,
        d.legal_clearance_status,
        d.created_at,
        d.updated_at
    FROM public.disclosures d
    WHERE ('Administrator' = ANY(v_roles))
       OR (d.primary_inventor_id = v_actor_id)
       OR (d.assigned_reviewer_id = v_actor_id)
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
    ORDER BY d.created_at DESC;
END;
$$;

ALTER FUNCTION public.list_disclosures_v1(JSONB) OWNER TO ipr_definer;
REVOKE ALL ON FUNCTION public.list_disclosures_v1(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_disclosures_v1(JSONB) TO ipr_app;


-- 2. Routine: public.get_disclosure_consents_v1
-- Lists inventor consents for a target disclosure accessible to authorized actors.
-- Scope: OP_VIEW_DISCLOSURE
-- Authorization:
--   - Administrator: authorized
--   - Primary inventor: authorized
--   - Assigned Reviewer: authorized
--   - Consenting Co-inventor (PENDING or VERIFIED): authorized
--   - Assigned Legal Officer: authorized

CREATE OR REPLACE FUNCTION public.get_disclosure_consents_v1(
    p_assertion JSONB,
    p_disclosure_id UUID
)
RETURNS TABLE (
    out_id UUID,
    out_disclosure_id UUID,
    out_user_id UUID,
    out_is_external BOOLEAN,
    out_external_name VARCHAR(255),
    out_external_email VARCHAR(255),
    out_external_organization VARCHAR(255),
    out_share_basis_points INTEGER,
    out_status VARCHAR(50),
    out_signature_evidence_id UUID,
    out_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_roles TEXT[];
    v_user_status VARCHAR(50);
    v_disclosure RECORD;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_VIEW_DISCLOSURE');

    SELECT * INTO v_disclosure
    FROM public.disclosures
    WHERE id = p_disclosure_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Disclosure "%" does not exist', p_disclosure_id;
    END IF;

    SELECT roles, status INTO v_roles, v_user_status
    FROM public.portal_users
    WHERE id = v_actor_id;

    IF NOT FOUND OR v_user_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'FORBIDDEN: Inactive or nonexistent user'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF 'Administrator' = ANY(v_roles) THEN
        v_is_authorized := TRUE;
    ELSIF v_disclosure.primary_inventor_id = v_actor_id THEN
        v_is_authorized := TRUE;
    ELSIF v_disclosure.assigned_reviewer_id = v_actor_id THEN
        v_is_authorized := TRUE;
    ELSIF EXISTS (
        SELECT 1 FROM public.inventor_consents ic
        WHERE ic.disclosure_id = p_disclosure_id
          AND ic.user_id = v_actor_id
          AND ic.status IN ('PENDING', 'VERIFIED')
    ) THEN
        v_is_authorized := TRUE;
    ELSIF EXISTS (
        SELECT 1 FROM public.patent_applications pa
        WHERE pa.disclosure_id = p_disclosure_id
          AND pa.assigned_legal_officer_id = v_actor_id
    ) THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor not authorized to view consents for disclosure "%"', p_disclosure_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN QUERY
    SELECT
        ic.id,
        ic.disclosure_id,
        ic.user_id,
        ic.is_external,
        ic.external_name,
        ic.external_email,
        ic.external_organization,
        ic.share_basis_points,
        ic.status,
        ic.signature_evidence_id,
        ic.created_at
    FROM public.inventor_consents ic
    WHERE ic.disclosure_id = p_disclosure_id
    ORDER BY ic.created_at ASC;
END;
$$;

ALTER FUNCTION public.get_disclosure_consents_v1(JSONB, UUID) OWNER TO ipr_definer;
REVOKE ALL ON FUNCTION public.get_disclosure_consents_v1(JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_disclosure_consents_v1(JSONB, UUID) TO ipr_app;


-- 3. Routine: public.get_disclosure_attachments_v1
-- Lists attachment metadata for a target disclosure accessible to authorized actors.
-- Does NOT leak physical storage paths or raw scan details to unprivileged clients.
-- Scope: OP_VIEW_DISCLOSURE

CREATE OR REPLACE FUNCTION public.get_disclosure_attachments_v1(
    p_assertion JSONB,
    p_disclosure_id UUID
)
RETURNS TABLE (
    out_id UUID,
    out_disclosure_id UUID,
    out_file_name VARCHAR(255),
    out_file_size_bytes BIGINT,
    out_mime_type VARCHAR(128),
    out_sha256_hash VARCHAR(64),
    out_scan_status VARCHAR(50),
    out_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_roles TEXT[];
    v_user_status VARCHAR(50);
    v_disclosure RECORD;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_VIEW_DISCLOSURE');

    SELECT * INTO v_disclosure
    FROM public.disclosures
    WHERE id = p_disclosure_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Disclosure "%" does not exist', p_disclosure_id;
    END IF;

    SELECT roles, status INTO v_roles, v_user_status
    FROM public.portal_users
    WHERE id = v_actor_id;

    IF NOT FOUND OR v_user_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'FORBIDDEN: Inactive or nonexistent user'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF 'Administrator' = ANY(v_roles) THEN
        v_is_authorized := TRUE;
    ELSIF v_disclosure.primary_inventor_id = v_actor_id THEN
        v_is_authorized := TRUE;
    ELSIF v_disclosure.assigned_reviewer_id = v_actor_id THEN
        v_is_authorized := TRUE;
    ELSIF EXISTS (
        SELECT 1 FROM public.inventor_consents ic
        WHERE ic.disclosure_id = p_disclosure_id
          AND ic.user_id = v_actor_id
          AND ic.status IN ('PENDING', 'VERIFIED')
    ) THEN
        v_is_authorized := TRUE;
    ELSIF EXISTS (
        SELECT 1 FROM public.patent_applications pa
        WHERE pa.disclosure_id = p_disclosure_id
          AND pa.assigned_legal_officer_id = v_actor_id
    ) THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'FORBIDDEN: Actor not authorized to view attachments for disclosure "%"', p_disclosure_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        a.disclosure_id,
        a.file_name,
        a.file_size_bytes,
        a.mime_type,
        a.sha256_hash,
        a.scan_status,
        a.created_at
    FROM public.attachments a
    WHERE a.disclosure_id = p_disclosure_id
    ORDER BY a.created_at ASC;
END;
$$;

ALTER FUNCTION public.get_disclosure_attachments_v1(JSONB, UUID) OWNER TO ipr_definer;
REVOKE ALL ON FUNCTION public.get_disclosure_attachments_v1(JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_disclosure_attachments_v1(JSONB, UUID) TO ipr_app;
