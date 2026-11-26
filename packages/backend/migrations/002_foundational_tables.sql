-- ==============================================================================
-- Migration: 002_foundational_tables.sql
-- Description: Core relational schema tables, audit structures, and seed data
-- Database: PostgreSQL 14+
-- Gate: B1 SQL Migration Authoring (Security & Integrity Corrections)
-- ==============================================================================

-- 1. Portal Users (Institutional Accounts)
CREATE TABLE IF NOT EXISTS public.portal_users (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    roles TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.portal_users OWNER TO ipr_admin;

-- 2. Transactional Monthly Tracking Number Counters (B-2)
CREATE TABLE IF NOT EXISTS public.tracking_number_counters (
    period_key VARCHAR(6) PRIMARY KEY, -- Format: YYYYMM in UTC
    current_seq INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.tracking_number_counters OWNER TO ipr_admin;

-- 3. Inventions / Disclosures (With Reviewer & Legal Clearance Controls)
CREATE TABLE IF NOT EXISTS public.disclosures (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    tracking_number VARCHAR(64) NULL, -- Format: IPR-YYYYMMNNN-XXX
    title VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    primary_inventor_id UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE RESTRICT,
    assigned_reviewer_id UUID NULL REFERENCES public.portal_users(id) ON DELETE RESTRICT,
    review_status VARCHAR(50) NOT NULL DEFAULT 'UNASSIGNED',
    legal_clearance_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    legal_cleared_by_id UUID NULL REFERENCES public.portal_users(id) ON DELETE RESTRICT,
    legal_cleared_at TIMESTAMPTZ NULL,
    legal_clearance_notes TEXT NULL,
    pidcs_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    submission_timestamp TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.disclosures OWNER TO ipr_admin;

-- 4. Attachments (Uploaded Specifications & Evidence)
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    disclosure_id UUID NOT NULL REFERENCES public.disclosures(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    scan_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_SCAN',
    scan_details TEXT NULL,
    scanned_at TIMESTAMPTZ NULL,
    uploaded_by_id UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.attachments OWNER TO ipr_admin;

-- 5. Inventor Consents (Supports Internal & External Inventors with Evidence Binding)
CREATE TABLE IF NOT EXISTS public.inventor_consents (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    disclosure_id UUID NOT NULL REFERENCES public.disclosures(id) ON DELETE RESTRICT,
    user_id UUID NULL REFERENCES public.portal_users(id) ON DELETE RESTRICT, -- Institutional user account
    is_external BOOLEAN NOT NULL DEFAULT FALSE,
    external_name VARCHAR(255) NULL,
    external_email VARCHAR(255) NULL,
    external_organization VARCHAR(255) NULL,
    share_basis_points INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    signature_evidence_id UUID NULL REFERENCES public.attachments(id) ON DELETE RESTRICT,
    evidence_notes TEXT NULL,
    verification_notes TEXT NULL,
    verified_by_id UUID NULL REFERENCES public.portal_users(id) ON DELETE RESTRICT,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.inventor_consents OWNER TO ipr_admin;

-- 6. Attachment Single-Use Antivirus Scan Tokens (A-3 & Checksum Binding)
CREATE TABLE IF NOT EXISTS public.attachment_scan_tokens (
    token_id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    attachment_id UUID NOT NULL REFERENCES public.attachments(id) ON DELETE RESTRICT,
    expected_storage_path TEXT NOT NULL,
    expected_sha256_hash VARCHAR(64) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    consumed_by_session TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.attachment_scan_tokens OWNER TO ipr_admin;

-- 7. Patent Applications (Permits Multiple Patent Applications per Disclosure)
CREATE TABLE IF NOT EXISTS public.patent_applications (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    disclosure_id UUID NOT NULL REFERENCES public.disclosures(id) ON DELETE RESTRICT,
    current_stage VARCHAR(64) NOT NULL DEFAULT 'FILING_PREPARATION',
    assigned_legal_officer_id UUID NULL REFERENCES public.portal_users(id) ON DELETE RESTRICT,
    current_history_id UUID NULL,
    filing_date DATE NULL,
    application_number VARCHAR(128) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.patent_applications OWNER TO ipr_admin;

-- 8. Patent Stage History (Append-Only Lifecycle History)
CREATE TABLE IF NOT EXISTS public.patent_stage_history (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    patent_application_id UUID NOT NULL REFERENCES public.patent_applications(id) ON DELETE RESTRICT,
    from_stage VARCHAR(64) NULL,
    to_stage VARCHAR(64) NOT NULL,
    transition_reason TEXT NULL,
    transitioned_by_id UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE RESTRICT,
    transitioned_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.patent_stage_history OWNER TO ipr_admin;

-- 9. Patent Stage Allowed Transitions Matrix
CREATE TABLE IF NOT EXISTS public.patent_stage_allowed_transitions (
    from_stage VARCHAR(64) NOT NULL,
    to_stage VARCHAR(64) NOT NULL,
    PRIMARY KEY (from_stage, to_stage)
);
ALTER TABLE public.patent_stage_allowed_transitions OWNER TO ipr_admin;

-- Seed Allowed Transitions Matrix
INSERT INTO public.patent_stage_allowed_transitions (from_stage, to_stage) VALUES
    ('FILING_PREPARATION', 'FORMALITIES_CHECK'),
    ('FILING_PREPARATION', 'ABANDONED'),
    ('FORMALITIES_CHECK', 'PUBLICATION_PENDING'),
    ('FORMALITIES_CHECK', 'ABANDONED'),
    ('PUBLICATION_PENDING', 'EXAMINATION_REQUESTED'),
    ('PUBLICATION_PENDING', 'ABANDONED'),
    ('EXAMINATION_REQUESTED', 'FIRST_EXAMINATION_REPORT'),
    ('EXAMINATION_REQUESTED', 'ABANDONED'),
    ('FIRST_EXAMINATION_REPORT', 'RESPONSE_SUBMITTED'),
    ('FIRST_EXAMINATION_REPORT', 'ABANDONED'),
    ('RESPONSE_SUBMITTED', 'HEARING_SCHEDULED'),
    ('RESPONSE_SUBMITTED', 'GRANTED'),
    ('RESPONSE_SUBMITTED', 'REJECTED'),
    ('RESPONSE_SUBMITTED', 'ABANDONED'),
    ('HEARING_SCHEDULED', 'GRANTED'),
    ('HEARING_SCHEDULED', 'REJECTED'),
    ('HEARING_SCHEDULED', 'ABANDONED')
ON CONFLICT DO NOTHING;

-- 10. Outbox Messages (Events for Downstream Event-Driven Subscriptions)
CREATE TABLE IF NOT EXISTS public.outbox_messages (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    event_type VARCHAR(128) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.outbox_messages OWNER TO ipr_admin;

-- 11. Outbox Tasks (Transactional Queue for Background Workers with Leases)
CREATE TABLE IF NOT EXISTS public.outbox_tasks (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    task_type VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    priority INTEGER NOT NULL DEFAULT 0,
    worker_id TEXT NULL,
    lease_token UUID NULL,
    lease_expires_at TIMESTAMPTZ NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    last_error TEXT NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.outbox_tasks OWNER TO ipr_admin;

-- 12. Consumed Assertion Nonces (Durable Replay Protection Dual-Ledger)
CREATE TABLE IF NOT EXISTS auth_internal.consumed_assertion_nonces (
    nonce VARCHAR(128) PRIMARY KEY,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE auth_internal.consumed_assertion_nonces OWNER TO ipr_admin;

-- 13. System Secrets Storage (BFF HMAC Assertion Verification Key)
CREATE TABLE IF NOT EXISTS auth_internal.system_secrets (
    key_name VARCHAR(64) PRIMARY KEY,
    secret_key_hex VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE auth_internal.system_secrets OWNER TO ipr_admin;
