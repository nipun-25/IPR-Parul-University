-- ==============================================================================
-- Migration: 006_grants_privileges.sql
-- Description: Institutional Grants, Execution Boundaries, and Least Privilege
-- Database: PostgreSQL 14+
-- ==============================================================================

-- 1. Dynamic Database-Level Access Lockdown
DO $$
BEGIN
    EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
END;
$$;

-- 2. Dedicated ipr_worker Role Creation & Boundary
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ipr_worker') THEN
        CREATE ROLE ipr_worker WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    ELSE
        ALTER ROLE ipr_worker WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END;
$$;

-- 3. Revoke All Table and Sequence DML from Runtime Roles
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, ipr_app, ipr_scanner, ipr_worker;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, ipr_app, ipr_scanner, ipr_worker;

-- 4. Revoke Public Execution on All Public & Internal Routines
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth_internal FROM PUBLIC;

-- 5. Exact Table Grants to ipr_definer
GRANT SELECT, INSERT, UPDATE ON TABLE public.portal_users TO ipr_definer;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tracking_number_counters TO ipr_definer;
GRANT SELECT, INSERT, UPDATE ON TABLE public.disclosures TO ipr_definer;
GRANT SELECT, INSERT, UPDATE ON TABLE public.attachments TO ipr_definer;
GRANT SELECT, INSERT, UPDATE ON TABLE public.inventor_consents TO ipr_definer;
GRANT SELECT, INSERT, UPDATE ON TABLE public.attachment_scan_tokens TO ipr_definer;
GRANT SELECT, INSERT, UPDATE ON TABLE public.patent_applications TO ipr_definer;
GRANT SELECT, INSERT, UPDATE ON TABLE public.patent_stage_history TO ipr_definer;
GRANT SELECT, INSERT, UPDATE ON TABLE public.outbox_messages TO ipr_definer;
GRANT SELECT, INSERT, UPDATE ON TABLE public.outbox_tasks TO ipr_definer;
GRANT SELECT ON TABLE public.patent_stage_allowed_transitions TO ipr_definer;

-- Allow ipr_app to read the static patent transition matrix
GRANT SELECT ON TABLE public.patent_stage_allowed_transitions TO ipr_app;

-- Auth Internal Table Grants to ipr_definer
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth_internal.consumed_assertion_nonces TO ipr_definer;
GRANT SELECT ON TABLE auth_internal.system_secrets TO ipr_definer;

-- 6. Sequence Grants to ipr_definer
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ipr_definer;

-- 7. Exact pgcrypto Execution Grants to ipr_definer
GRANT EXECUTE ON FUNCTION public.gen_random_uuid() TO ipr_definer;
GRANT EXECUTE ON FUNCTION public.gen_random_bytes(INTEGER) TO ipr_definer;
GRANT EXECUTE ON FUNCTION public.digest(BYTEA, TEXT) TO ipr_definer;
GRANT EXECUTE ON FUNCTION public.hmac(BYTEA, BYTEA, TEXT) TO ipr_definer;

-- 8. Scanner Execution Boundary
GRANT EXECUTE ON FUNCTION public.record_antivirus_scan_result_v5(UUID, UUID, VARCHAR, TEXT, VARCHAR, TEXT) TO ipr_scanner;
REVOKE ALL ON FUNCTION public.record_antivirus_scan_result_v5(UUID, UUID, VARCHAR, TEXT, VARCHAR, TEXT) FROM PUBLIC, ipr_app;

-- 9. Outbox Worker Execution Boundary
GRANT EXECUTE ON FUNCTION public.claim_outbox_tasks_v1(TEXT, INTEGER, INTEGER) TO ipr_worker;
REVOKE ALL ON FUNCTION public.claim_outbox_tasks_v1(TEXT, INTEGER, INTEGER) FROM PUBLIC, ipr_app;

GRANT EXECUTE ON FUNCTION public.renew_outbox_task_lease_v1(UUID, UUID, INTEGER) TO ipr_worker;
REVOKE ALL ON FUNCTION public.renew_outbox_task_lease_v1(UUID, UUID, INTEGER) FROM PUBLIC, ipr_app;

GRANT EXECUTE ON FUNCTION public.complete_outbox_task_v1(UUID, UUID) TO ipr_worker;
REVOKE ALL ON FUNCTION public.complete_outbox_task_v1(UUID, UUID) FROM PUBLIC, ipr_app;

GRANT EXECUTE ON FUNCTION public.fail_outbox_task_v1(UUID, UUID, TEXT) TO ipr_worker;
REVOKE ALL ON FUNCTION public.fail_outbox_task_v1(UUID, UUID, TEXT) FROM PUBLIC, ipr_app;

-- 10. Application Read Gateways Granted to ipr_app
GRANT EXECUTE ON FUNCTION public.get_disclosure_v1(JSONB, UUID) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.get_patent_application_v1(JSONB, UUID) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.get_attachment_metadata_v1(JSONB, UUID) TO ipr_app;

-- 11. Application Mutation Gateways Granted to ipr_app
GRANT EXECUTE ON FUNCTION public.submit_initial_disclosure_v3(JSONB, UUID) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.create_draft_disclosure_v1(JSONB, VARCHAR, JSONB) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.update_draft_disclosure_v1(JSONB, UUID, VARCHAR, JSONB) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.create_attachment_metadata_v1(JSONB, UUID, VARCHAR, BIGINT, VARCHAR, VARCHAR, TEXT) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.create_inventor_consent_request_v1(JSONB, UUID, INTEGER, UUID, BOOLEAN, TEXT, TEXT, TEXT) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.verify_inventor_consent_v1(JSONB, UUID, TEXT, UUID) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.revoke_inventor_consent_v1(JSONB, UUID) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.assign_disclosure_reviewer_v1(JSONB, UUID, UUID) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.record_legal_clearance_v1(JSONB, UUID, VARCHAR, TEXT) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.create_patent_application_v1(JSONB, UUID, UUID) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.assign_patent_legal_officer_v1(JSONB, UUID, UUID) TO ipr_app;
GRANT EXECUTE ON FUNCTION public.record_patent_stage_transition_v2(JSONB, UUID, VARCHAR, TEXT) TO ipr_app;

-- 12. Default Privileges for Future Tables and Sequences Created by ipr_admin
ALTER DEFAULT PRIVILEGES FOR ROLE ipr_admin IN SCHEMA public
    REVOKE ALL ON TABLES FROM PUBLIC, ipr_app, ipr_scanner, ipr_worker;

ALTER DEFAULT PRIVILEGES FOR ROLE ipr_admin IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM PUBLIC, ipr_app, ipr_scanner, ipr_worker;

ALTER DEFAULT PRIVILEGES FOR ROLE ipr_admin IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ipr_definer;

ALTER DEFAULT PRIVILEGES FOR ROLE ipr_admin IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO ipr_definer;
