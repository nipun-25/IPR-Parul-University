# Phase 3 Architecture Reconciliation — Current Parul University IPR Portal

**Project:** New Parul University IPR Portal (`D:\GitHub\IPR-Parul University`)  
**Date:** November 27, 2026  
**Scope:** Analysis-only architecture reconciliation against the actual `ipr_local_dev` database baseline and current repository state.  
**Legacy Reference Status:** Legacy analysis documents from `D:\GitHub\ipr-portal` have not yet been supplied in this session; legacy-specific columns and comparisons are explicitly marked `[PENDING LEGACY REPORT]` and separated from verified current-project facts.

> **Epistemic Tagging Legend**
> - **[VERIFIED FACT]:** Directly observed in `D:\GitHub\IPR-Parul University` source files, migrations, or the read-only `ipr_local_dev` schema baseline.
> - **[LEGACY-SOURCE FINDING]:** Reserved for details supplied by the legacy project's analysis reports (`[PENDING LEGACY REPORT]` until provided).
> - **[RECOMMENDATION]:** Proposed architectural or migration change preserving current security invariants.
> - **[ASSUMPTION]:** Explicit working assumption requiring confirmation before migration authoring.

---

## 1. Actual Current Database Inventory

**[VERIFIED FACT]** Confirmed read-only baseline for `ipr_local_dev` (PostgreSQL on port `5433`):
- **Applied migrations:** `001_roles_schemas.sql` through `010_disclosure_queries.sql`
- **Migration `011_consent_and_attachment_remediation.sql`:** **NOT applied** to `ipr_local_dev`
- **Physical tables:** **16** (`5` in `auth_internal`, `11` in `public`)
- **Custom application routines:** **37** (`14` in `auth_internal`, `23` in `public`)
- **`pgcrypto` extension functions in `public`:** **37** (total `74` functions in `pg_proc` across `public` and `auth_internal`)

### 1.1 Physical Tables (`auth_internal` Schema — 5 Tables)

| Table | Purpose | Key Constraints / Notes |
| :--- | :--- | :--- |
| `auth_internal.user_credentials` | Argon2id password hashes & lockout state | `CHECK (password_hash LIKE '$argon2id$%')`, `failed_login_attempts`, `locked_until` |
| `auth_internal.pending_registrations` | Unverified student signups (24h expiry) | `CHECK (email ~ '^[^@]+@paruluniversity[.]ac[.]in$')`, `CHECK (password_hash LIKE '$argon2id$%')` |
| `auth_internal.user_sessions` | Server-side session ledger | `session_token_hash` (SHA-256), `expires_at`, `revoked_at`, `last_seen_at` |
| `auth_internal.consumed_assertion_nonces` | Durable BFF HMAC replay protection | `nonce` PK, `consumed_at`, `expires_at` |
| `auth_internal.system_secrets` | BFF HMAC assertion verification key | Read by `ipr_definer` only |

### 1.2 Physical Tables (`public` Schema — 11 Tables)

| Table | Purpose | Key Columns & Structural Notes |
| :--- | :--- | :--- |
| `public.portal_users` | Institutional user accounts | `id`, `email` (unique lower), `full_name`, `roles TEXT[]`, `status` |
| `public.tracking_number_counters` | Monthly tracking number sequence | `period_key` (`YYYYMM`), `current_seq` |
| `public.disclosures` | Invention disclosures (PIDCS + workflow) | `tracking_number`, `title`, `status`, `primary_inventor_id`, `assigned_reviewer_id`, `review_status`, `legal_clearance_status`, `legal_cleared_by_id`, `legal_cleared_at`, `legal_clearance_notes`, `pidcs_data JSONB`, `submission_timestamp` |
| `public.attachments` | Uploaded specs & consent evidence metadata | `disclosure_id`, `file_name`, `file_size_bytes`, `mime_type`, `sha256_hash`, `storage_path`, `scan_status`, `scan_details`, `scanned_at`, `uploaded_by_id` |
| `public.attachment_scan_tokens` | Single-use AV scan claim tokens | `token_id`, `attachment_id`, `expected_storage_path`, `expected_sha256_hash`, `status`, `expires_at`, `consumed_at` |
| `public.inventor_consents` | Internal & external inventor consent + shares | `disclosure_id`, `user_id` (nullable), `is_external`, `external_name`, `external_email`, `external_organization`, `share_basis_points`, `status`, `signature_evidence_id`, `evidence_notes`, `verification_notes`, `verified_by_id`, `verified_at` |
| `public.patent_applications` | Patent dockets (1-to-many per disclosure) | `disclosure_id`, `current_stage`, `assigned_legal_officer_id`, `current_history_id`, `filing_date`, `application_number` |
| `public.patent_stage_history` | Append-only patent lifecycle history | `patent_application_id`, `from_stage`, `to_stage`, `transition_reason`, `transitioned_by_id`, `transitioned_at` |
| `public.patent_stage_allowed_transitions` | Seeded state-machine transition matrix | Composite PK `(from_stage, to_stage)` — 17 seeded transitions |
| `public.outbox_messages` | Immutable domain event ledger | `event_type`, `aggregate_type`, `aggregate_id`, `payload JSONB`, `created_at` |
| `public.outbox_tasks` | Transactional async worker task queue | `task_type`, `payload JSONB`, `status`, `priority`, `worker_id`, `lease_token`, `lease_expires_at`, `retry_count`, `max_retries`, `last_error` |

**Privilege Model (`006_grants_privileges.sql`):** **[VERIFIED FACT]** `ipr_app` has `REVOKE ALL PRIVILEGES` on all physical tables. All application reads and writes must pass through `SECURITY DEFINER` routines owned by `ipr_definer` after verifying a 9-element HMAC-SHA256 BFF assertion.

---

## 2. Existing Gateway Inventory

**[VERIFIED FACT]** All 37 custom routines currently installed in `ipr_local_dev` (`001`–`010`):

### 2.1 `auth_internal` Routines (14)

| Routine | Caller / Boundary | Purpose | Backend Wired? |
| :--- | :--- | :--- | :--- |
| `verify_and_consume_request_assertion_v1` | `public` gateways (`ipr_definer`) | Verifies 9-element HMAC BFF assertion, scope, & consumes nonce | Internal DB |
| `consume_assertion_nonce` | `auth_internal` | Helper for durable nonce consumption | Internal DB |
| `verify_actor_role_context` | `public` gateways | Asserts actor is `ACTIVE` and holds single required role | Internal DB |
| `verify_actor_any_role_context` | `public` gateways | Asserts actor is `ACTIVE` and holds any of allowed roles | Internal DB |
| `jsonb_merge_patch` | `update_draft_disclosure_v1` | RFC 7396 JSON Merge Patch for partial PIDCS updates | Internal DB |
| `secure_compare_hex_v2` | `auth_internal` | Constant-time hex string comparison | Internal DB |
| `create_pending_registration_v1` | `ipr_app` | Creates pending student registration (`@paruluniversity.ac.in`) | Yes (`POST /api/v1/auth/register`) |
| `reissue_pending_verification_token_v1` | `ipr_app` | Reissues email verification token with cooldown | Yes (`POST /api/v1/auth/resend-verification`) |
| `verify_student_registration_v1` | `ipr_app` | Promotes pending registration to `portal_users` + `user_credentials` | Yes (`POST /api/v1/auth/verify-email`) |
| `get_login_credentials_v1` | `ipr_app` | Fetches Argon2id hash & lockout metadata for login | Yes (`POST /api/v1/auth/login`) |
| `record_login_attempt_v1` | `ipr_app` | Records failed attempt / resets counter on success | Yes (`POST /api/v1/auth/login`) |
| `create_user_session_v1` | `ipr_app` | Creates server-side session token hash | Yes (`POST /api/v1/auth/login`) |
| `validate_user_session_v1` | `ipr_app` | Validates active session + returns user roles & profile | Yes (`GET /api/v1/auth/session` & BFF) |
| `revoke_user_session_v1` | `ipr_app` | Revokes session on logout | Yes (`POST /api/v1/auth/logout`) |

### 2.2 `public` Application Gateways (23)

| Routine | Execution Role | Scope | Backend Endpoint Wired? |
| :--- | :--- | :--- | :--- |
| `create_draft_disclosure_v1` | `ipr_app` | `OP_CREATE_DRAFT` | Yes (`POST /api/v1/drafts`) |
| `update_draft_disclosure_v1` | `ipr_app` | `OP_UPDATE_DRAFT` | Yes (`PATCH /api/v1/drafts/:id`) |
| `submit_initial_disclosure_v3` | `ipr_app` | `OP_SUBMIT_DISCLOSURE` | Yes (`POST /api/v1/drafts/:id/submit`) |
| `list_disclosures_v1` | `ipr_app` | `OP_VIEW_DISCLOSURE` | Yes (`GET /api/v1/disclosures`, `/reports/summary`, `/reports/export/disclosures.csv`) |
| `get_disclosure_v1` | `ipr_app` | `OP_VIEW_DISCLOSURE` | Yes (`GET /api/v1/disclosures/:id`) |
| `get_disclosure_consents_v1` | `ipr_app` | `OP_VIEW_DISCLOSURE` | Yes (`GET /api/v1/disclosures/:id/consents`) |
| `get_disclosure_attachments_v1` | `ipr_app` | `OP_VIEW_DISCLOSURE` | Yes (`GET /api/v1/disclosures/:id/attachments`) |
| `create_attachment_metadata_v1` | `ipr_app` | `OP_UPLOAD_ATTACHMENT` | Yes (`POST /api/v1/attachments`) |
| `get_attachment_metadata_v1` | `ipr_app` | `OP_VIEW_DISCLOSURE` | **No** (no standalone `GET /attachments/:id` route mounted) |
| `create_inventor_consent_request_v1` | `ipr_app` | `OP_CREATE_CONSENT` | Yes (`POST /api/v1/consent/request`) |
| `verify_inventor_consent_v1` | `ipr_app` | `OP_VERIFY_CONSENT` | Yes (`POST /api/v1/consent/verify`) |
| `revoke_inventor_consent_v1` | `ipr_app` | `OP_REVOKE_CONSENT` | Yes (`POST /api/v1/consent/revoke`) |
| `assign_disclosure_reviewer_v1` | `ipr_app` | `OP_ASSIGN_REVIEWER` | Yes (`POST /api/v1/disclosures/:id/assign-reviewer`) |
| `record_legal_clearance_v1` | `ipr_app` | `OP_LEGAL_CLEARANCE` | Yes (`POST /api/v1/disclosures/:id/legal-clearance`) |
| `create_patent_application_v1` | `ipr_app` | `OP_CREATE_PATENT_APPLICATION` | Yes (`POST /api/v1/patents`) |
| `assign_patent_legal_officer_v1` | `ipr_app` | `OP_ASSIGN_LEGAL_OFFICER` | **No** (BFF rule exists, backend route NOT mounted in `app.ts`) |
| `get_patent_application_v1` | `ipr_app` | `OP_VIEW_DISCLOSURE` | Yes (`GET /api/v1/patents/:id`) |
| `record_patent_stage_transition_v2` | `ipr_app` | `OP_TRANSITION_PATENT_STAGE` | Yes (`POST /api/v1/patents/:id/stage-transition`) |
| `record_antivirus_scan_result_v5` | `ipr_scanner` | Token-bound scanner | Yes (`AntivirusScannerService` via quarantine upload) |
| `claim_outbox_tasks_v1` | `ipr_worker` | Worker boundary | Worker-only (no HTTP endpoint) |
| `renew_outbox_task_lease_v1` | `ipr_worker` | Worker boundary | Worker-only (no HTTP endpoint) |
| `complete_outbox_task_v1` | `ipr_worker` | Worker boundary | Worker-only (no HTTP endpoint) |
| `fail_outbox_task_v1` | `ipr_worker` | Worker boundary | Worker-only (no HTTP endpoint) |

**Migration 011 Routines (Written in SQL file, NOT applied to `ipr_local_dev`):**
- `public.cancel_consent_invitation_v1` (Backend controller `cancelConsentInvitationHandler` & BFF rule exist, **will fail at runtime against `ipr_local_dev` until Migration 011 is applied**).
- `public.abandon_attachment_v1` (Backend controller `abandonAttachmentHandler` & BFF rule exist, **will fail at runtime against `ipr_local_dev` until Migration 011 is applied**).
- `public.submit_initial_disclosure_v4` (Updated submission check ignoring `ABANDONED` attachments; `app.ts` still calls `v3`).

---

## 3. Current Implementation Status by Role

| Role / Area | Genuinely Implemented (Live End-to-End) | Partially Implemented | Simulated / Preview Mode | Missing |
| :--- | :--- | :--- | :--- | :--- |
| **Auth & Public** | Student registration (`/register`), email verification (`/verify-email`), resend verification (`/resend-verification`), Argon2id login (`/login`), session check, logout | Account status page (`/account-status`) | — | Password reset backend (`/forgot-password`, `/reset-password` have UI pages only; no DB table/token/API) |
| **Student** | Dashboard, My Disclosures (with role-isolated search), Create Draft, Edit Draft (`PATCH`), View Disclosure, Co-inventor Consent Request & Revoke, Attachment Metadata + Quarantine Upload + AV Scan, Final Submission (`v3`) | Consent invitation cancellation & attachment abandonment (code wired, blocked on Migration 011 in DB); Notifications (live derived workflow feed, no read-receipt DB) | Clarifications (`/student/clarifications` — UI only) | Binary attachment download; persistent notification read receipts; academic affiliation fields |
| **Faculty** | Dashboard, Create Draft, My Disclosures + Drafts, View Disclosure (consents + attachments), Consent management | Consent verification page (`/faculty/consent` — note: DB `verify_inventor_consent_v1` restricts verification to `Administrator` only); Notifications (live derived feed) | — | Faculty-specific mentor/supervisor sign-off workflow (if distinct from co-inventor); binary attachment download |
| **Reviewer** | Dashboard (assigned queue), Assigned list, Read-only Disclosure Details (specs, consents, attachment metadata) | Evaluation (`/reviewer/evaluation` & inline rubric — client-side validation only) | Clarifications (`/reviewer/clarifications`), Comments, Recommendations, Pending, History | `record_reviewer_evaluation_v1` DB table & gateway; `disclosure_clarifications` DB table & gateway; Reviewer reminders/escalation |
| **Legal** | Dashboard (approved/submitted queue), Legal Clearance determination (`record_legal_clearance_v1`), Create Patent Docket (`create_patent_application_v1`), Patent Detail (`get_patent_application_v1`), Stage Transition (`record_patent_stage_transition_v2`), Reports & CSV Export | Patent Portfolio (`/legal/patents` — direct UUID lookup live, portfolio list uses mock data due to missing `list_patent_applications_v1`); Stage mismatch between DB matrix and UI dropdown | Documents (`/legal/documents`), Stages overview, History | `list_patent_applications_v1`; `assign_patent_legal_officer_v1` HTTP route; Form 1 statutory particulars; hearing scheduling; stage-wise messaging; multi-app UX |
| **Administrator** | Dashboard (live disclosure metrics), All Disclosures (campus-wide search), Assign Reviewer (`assign_disclosure_reviewer_v1`), Verify Inventor Consent (`verify_inventor_consent_v1`), Reports & CSV Export | Notifications (live derived feed) | Users (`/admin/users`), Roles (`/admin/roles`), Students/Faculty/Reviewers/Legal directories, Audit (`/admin/audit`), Patents (`/admin/patents`), Settings | Institutional user listing & role management DB gateways; `list_security_audit_events_v1` (`outbox_messages` reader); admin user provisioning API |

---

## 4. Legacy-to-Current Feature Mapping

> **Note:** `[PENDING LEGACY REPORT]` indicates legacy details awaiting supply of the legacy analysis documents from `D:\GitHub\ipr-portal`.

| Legacy Feature | Current Implementation | Gap | Proposed Solution |
| :--- | :--- | :--- | :--- |
| **Inventor identity vs. inventor consent** | `public.inventor_consents` separates `user_id` (internal `portal_users`) vs `is_external` + `external_name`/`email`/`organization`, and tracks consent `status` (`PENDING`, `VERIFIED`, `REVOKED`) + `signature_evidence_id`. External inventors do **not** require portal accounts. | `[PENDING LEGACY REPORT]` for legacy schema; in current app, `submit_initial_disclosure_v3` requires all consents `VERIFIED` by `Administrator` (unless updated by Migration 011). | Preserve `inventor_consents` separation; do not require portal accounts for external inventors; keep `Administrator`-only consent verification. |
| **Academic affiliation** | **Missing.** `portal_users` has only `id`, `email`, `full_name`, `roles`, `status`. `pidcs_data` JSONB schema (`BasePIDCSObjectSchema`) has no department, institute, enrollment/employee ID, or designation fields. | No structured storage for institute/faculty, department, or student/employee ID in `portal_users` or `inventor_consents`. | `[RECOMMENDATION]` Add nullable academic affiliation columns (`institute_name`, `department_name`, `institutional_id`, `designation`) to `portal_users` (and `external_*` / affiliation snapshot on `inventor_consents` if needed) via migration. |
| **Ownership shares & contribution** | `inventor_consents.share_basis_points` (integer `0..10000`) enforces exact 10,000 bps (100.00%) sum on final submission (`ProvisionalPIDCSSubmissionSnapshotSchema`). | No `contribution_role` or qualitative contribution description field; `[PENDING LEGACY REPORT]` on how legacy stored shares. | `[RECOMMENDATION]` Keep `share_basis_points` exact-sum invariant. **Do not generate equal ownership shares** for legacy records lacking shares — import as `0`/unallocated or flag for explicit inventor/admin allocation before submission. |
| **Reviewer evaluation & scoring** | **Missing in DB.** `disclosures` only has `assigned_reviewer_id` and `review_status` (`UNASSIGNED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`). Frontend `/reviewer/evaluation` runs in simulation mode. | No `reviewer_evaluations` table, no rubric scores (Novelty, Inventive Step, Industrial Applicability), no recommendation persistence, and no backend `/evaluate` controller. | `[RECOMMENDATION]` Add `public.reviewer_evaluations` table + `public.record_reviewer_evaluation_v1` & `public.get_disclosure_evaluations_v1` SECURITY DEFINER gateways + backend controller. |
| **Patent prosecution stages** | `public.patent_applications` + `public.patent_stage_history` + `public.patent_stage_allowed_transitions` exist and are wired to `record_patent_stage_transition_v2`. | **3-way stage naming mismatch** between DB (`PUBLICATION_PENDING`, `FIRST_EXAMINATION_REPORT`), `@ipr/shared` (`DRAFTING`, `FILED`, `EXAMINATION`, `HEARING`), and Legal UI (`PUBLISHED`, `FER_ISSUED`). | `[RECOMMENDATION]` Reconcile canonical stage vocabulary across DB matrix, `@ipr/shared`, and UI (see Section 7). |
| **Form 1 statutory particulars** | **Missing.** `BasePIDCSObjectSchema` only captures `title`, `abstract`, `fieldOfInvention`, `detailedDescription`, `commercialPotential`, `priorArtDetails`, `inventors`, `attachments`. | Missing Indian Patent Act Form 1 particulars (applicant category, natural person/startup/educational institution status, convention/PCT priority claims, biological material declaration, inventor addresses/nationality). | `[RECOMMENDATION]` Capture structured Form 1 metadata on `patent_applications` (e.g., `form1_data JSONB` or dedicated normalized columns) after legal validation (see Section 8). |
| **Stage-wise messaging / clarifications** | **Missing in DB.** `/student/clarifications` and `/reviewer/clarifications` use mock data. | No `disclosure_clarifications` or stage-wise `patent_communications` table or gateways. | `[RECOMMENDATION]` Add `public.disclosure_clarifications` (for pre-approval review) and/or `public.patent_stage_messages` (for prosecution correspondence) with scoped gateways. |
| **Hearing scheduling** | `HEARING_SCHEDULED` exists as a stage in `patent_stage_allowed_transitions`. | No hearing date/time, controller/examiner name, venue/video link, or hearing notice attachment binding. | `[RECOMMENDATION]` Add hearing metadata columns or `public.patent_hearings` table linked to `patent_applications` when lifecycle requirements are finalized. |
| **Notifications & read receipts** | **Missing in DB.** Frontend `/notifications` pages derive read-only workflow events from `list_disclosures_v1` + show pending migration banner. Email via `EmailService` (`iprcell@paruluniversity.ac.in`) is live for registration verification only. | No `user_notifications` table, no read/unread persistence, no `outbox_tasks` worker dispatching workflow emails. | `[RECOMMENDATION]` Add `public.user_notifications` table + `list_user_notifications_v1` & `mark_notification_read_v1` gateways, populated transactionally or by `ipr_worker`. |
| **MOU & prototype documents** | `public.attachments` supports `application/pdf`, `image/png`, `image/jpeg`, `application/zip` (max 25 MB) with ClamAV scan (`CLEAN`), but has no `document_category` / `attachment_type` column. | Cannot distinguish specification, consent evidence, MOU, prototype media, or Form 1/FER PDFs cleanly at the schema level. | `[RECOMMENDATION]` Add `document_category` (e.g., `SPECIFICATION`, `CONSENT_EVIDENCE`, `MOU`, `PROTOTYPE`, `PATENT_FILING`, `OTHER`) to `public.attachments`. |
| **Secure attachment downloads** | **Missing.** `get_disclosure_attachments_v1` and `get_attachment_metadata_v1` return metadata only (`storage_path` is stored, no download route exists). | Authorized users (inventors, assigned reviewers, legal officers, admins) cannot download `CLEAN` files through the app. | `[RECOMMENDATION]` Implement `GET /api/v1/attachments/:id/download` backed by a `SECURITY DEFINER` authorization check verifying `scan_status = 'CLEAN'` and disclosure/patent access before streaming from storage. |
| **Administrative audit logs** | `public.outbox_messages` records immutable domain events (`event_type`, `aggregate_type`, `aggregate_id`, `payload`), but `ipr_app` has `REVOKE ALL`. | Admins cannot query audit events; `/admin/audit` is in preview mode. | `[RECOMMENDATION]` Add `public.list_security_audit_events_v1(p_assertion, ...)` restricted to `Administrator` with pagination & event-type filtering. |
| **Reviewer escalation & reminders** | **Missing.** `outbox_tasks` infrastructure exists (`ipr_worker`), but no scheduled/SLA reminder tasks or escalation rules exist. | No SLA tracking (`review_due_at`) on `disclosures` and no `ipr_worker` handler dispatching reminder emails. | `[RECOMMENDATION]` Add `review_assigned_at` / `review_due_at` and schedule `outbox_tasks` reminders via `ipr_worker` + `EmailService`. |
| **Multiple patent applications per disclosure** | **Supported in DB (`002` & `005`).** `patent_applications.disclosure_id` is a non-unique FK; `create_patent_application_v1` only blocks concurrent duplicate `FILING_PREPARATION` dockets. | Frontend `/legal/filing` and `/legal/patents` lack UX for filing type (`PROVISIONAL`, `COMPLETE`, `PCT`, `DIVISIONAL`) and listing multiple dockets per disclosure. | `[RECOMMENDATION]` Add `application_type` & `parent_application_id` to `patent_applications`, plus `list_patent_applications_v1` gateway. |
| **Patent portfolio reporting** | `GET /api/v1/reports/summary` and `GET /api/v1/reports/export/disclosures.csv` are live for **disclosures** via `list_disclosures_v1`. | **Patent application** portfolio listing & reporting (`patent_applications` counts by stage, jurisdiction, filing date, CBR) is missing because `list_patent_applications_v1` does not exist. | `[RECOMMENDATION]` Add `list_patent_applications_v1` and a patent-level reporting gateway/export endpoint. |

---

## 5. Missing Database Entities and Relationships

**[RECOMMENDATION]** All additions must extend the existing schema naming (`portal_users`, `disclosures`, `inventor_consents`, `attachments`, `patent_applications`, `patent_stage_history`, `outbox_messages`, `outbox_tasks`) — **never** create duplicate tables such as `users`, `patents`, `stage_history`, or `transactional_outbox`.

1. **Extend existing tables (additive columns only):**
   - `public.portal_users`: `institute_name`, `department_name`, `institutional_id`, `designation` (nullable for backward compatibility).
   - `public.attachments`: `document_category VARCHAR(50) NOT NULL DEFAULT 'SPECIFICATION'` (covering `SPECIFICATION`, `CONSENT_EVIDENCE`, `MOU`, `PROTOTYPE`, `PATENT_FILING`, `HEARING_NOTICE`, `OTHER`).
   - `public.patent_applications`: `application_type VARCHAR(32)` (`PROVISIONAL`, `COMPLETE`, `PCT`, `DIVISIONAL`), `jurisdiction VARCHAR(64)`, `cbr_number VARCHAR(128)`, `form1_data JSONB`.
   - `public.disclosures`: `review_assigned_at TIMESTAMPTZ`, `review_due_at TIMESTAMPTZ`.

2. **New normalized tables required:**
   - `public.reviewer_evaluations` (`id`, `disclosure_id` FK &rarr; `disclosures`, `reviewer_id` FK &rarr; `portal_users`, `novelty_score`, `inventive_step_score`, `industrial_applicability_score`, `recommendation`, `detailed_remarks`, `created_at`).
   - `public.disclosure_clarifications` (`id`, `disclosure_id` FK &rarr; `disclosures`, `requested_by_id` FK &rarr; `portal_users`, `query_text`, `response_text`, `responded_by_id` FK &rarr; `portal_users`, `status`, `created_at`, `responded_at`).
   - `public.patent_stage_messages` (`id`, `patent_application_id` FK &rarr; `patent_applications`, `sender_id` FK &rarr; `portal_users`, `stage_at_send`, `message_text`, `attachment_id` FK &rarr; `attachments`, `created_at`).
   - `public.patent_hearings` (`id`, `patent_application_id` FK &rarr; `patent_applications`, `scheduled_at`, `controller_name`, `hearing_mode`, `meeting_link_or_venue`, `notice_attachment_id` FK &rarr; `attachments`, `outcome_notes`, `created_by_id` FK &rarr; `portal_users`, `created_at`).
   - `public.user_notifications` (`id`, `user_id` FK &rarr; `portal_users`, `event_type`, `title`, `message`, `aggregate_type`, `aggregate_id`, `is_read`, `read_at`, `created_at`).
   - `auth_internal.password_reset_tokens` (`id`, `user_id` FK &rarr; `portal_users`, `token_hash`, `expires_at`, `consumed_at`, `created_at`) — supports both forgot-password and legacy account activation.

---

## 6. Required Database Gateways

**[RECOMMENDATION]** All new gateways must be `SECURITY DEFINER` owned by `ipr_definer`, verify `auth_internal.verify_and_consume_request_assertion_v1(p_assertion, <SCOPE>)`, and grant `EXECUTE` only to `ipr_app` (or `ipr_worker` for background tasks):

1. **Remediation (already authored in Migration `011`, awaiting approval):**
   - `public.cancel_consent_invitation_v1`
   - `public.abandon_attachment_v1`
   - `public.submit_initial_disclosure_v4`
2. **Reviewer & Clarification Gateways:**
   - `public.record_reviewer_evaluation_v1(p_assertion, p_disclosure_id, p_novelty, p_inventive, p_applicability, p_recommendation, p_remarks)` (`OP_REVIEW_EVALUATION`)
   - `public.get_disclosure_evaluations_v1(p_assertion, p_disclosure_id)` (`OP_VIEW_DISCLOSURE`)
   - `public.create_clarification_query_v1` / `public.respond_clarification_query_v1` / `public.list_disclosure_clarifications_v1`
3. **Legal & Patent Portfolio Gateways:**
   - `public.list_patent_applications_v1(p_assertion, p_disclosure_id, p_stage, p_limit, p_offset)` (`OP_VIEW_DISCLOSURE` — returns all for `Administrator`, assigned-only for `Legal`, own-disclosure dockets for `Faculty`/`Student`)
   - `public.create_patent_stage_message_v1` / `public.list_patent_stage_messages_v1`
   - `public.schedule_patent_hearing_v1`
   - Wire existing `public.assign_patent_legal_officer_v1` in `app.ts`
4. **Attachments & Notifications:**
   - `public.authorize_attachment_download_v1(p_assertion, p_attachment_id)` (`OP_VIEW_DISCLOSURE` — enforces `scan_status = 'CLEAN'` and role/case access)
   - `public.list_user_notifications_v1(p_assertion, p_unread_only, p_limit, p_offset)` & `public.mark_notification_read_v1(p_assertion, p_notification_id)`
5. **Administration & Auth Recovery:**
   - `public.list_portal_users_v1(p_assertion, p_role, p_status, p_limit, p_offset)` (`Administrator`-only)
   - `public.list_security_audit_events_v1(p_assertion, p_event_type, p_aggregate_type, p_limit, p_offset)` (`Administrator`-only reader over `public.outbox_messages`)
   - `auth_internal.create_password_reset_token_v1` & `auth_internal.consume_password_reset_token_v1`

---

## 7. Patent Lifecycle Mapping

**[VERIFIED FACT]** Currently, there are **three conflicting stage vocabularies** in the repository:

| Lifecycle Phase | `002_foundational_tables.sql` (`patent_stage_allowed_transitions`) | `packages/shared/src/constants/stages.constants.ts` | `packages/frontend/src/app/legal/patents/[id]/page.tsx` |
| :--- | :--- | :--- | :--- |
| 1. Preparation | `FILING_PREPARATION` | `DRAFTING` | `FILING_PREPARATION` |
| 2. Filed / Formalities | `FORMALITIES_CHECK` | `FILED` | `FORMALITIES_CHECK` |
| 3. Publication | `PUBLICATION_PENDING` | *(omitted)* | `PUBLISHED` |
| 4. Exam Request | `EXAMINATION_REQUESTED` | `EXAMINATION` | `EXAMINATION_REQUESTED` |
| 5. FER Issued | `FIRST_EXAMINATION_REPORT` | *(omitted)* | `FER_ISSUED` |
| 6. Response | `RESPONSE_SUBMITTED` | *(omitted)* | `RESPONSE_SUBMITTED` |
| 7. Hearing | `HEARING_SCHEDULED` | `HEARING` | `HEARING_SCHEDULED` |
| 8. Terminal | `GRANTED`, `REJECTED`, `ABANDONED` | `GRANTED`, `REJECTED`, `ABANDONED` | `GRANTED`, `REJECTED`, `ABANDONED` |

**[RECOMMENDATION]** Standardize on the **authoritative database state machine** (`public.patent_stage_allowed_transitions` in `002_foundational_tables.sql`) as the single source of truth, and update `stages.constants.ts` and `legal/patents/[id]/page.tsx` in a future implementation phase to match `PUBLICATION_PENDING` and `FIRST_EXAMINATION_REPORT` (or explicitly migrate `patent_stage_allowed_transitions` if `PUBLISHED` / `FER_ISSUED` naming is preferred by Legal).

---

## 8. Form 1 Requirements and Unresolved Legal Validation

**[VERIFIED FACT]** Current `BasePIDCSObjectSchema` captures technical invention details (`title`, `abstract`, `fieldOfInvention`, `detailedDescription`, `commercialPotential`, `priorArtDetails`) and inventor shares (`shareBasisPoints`), but does **not** capture statutory Indian Patent Office **Form 1** fields.

**Missing Form 1 Particulars (`[RECOMMENDATION]` for `patent_applications.form1_data`):**
- **Applicant Particulars:** Parul University institutional applicant profile (Educational Institution category under Rule 2(ca) / Rule 7 fee slab), address for service in India, and registered patent agent details (if applicable).
- **Application Type & Priority:** Ordinary vs. Convention vs. PCT National Phase vs. Patent of Addition vs. Divisional (`application_type`, priority country/number/date).
- **Inventor Declarations:** Inventor nationality, residential address (required for Form 1 Item 4), and assignment/endorsement status (linked to verified `inventor_consents`).
- **Statutory Declarations (Form 1 Item 12):** Biological material declaration (NBA approval under Section 10(4)(d)(ii)), prior disclosure/exhibition grace period, and foreign filing status (Form 3).

**Unresolved Legal Validation:**
- Confirm with Parul University Legal/IPR Cell whether Form 1 data is required **at disclosure submission** or **at Legal Officer docketing (`FILING_PREPARATION` &rarr; `FORMALITIES_CHECK`)**.
- Confirm whether `inventor_consents` verification by `Administrator` satisfies Form 1 Item 12(i) declaration or if a separate signed Form 1 endorsement upload (`document_category = 'PATENT_FILING'`) is required.

---

## 9. Legacy Data Migration Approach

1. **Authentication & Argon2id Compatibility (`[VERIFIED FACT]` + `[RECOMMENDATION]`):**
   - `auth_internal.user_credentials.password_hash` enforces `CHECK (password_hash LIKE '$argon2id$%')`.
   - `AuthService.hashPassword` uses Argon2id (`memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`).
   - Legacy password hashes (if bcrypt/PBKDF2/SHA or unknown) **cannot** be inserted into `auth_internal.user_credentials`, and **must not** be replaced with fabricated hashes.
   - **Safe Activation/Reset Strategy:**
     1. Migrate legacy institutional users into `public.portal_users` with their verified email, `full_name`, and mapped `roles` (`Student`, `Faculty`, `Reviewer`, `Legal`, `Administrator`), leaving `auth_internal.user_credentials` unpopulated.
     2. Do **not** migrate legacy sessions or old verification/reset tokens.
     3. Provision `auth_internal.password_reset_tokens` + `/forgot-password` / `/activate-account` backend flow so migrated users click a one-time email activation link (sent via `iprcell@paruluniversity.ac.in`) to set a new password hashed with Argon2id.
2. **Ownership Shares (`inventor_consents.share_basis_points`):**
   - **Never auto-generate equal ownership shares** during migration. If legacy data lacks explicit percentage/basis-point allocations, migrate draft/historical records with `0` (for drafts) or require explicit administrative/inventor reconciliation before new patent docketing.
3. **Consent Verification & External Inventors:**
   - **Do not treat uploaded consent files as verified consent.** Preserve `status = 'PENDING'` unless legacy data has an explicit administrative verification record (`verified_by_id`, `verified_at`). Only `Administrator` may invoke `verify_inventor_consent_v1`.
   - External inventors must be migrated into `public.inventor_consents` with `is_external = TRUE` and `user_id = NULL` — **do not** create `portal_users` accounts for external inventors.
4. **Legacy Attachments & AV Scanning:**
   - Migrated historical attachments must not bypass `scan_status` integrity; legacy files must be scanned into quarantine before marking `CLEAN`, or explicitly tagged under a controlled migration audit state if pre-verified.

---

## 10. Proposed Migration Dependency Order

All schema changes remain **unapplied** pending explicit approval:

1. **Migration `011` (Existing, Pending Approval):** `011_consent_and_attachment_remediation.sql` (`cancel_consent_invitation_v1`, `abandon_attachment_v1`, `submit_initial_disclosure_v4`).
2. **Migration `012` (Auth Recovery & User Affiliation):** `auth_internal.password_reset_tokens` + `create/consume_password_reset_token_v1`; `portal_users` academic affiliation columns; `public.list_portal_users_v1`.
3. **Migration `013` (Attachments & Evaluation/Clarifications):** `attachments.document_category` + `authorize_attachment_download_v1`; `public.reviewer_evaluations` + `record_reviewer_evaluation_v1`; `public.disclosure_clarifications` + gateways; `disclosures` SLA columns.
4. **Migration `014` (Patent Prosecution Extensions & Portfolio Listing):** `patent_applications` Form 1 / type / CBR columns; `patent_stage_messages`; `patent_hearings`; `public.list_patent_applications_v1`; reconcile `patent_stage_allowed_transitions` if needed.
5. **Migration `015` (Notifications & Admin Audit Reader):** `public.user_notifications` + read/list gateways; `public.list_security_audit_events_v1` (read-only gateway over `public.outbox_messages`).

---

## 11. Unresolved Business and Technical Decisions

1. **Legacy Analysis Supply (`[PENDING LEGACY REPORT]`):** Confirm exact legacy table names, role names, password hash algorithm, and historical data volume once the legacy project reports are provided.
2. **Canonical Patent Stage Names:** Decide whether `PUBLICATION_PENDING` / `FIRST_EXAMINATION_REPORT` (DB) or `PUBLISHED` / `FER_ISSUED` (Legal UI) is the canonical stage vocabulary.
3. **Faculty Role vs. Consent Verification:** Confirm whether `Faculty` should ever verify student consents, or if `Administrator`-only verification (`verify_inventor_consent_v1`) remains the permanent institutional rule (requiring `/faculty/consent` UI adjustment).
4. **Form 1 Timing & Mandatory Fields:** Legal Cell confirmation on when Form 1 particulars become mandatory (`FILING_PREPARATION` vs `FORMALITIES_CHECK`).
5. **Attachment Binary Storage Backend:** Confirm production object storage (local volume vs S3-compatible store) for `authorize_attachment_download_v1` streaming.
6. **Legacy Unverified Consents & Missing Shares:** Governance decision on how legacy disclosures with missing ownership shares or unverified consent uploads should be quarantined or remediated prior to cutover.
