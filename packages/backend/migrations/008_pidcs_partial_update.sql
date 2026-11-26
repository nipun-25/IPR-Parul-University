-- ==============================================================================
-- Migration: 008_pidcs_partial_update.sql
-- Description: Implements RFC 7396 JSON Merge Patch semantics for draft disclosures
--              to prevent partial updates from overwriting omitted fields.
-- Author: Parul University IPR Portal Engineering
-- Security Context: Internal helper restricted to ipr_definer; gateway callable by ipr_app.
-- ==============================================================================

-- 1. RFC 7396 Recursive JSONB Merge Patch Helper
-- Strictly internal to auth_internal schema: not granted to ipr_app or PUBLIC.
CREATE OR REPLACE FUNCTION auth_internal.jsonb_merge_patch(target JSONB, patch JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth_internal, public, pg_temp
AS $$
DECLARE
    result JSONB;
    v_key TEXT;
    v_val JSONB;
BEGIN
    -- If patch is SQL NULL, preserve target unchanged
    IF patch IS NULL THEN
        RETURN target;
    END IF;

    -- If patch is not an object (e.g. array, primitive), patch replaces target
    IF jsonb_typeof(patch) != 'object' THEN
        RETURN patch;
    END IF;

    -- If target is not an object or is NULL, initialize empty object
    IF target IS NULL OR jsonb_typeof(target) != 'object' THEN
        result := '{}'::jsonb;
    ELSE
        result := target;
    END IF;

    -- Iterate through all key-value pairs in patch
    FOR v_key, v_val IN SELECT * FROM jsonb_each(patch)
    LOOP
        IF jsonb_typeof(v_val) = 'null' THEN
            -- RFC 7396: Explicit JSON null deletes/clears the property
            result := result - v_key;
        ELSIF jsonb_typeof(v_val) = 'object' AND jsonb_typeof(result->v_key) = 'object' THEN
            -- Sub-objects are merged recursively
            result := jsonb_set(
                result,
                ARRAY[v_key],
                auth_internal.jsonb_merge_patch(result->v_key, v_val)
            );
        ELSE
            -- Primitives, arrays, and type transitions are atomically replaced
            result := jsonb_set(result, ARRAY[v_key], v_val, true);
        END IF;
    END LOOP;

    RETURN result;
END;
$$;

-- Secure internal helper ownership and restrict execution
ALTER FUNCTION auth_internal.jsonb_merge_patch(JSONB, JSONB) OWNER TO ipr_definer;
REVOKE ALL ON FUNCTION auth_internal.jsonb_merge_patch(JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_internal.jsonb_merge_patch(JSONB, JSONB) TO ipr_definer;

-- 2. Update Draft Disclosure Gateway (V1)
-- Preserves existing signature, assertion verification, row locking, status checks,
-- authorization rules, and outbox event publishing, while using JSON Merge Patch for pidcs_data.
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
    -- 1. Cryptographic assertion validation and replay prevention
    v_actor_id := auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_UPDATE_DRAFT');
    PERFORM auth_internal.verify_actor_any_role_context(v_actor_id, ARRAY['Student', 'Faculty']);

    -- 2. Verify authoritative actor roles from portal_users
    SELECT roles INTO v_actor_roles
    FROM public.portal_users
    WHERE id = v_actor_id;

    -- 3. Row lock draft disclosure for atomic update serialization
    SELECT * INTO v_disclosure
    FROM public.disclosures
    WHERE id = p_disclosure_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Disclosure "%" does not exist', p_disclosure_id;
    END IF;

    -- 4. Enforce workflow state invariant: only DRAFT disclosures can be modified
    IF v_disclosure.status != 'DRAFT' THEN
        RAISE EXCEPTION 'INVALID_STATE: Only DRAFT disclosures can be updated (current: %)', v_disclosure.status;
    END IF;

    -- 5. Enforce ownership: only the primary inventor may modify the draft
    IF v_disclosure.primary_inventor_id != v_actor_id THEN
        RAISE EXCEPTION 'FORBIDDEN: Only primary inventor may update draft disclosure'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 6. Apply partial updates:
    --    - Title: COALESCE preserves old title if NULL passed
    --    - PIDCS Data: auth_internal.jsonb_merge_patch performs RFC 7396 merge patch
    UPDATE public.disclosures
    SET title = COALESCE(p_title, title),
        pidcs_data = auth_internal.jsonb_merge_patch(pidcs_data, p_pidcs_data),
        updated_at = clock_timestamp()
    WHERE id = p_disclosure_id;

    -- 7. Record transactional outbox event
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

-- Secure gateway ownership and grant execute to application role
ALTER FUNCTION public.update_draft_disclosure_v1(JSONB, UUID, VARCHAR, JSONB) OWNER TO ipr_definer;
REVOKE ALL ON FUNCTION public.update_draft_disclosure_v1(JSONB, UUID, VARCHAR, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_draft_disclosure_v1(JSONB, UUID, VARCHAR, JSONB) TO ipr_app;
