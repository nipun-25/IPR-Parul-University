-- ==============================================================================
-- Migration: 003_constraints_indexes.sql
-- Description: Table constraints, indexes, composite keys, and lifecycle rules
-- Database: PostgreSQL 14+
-- Gate: B1 SQL Migration Authoring (Security & Integrity Corrections)
-- ==============================================================================

-- 1. Portal Users Constraints & Indexes
ALTER TABLE public.portal_users
    ADD CONSTRAINT uq_portal_users_email UNIQUE (email),
    ADD CONSTRAINT chk_portal_users_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED'));

CREATE INDEX IF NOT EXISTS idx_portal_users_status ON public.portal_users (status);

-- 2. Disclosures Constraints & Indexes
ALTER TABLE public.disclosures
    ADD CONSTRAINT uq_disclosures_tracking_number UNIQUE (tracking_number),
    ADD CONSTRAINT chk_disclosures_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'REJECTED', 'APPROVED')),
    ADD CONSTRAINT chk_disclosures_review_status CHECK (review_status IN ('UNASSIGNED', 'ASSIGNED', 'UNDER_REVIEW', 'COMPLETED')),
    ADD CONSTRAINT chk_disclosures_legal_clearance CHECK (legal_clearance_status IN ('PENDING', 'CLEARED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS idx_disclosures_primary_inventor ON public.disclosures (primary_inventor_id);
CREATE INDEX IF NOT EXISTS idx_disclosures_reviewer ON public.disclosures (assigned_reviewer_id);
CREATE INDEX IF NOT EXISTS idx_disclosures_status ON public.disclosures (status);
CREATE INDEX IF NOT EXISTS idx_disclosures_legal_clearance ON public.disclosures (legal_clearance_status);
CREATE INDEX IF NOT EXISTS idx_disclosures_tracking_number ON public.disclosures (tracking_number) WHERE tracking_number IS NOT NULL;

-- 3. Inventor Consents Constraints & Partial Unique Indexes (C-1 & Evidence Binding)
ALTER TABLE public.inventor_consents
    ADD CONSTRAINT chk_inventor_consents_status CHECK (status IN ('PENDING', 'VERIFIED', 'REVOKED', 'EXPIRED', 'SUPERSEDED')),
    ADD CONSTRAINT chk_inventor_consents_share CHECK (share_basis_points > 0 AND share_basis_points <= 10000),
    ADD CONSTRAINT chk_inventor_identity CHECK (
        (is_external = FALSE AND user_id IS NOT NULL) OR
        (is_external = TRUE AND external_name IS NOT NULL AND external_email IS NOT NULL)
    );

-- Separate partial unique indexes for institutional users vs external inventors
-- Guarantees at most one active (PENDING or VERIFIED) consent per inventor per disclosure
CREATE UNIQUE INDEX IF NOT EXISTS uq_internal_inventor_active_consent
    ON public.inventor_consents (disclosure_id, user_id)
    WHERE is_external = FALSE AND status IN ('PENDING', 'VERIFIED');

CREATE UNIQUE INDEX IF NOT EXISTS uq_external_inventor_active_consent
    ON public.inventor_consents (disclosure_id, lower(external_email))
    WHERE is_external = TRUE AND status IN ('PENDING', 'VERIFIED');

-- Fix: Bind signature evidence to the specific consent/inventor; prevents evidence reuse across inventors
CREATE UNIQUE INDEX IF NOT EXISTS uq_consent_signature_evidence
    ON public.inventor_consents (signature_evidence_id)
    WHERE signature_evidence_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventor_consents_disclosure ON public.inventor_consents (disclosure_id);
CREATE INDEX IF NOT EXISTS idx_inventor_consents_user ON public.inventor_consents (user_id);
CREATE INDEX IF NOT EXISTS idx_inventor_consents_evidence ON public.inventor_consents (signature_evidence_id);

-- 4. Attachments Constraints & Indexes
ALTER TABLE public.attachments
    ADD CONSTRAINT chk_attachments_scan_status CHECK (scan_status IN ('PENDING_SCAN', 'CLEAN', 'INFECTED', 'SCAN_FAILED')),
    ADD CONSTRAINT chk_attachments_file_size CHECK (file_size_bytes > 0);

CREATE INDEX IF NOT EXISTS idx_attachments_disclosure ON public.attachments (disclosure_id);
CREATE INDEX IF NOT EXISTS idx_attachments_scan_status ON public.attachments (scan_status);

-- 5. Attachment Scan Tokens Constraints & Indexes (A-3)
ALTER TABLE public.attachment_scan_tokens
    ADD CONSTRAINT chk_scan_tokens_status CHECK (status IN ('ACTIVE', 'CONSUMED', 'EXPIRED'));

CREATE INDEX IF NOT EXISTS idx_attachment_scan_tokens_lookup
    ON public.attachment_scan_tokens (token_id, status, expires_at);

-- 6. Patent Stage History Composite Unique Key (D-1)
-- Target composite unique constraint MUST be created on target table BEFORE the composite foreign key references it!
ALTER TABLE public.patent_stage_history
    ADD CONSTRAINT uq_patent_stage_history_composite UNIQUE (patent_application_id, id);

CREATE INDEX IF NOT EXISTS idx_patent_stage_history_app_date
    ON public.patent_stage_history (patent_application_id, transitioned_at DESC);

-- 7. Patent Applications Constraints & Composite Foreign Key (D-1)
ALTER TABLE public.patent_applications
    ADD CONSTRAINT chk_patent_applications_stage CHECK (
        current_stage IN (
            'FILING_PREPARATION',
            'FORMALITIES_CHECK',
            'PUBLICATION_PENDING',
            'EXAMINATION_REQUESTED',
            'FIRST_EXAMINATION_REPORT',
            'RESPONSE_SUBMITTED',
            'HEARING_SCHEDULED',
            'GRANTED',
            'REJECTED',
            'ABANDONED'
        )
    ),
    -- Deferrable composite foreign key ensures current_history_id belongs to this exact patent application
    ADD CONSTRAINT fk_patent_current_history
        FOREIGN KEY (id, current_history_id)
        REFERENCES public.patent_stage_history (patent_application_id, id)
        DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_patent_applications_disclosure
    ON public.patent_applications (disclosure_id);
CREATE INDEX IF NOT EXISTS idx_patent_applications_legal_officer
    ON public.patent_applications (assigned_legal_officer_id);
CREATE INDEX IF NOT EXISTS idx_patent_applications_stage
    ON public.patent_applications (current_stage);

-- 8. Outbox Messages & Tasks Indexes (F-1)
CREATE INDEX IF NOT EXISTS idx_outbox_messages_created
    ON public.outbox_messages (created_at ASC);

ALTER TABLE public.outbox_tasks
    ADD CONSTRAINT chk_outbox_tasks_status CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD_LETTER')),
    ADD CONSTRAINT chk_outbox_tasks_priority CHECK (priority >= 0);

-- Partial index optimized for outbox worker batch claiming with SKIP LOCKED
CREATE INDEX IF NOT EXISTS idx_outbox_tasks_claiming
    ON public.outbox_tasks (priority DESC, created_at ASC)
    WHERE status IN ('PENDING', 'RUNNING');

-- 9. Replay Protection Nonces Index
CREATE INDEX IF NOT EXISTS idx_consumed_nonces_expires
    ON auth_internal.consumed_assertion_nonces (expires_at);
