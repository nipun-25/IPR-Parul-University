import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Gate B1 SQL Migrations Static Verification', () => {
  const migrationsDir = path.resolve(__dirname, '../migrations');

  const expectedFiles = [
    '001_roles_schemas.sql',
    '002_foundational_tables.sql',
    '003_constraints_indexes.sql',
    '004_auth_internal_routines.sql',
    '005_institutional_gateways.sql',
    '006_grants_privileges.sql',
    '007_authentication.sql',
    '008_pidcs_partial_update.sql',
    '009_verification_resend.sql',
    '010_disclosure_queries.sql',
    '011_consent_and_attachment_remediation.sql'
  ];

  it('should contain all 11 required migration files in the expected order', () => {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    expect(files).toEqual(expectedFiles);
  });

  it('001_roles_schemas.sql: should define roles, schemas, extensions, dynamic database lockdown, and fail visibly on error', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '001_roles_schemas.sql'), 'utf-8');

    expect(content).toContain('ipr_admin');
    expect(content).toContain('ipr_definer');
    expect(content).toContain('ipr_app');
    expect(content).toContain('ipr_scanner');
    expect(content).toContain('ipr_worker');
    expect(content).toContain('CREATE SCHEMA IF NOT EXISTS auth_internal');
    expect(content).toContain('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    expect(content).toContain('REVOKE CREATE ON SCHEMA public FROM PUBLIC, ipr_app, ipr_scanner, ipr_worker');
    expect(content).toContain('GRANT USAGE ON SCHEMA public TO ipr_app, ipr_scanner, ipr_worker, ipr_definer');

    // Dynamic SQL for database-level grants/revokes
    expect(content).toContain('current_database()');
    expect(content).not.toContain('ON DATABASE CURRENT_DATABASE()');

    // Role membership grant without broad silent exception catch
    expect(content).toContain("GRANT ipr_admin, ipr_definer TO");
    expect(content).not.toContain('EXCEPTION WHEN OTHERS THEN');
  });

  it('002_foundational_tables.sql: should create all required relational tables with ipr_admin ownership, scanner bindings, and no hard deletes', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '002_foundational_tables.sql'), 'utf-8');

    const expectedTables = [
      'public.portal_users',
      'public.tracking_number_counters',
      'public.disclosures',
      'public.attachments',
      'public.inventor_consents',
      'public.attachment_scan_tokens',
      'public.patent_applications',
      'public.patent_stage_history',
      'public.patent_stage_allowed_transitions',
      'public.outbox_messages',
      'public.outbox_tasks',
      'auth_internal.consumed_assertion_nonces',
      'auth_internal.system_secrets',
    ];

    for (const table of expectedTables) {
      expect(content).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
      expect(content).toContain(`ALTER TABLE ${table} OWNER TO ipr_admin;`);
    }

    // Scanner token immutable binding columns
    expect(content).toContain('expected_storage_path');
    expect(content).toContain('expected_sha256_hash');

    // Reviewer/clearance columns and external inventor support
    expect(content).toContain('assigned_reviewer_id');
    expect(content).toContain('review_status');
    expect(content).toContain('legal_clearance_status');
    expect(content).toContain('is_external');
    expect(content).toContain('signature_evidence_id');

    // No hard deletes (no ON DELETE CASCADE)
    expect(content).not.toContain('ON DELETE CASCADE');
  });

  it('003_constraints_indexes.sql: should enforce composite FK (D-1), evidence uniqueness, and external/internal consent indexes (C-1)', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '003_constraints_indexes.sql'), 'utf-8');

    // D-1 composite key order and deferral
    expect(content).toContain('CONSTRAINT uq_patent_stage_history_composite UNIQUE (patent_application_id, id)');
    expect(content).toContain('CONSTRAINT fk_patent_current_history');
    expect(content).toContain('FOREIGN KEY (id, current_history_id)');
    expect(content).toContain('REFERENCES public.patent_stage_history (patent_application_id, id)');
    expect(content).toContain('DEFERRABLE INITIALLY DEFERRED');

    // Evidence uniqueness (prevents attachment sharing across multiple consents)
    expect(content).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_consent_signature_evidence');

    // C-1 partial unique indexes for internal and external inventors
    expect(content).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_internal_inventor_active_consent');
    expect(content).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_external_inventor_active_consent');
    expect(content).toContain("WHERE is_external = FALSE AND status IN ('PENDING', 'VERIFIED')");
    expect(content).toContain("WHERE is_external = TRUE AND status IN ('PENDING', 'VERIFIED')");

    // Replay protection index
    expect(content).toContain('idx_consumed_nonces_expires');
    expect(content).toContain('idx_outbox_tasks_claiming');
  });

  it('004_auth_internal_routines.sql: should implement truly constant-time comparison and cryptographic assertion verification', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '004_auth_internal_routines.sql'), 'utf-8');

    // Constant time comparison without early exit
    expect(content).toContain('auth_internal.secure_compare_hex_v2');
    expect(content).toContain('max_len');
    expect(content).toContain('FOR i IN 1..max_len LOOP');

    // Role assertions against portal_users
    expect(content).toContain('auth_internal.verify_actor_role_context');
    expect(content).toContain('auth_internal.verify_actor_any_role_context');
    expect(content).toContain('auth_internal.consume_assertion_nonce');

    // Cryptographic assertion verification
    expect(content).toContain('auth_internal.verify_and_consume_request_assertion_v1');
    expect(content).toContain('v_canonical_string');
    expect(content).toContain('public.hmac(');
    expect(content).toContain("WHERE key_name = 'bff_assertion_key'");

    // Definer security attributes
    expect(content).toContain('SECURITY DEFINER');
    expect(content).toContain('SET search_path = pg_catalog, auth_internal, public, pg_temp');
    expect(content).toContain('OWNER TO ipr_definer');
  });

  it('005_institutional_gateways.sql: should implement full mutation & read gateways, scanner integrity, and outbox recovery', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '005_institutional_gateways.sql'), 'utf-8');

    // Definer attributes
    expect(content).toContain('SECURITY DEFINER');
    expect(content).toContain('SET search_path = pg_catalog, auth_internal, public, pg_temp');
    expect(content).toContain('OWNER TO ipr_definer');

    // B-2: Tracking Number Allocation with UTC & gen_random_bytes
    expect(content).toContain('submit_initial_disclosure_v3');
    // Tracking number format & uppercase alphanumeric 36-char suffix generator (Requirement 7)
    expect(content).toContain("AT TIME ZONE 'UTC'");
    expect(content).toContain('gen_random_bytes(16)');
    expect(content).toContain('FOR UPDATE');
    expect(content).toContain('public.tracking_number_counters');
    expect(content).toContain('IPR-');
    expect(content).toContain("'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'");

    // Specification-category attachment requirement (Requirement 8)
    expect(content).toContain('v_spec_attachment_count');
    expect(content).toContain('consent evidence does not satisfy this requirement');

    // Authoritative Operation Scopes (Requirement 3: matching backend scope registry)
    expect(content).toContain('OP_SUBMIT_DISCLOSURE');
    expect(content).toContain('OP_CREATE_DRAFT');
    expect(content).toContain('OP_UPDATE_DRAFT');
    expect(content).toContain('OP_UPLOAD_ATTACHMENT');
    expect(content).toContain('OP_CREATE_CONSENT');
    expect(content).toContain('OP_VERIFY_CONSENT');
    expect(content).toContain('OP_REVOKE_CONSENT');
    expect(content).toContain('OP_ASSIGN_REVIEWER');
    expect(content).toContain('OP_LEGAL_CLEARANCE');
    expect(content).toContain('OP_CREATE_PATENT_APPLICATION');
    expect(content).toContain('OP_ASSIGN_LEGAL_OFFICER');
    expect(content).toContain('OP_TRANSITION_PATENT_STAGE');
    expect(content).toContain('OP_VIEW_DISCLOSURE');

    // Administrator least privilege checks (inventor drafting/submission restricted to Student & Faculty)
    expect(content).toMatch(/submit_initial_disclosure_v3[\s\S]*?ARRAY\['Student',\s*'Faculty'\]/);
    expect(content).toMatch(/create_draft_disclosure_v1[\s\S]*?ARRAY\['Student',\s*'Faculty'\]/);
    expect(content).toMatch(/update_draft_disclosure_v1[\s\S]*?ARRAY\['Student',\s*'Faculty'\]/);
    expect(content).toMatch(/assign_disclosure_reviewer_v1[\s\S]*?verify_actor_role_context\(v_actor_id,\s*'Administrator'\)/);
    expect(content).toMatch(/record_legal_clearance_v1[\s\S]*?verify_actor_role_context\(v_actor_id,\s*'Legal'\)/);
    expect(content).toMatch(/create_patent_application_v1[\s\S]*?ARRAY\['Administrator',\s*'Legal'\]/);
    expect(content).toContain("v_disclosure.legal_clearance_status != 'CLEARED'");
    expect(content).toContain("DUPLICATE_APPLICATION: An active patent application is already in FILING_PREPARATION");
    expect(content).toMatch(/assign_patent_legal_officer_v1[\s\S]*?verify_actor_role_context\(v_actor_id,\s*'Administrator'\)/);
    expect(content).toMatch(/record_patent_stage_transition_v2[\s\S]*?ARRAY\['Legal',\s*'Administrator'\]/);
    expect(content).toMatch(/record_patent_stage_transition_v2[\s\S]*?'Administrator'\s*=\s*ANY\(v_actor_roles\)[\s\S]*?'Legal'\s*=\s*ANY\(v_actor_roles\)/);

    // Missing mutation gateways
    expect(content).toContain('create_draft_disclosure_v1');
    expect(content).toContain('update_draft_disclosure_v1');
    expect(content).toContain('create_attachment_metadata_v1');
    expect(content).toContain('assign_patent_legal_officer_v1');

    // Restricted read gateways & Revoked co-inventor protection (Requirement 3 & 4)
    expect(content).toContain('get_disclosure_v1');
    expect(content).toContain('get_patent_application_v1');
    expect(content).toContain('get_attachment_metadata_v1');
    expect(content).toContain("AND status IN ('PENDING', 'VERIFIED')");
    expect(content).toContain('Actor not authorized to read attachments for disclosure');

    // Consent evidence binding and concurrency-safe verification (Requirement 5)
    expect(content).toContain('verify_inventor_consent_v1');
    expect(content).toContain('WHERE signature_evidence_id = p_evidence_attachment_id');
    expect(content).toContain('FOR UPDATE');

    // Scanner integrity: binds expected path and SHA256 checksum & PENDING_SCAN state (Requirement 6)
    expect(content).toContain('record_antivirus_scan_result_v5');
    expect(content).toContain("SESSION_USER != 'ipr_scanner'");
    expect(content).toContain('p_scanned_sha256');
    expect(content).toContain('p_scanned_storage_path');
    expect(content).toContain("v_attachment.scan_status != 'PENDING_SCAN'");

    // Outbox: dedicated worker execution boundary & bounded retries (Requirement 2 & 10)
    expect(content).toContain('claim_outbox_tasks_v1');
    expect(content).toContain("SESSION_USER != 'ipr_worker'");
    expect(content).toContain('out_task_id');
    expect(content).toContain('renew_outbox_task_lease_v1');
    expect(content).toContain('complete_outbox_task_v1');
    expect(content).toContain('fail_outbox_task_v1');
    expect(content).toContain('EXPIRED_LEASE_MAX_RETRIES_EXCEEDED');
  });

  it('006_grants_privileges.sql: should grant exact pgcrypto and table privileges to ipr_definer and enforce least privilege', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '006_grants_privileges.sql'), 'utf-8');

    // Dedicated ipr_worker role creation
    expect(content).toContain("CREATE ROLE ipr_worker");

    // Table DML strictly revoked from runtime roles
    expect(content).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, ipr_app, ipr_scanner, ipr_worker');
    expect(content).toContain('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, ipr_app, ipr_scanner, ipr_worker');

    // Exact table grants to ipr_definer
    expect(content).toContain('GRANT SELECT, INSERT, UPDATE ON TABLE');
    expect(content).toContain('TO ipr_definer;');

    // Exact pgcrypto execution grants to ipr_definer (Requirement 12)
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.gen_random_uuid() TO ipr_definer;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.gen_random_bytes(INTEGER) TO ipr_definer;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.digest(BYTEA, TEXT) TO ipr_definer;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.hmac(BYTEA, BYTEA, TEXT) TO ipr_definer;');

    // Scanner dedicated execution
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.record_antivirus_scan_result_v5(UUID, UUID, VARCHAR, TEXT, VARCHAR, TEXT) TO ipr_scanner');
    expect(content).toContain('REVOKE ALL ON FUNCTION public.record_antivirus_scan_result_v5(UUID, UUID, VARCHAR, TEXT, VARCHAR, TEXT) FROM PUBLIC, ipr_app');

    // Outbox worker dedicated execution boundary (Requirement 2)
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.claim_outbox_tasks_v1(TEXT, INTEGER, INTEGER) TO ipr_worker;');
    expect(content).toContain('REVOKE ALL ON FUNCTION public.claim_outbox_tasks_v1(TEXT, INTEGER, INTEGER) FROM PUBLIC, ipr_app;');

    // Read gateways granted to ipr_app
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.get_disclosure_v1(JSONB, UUID) TO ipr_app;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.get_patent_application_v1(JSONB, UUID) TO ipr_app;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.get_attachment_metadata_v1(JSONB, UUID) TO ipr_app;');

    // Dynamic database revocation
    expect(content).toContain('current_database()');
  });

  it('007_authentication.sql: should create credentials, pending registrations, and sessions with Argon2id and least-privilege grants', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '007_authentication.sql'), 'utf-8');

    // Tables and ipr_admin ownership
    expect(content).toContain('auth_internal.user_credentials');
    expect(content).toContain('auth_internal.pending_registrations');
    expect(content).toContain('auth_internal.user_sessions');
    expect(content).toContain('ALTER TABLE auth_internal.user_credentials OWNER TO ipr_admin;');
    expect(content).toContain('ALTER TABLE auth_internal.pending_registrations OWNER TO ipr_admin;');
    expect(content).toContain('ALTER TABLE auth_internal.user_sessions OWNER TO ipr_admin;');

    // Constraints: Argon2id hash and Parul email domain check
    expect(content).toContain("CHECK (password_hash LIKE '$argon2id$%')");
    expect(content).toContain("email ~ '^[^@]+@paruluniversity[.]ac[.]in$'");
    expect(content).toContain("CHECK (session_token_hash ~ '^[a-f0-9]{64}$')");

    // Account lockout logic
    expect(content).toContain("INTERVAL '15 minutes'");

    // Routine definitions and ownership by ipr_definer
    const routines = [
      'create_pending_registration_v1',
      'verify_student_registration_v1',
      'get_login_credentials_v1',
      'record_login_attempt_v1',
      'create_user_session_v1',
      'validate_user_session_v1',
      'revoke_user_session_v1',
    ];
    for (const routine of routines) {
      expect(content).toContain(`FUNCTION auth_internal.${routine}`);
      expect(content).toContain(`OWNER TO ipr_definer;`);
      expect(content).toContain(`GRANT EXECUTE ON FUNCTION auth_internal.${routine}`);
      expect(content).toContain(`TO ipr_app;`);
    }

    // Schema usage
    expect(content).toContain('GRANT USAGE ON SCHEMA auth_internal TO ipr_app;');
    expect(content).toContain('REVOKE CREATE ON SCHEMA auth_internal FROM ipr_definer;');
  });

  it('008_pidcs_partial_update.sql: should implement RFC 7396 JSON Merge Patch helper and update gateway with strict internal privileges', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '008_pidcs_partial_update.sql'), 'utf-8');

    // 1. JSON Merge Patch internal helper
    expect(content).toContain('FUNCTION auth_internal.jsonb_merge_patch(target JSONB, patch JSONB)');
    expect(content).toContain('SECURITY DEFINER');
    expect(content).toContain('SET search_path = pg_catalog, auth_internal, public, pg_temp');
    expect(content).toContain('OWNER TO ipr_definer;');
    expect(content).toContain('REVOKE ALL ON FUNCTION auth_internal.jsonb_merge_patch(JSONB, JSONB) FROM PUBLIC;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION auth_internal.jsonb_merge_patch(JSONB, JSONB) TO ipr_definer;');

    // Verify ipr_app is NOT granted execute on internal helper
    expect(content).not.toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+auth_internal\.jsonb_merge_patch[^\n;]*TO\s+ipr_app/i);

    // 2. Gateway function definition and privileges
    expect(content).toContain('FUNCTION public.update_draft_disclosure_v1');
    expect(content).toContain('auth_internal.jsonb_merge_patch(pidcs_data, p_pidcs_data)');
    expect(content).toContain('OWNER TO ipr_definer;');
    expect(content).toContain('REVOKE ALL ON FUNCTION public.update_draft_disclosure_v1(JSONB, UUID, VARCHAR, JSONB) FROM PUBLIC;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.update_draft_disclosure_v1(JSONB, UUID, VARCHAR, JSONB) TO ipr_app;');

    // 3. Row lock, invariants, outbox event
    expect(content).toContain('FOR UPDATE');
    expect(content).toContain('INVALID_STATE');
    expect(content).toContain('FORBIDDEN');
    expect(content).toContain('DISCLOSURE_DRAFT_UPDATED');
  });

  it('009_verification_resend.sql: should extend pending_registrations and implement secure reissue routine', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '009_verification_resend.sql'), 'utf-8');

    // 1. Column additions with defaults
    expect(content).toContain('ADD COLUMN IF NOT EXISTS last_resend_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()');
    expect(content).toContain('ADD COLUMN IF NOT EXISTS resend_count INTEGER NOT NULL DEFAULT 0');

    // 2. Gateway function definition and privileges
    expect(content).toContain('FUNCTION auth_internal.reissue_pending_verification_token_v1');
    expect(content).toContain('SECURITY DEFINER');
    expect(content).toContain('SET search_path = pg_catalog, auth_internal, public, pg_temp');
    expect(content).toContain('OWNER TO ipr_definer;');
    expect(content).toContain('REVOKE ALL ON FUNCTION auth_internal.reissue_pending_verification_token_v1(VARCHAR, VARCHAR, TIMESTAMPTZ, INTEGER) FROM PUBLIC;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION auth_internal.reissue_pending_verification_token_v1(VARCHAR, VARCHAR, TIMESTAMPTZ, INTEGER) TO ipr_app;');

    // 3. Security controls
    expect(content).toContain('FOR UPDATE');
    expect(content).toContain('v_effective_cooldown');
    expect(content).toContain('clock_timestamp() < v_registration.last_resend_at');
    expect(content).toContain('INVALID_STUDENT_EMAIL');
    expect(content).toContain('INVALID_VERIFICATION_TOKEN_HASH');
    expect(content).toContain('reissued BOOLEAN');

    // Verify ipr_app is NOT granted table access
    expect(content).not.toMatch(/GRANT\s+(SELECT|INSERT|UPDATE|DELETE)\s+ON\s+auth_internal\.pending_registrations[^\n;]*TO\s+ipr_app/i);
  });

  it('010_disclosure_queries.sql: should define SECURITY DEFINER query routines with least privilege', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '010_disclosure_queries.sql'), 'utf-8');

    // 1. Routine definitions
    expect(content).toContain('FUNCTION public.list_disclosures_v1');
    expect(content).toContain('FUNCTION public.get_disclosure_consents_v1');
    expect(content).toContain('FUNCTION public.get_disclosure_attachments_v1');

    // 2. Security execution context
    expect(content).toContain('SECURITY DEFINER');
    expect(content).toContain('SET search_path = pg_catalog, auth_internal, public, pg_temp');
    expect(content).toContain('auth_internal.verify_and_consume_request_assertion_v1(p_assertion, \'OP_VIEW_DISCLOSURE\')');

    // 3. Ownership and explicit privilege grants
    expect(content).toContain('ALTER FUNCTION public.list_disclosures_v1(JSONB) OWNER TO ipr_definer;');
    expect(content).toContain('REVOKE ALL ON FUNCTION public.list_disclosures_v1(JSONB) FROM PUBLIC;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.list_disclosures_v1(JSONB) TO ipr_app;');

    expect(content).toContain('ALTER FUNCTION public.get_disclosure_consents_v1(JSONB, UUID) OWNER TO ipr_definer;');
    expect(content).toContain('REVOKE ALL ON FUNCTION public.get_disclosure_consents_v1(JSONB, UUID) FROM PUBLIC;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.get_disclosure_consents_v1(JSONB, UUID) TO ipr_app;');

    expect(content).toContain('ALTER FUNCTION public.get_disclosure_attachments_v1(JSONB, UUID) OWNER TO ipr_definer;');
    expect(content).toContain('REVOKE ALL ON FUNCTION public.get_disclosure_attachments_v1(JSONB, UUID) FROM PUBLIC;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.get_disclosure_attachments_v1(JSONB, UUID) TO ipr_app;');

    // 4. Strict least privilege verification: no direct table grants
    expect(content).not.toMatch(/GRANT\s+(SELECT|INSERT|UPDATE|DELETE)\s+ON\s+TABLE/i);
    expect(content).not.toMatch(/GRANT\s+ALL\s+ON\s+ALL\s+TABLES/i);
  });

  it('011_consent_and_attachment_remediation.sql: should define cancellation and attachment upload context gateways with least privilege', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '011_consent_and_attachment_remediation.sql'), 'utf-8');

    // 1. Constraint expansion to CANCELLED and ABANDONED
    expect(content).toContain('chk_inventor_consents_status');
    expect(content).toContain("'CANCELLED'");
    expect(content).toContain('chk_attachments_scan_status');
    expect(content).toContain("'ABANDONED'");

    // 2. Gateway functions
    expect(content).toContain('FUNCTION public.cancel_consent_invitation_v1');
    expect(content).toContain('FUNCTION public.get_attachment_upload_context_v1');
    expect(content).toContain('FUNCTION public.abandon_attachment_v1');
    expect(content).toContain('FUNCTION public.submit_initial_disclosure_v3');

    // 3. Security context
    expect(content).toContain('SECURITY DEFINER');
    expect(content).toContain('SET search_path = pg_catalog, auth_internal, public, pg_temp');
    expect(content).toContain("auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_CANCEL_CONSENT_INVITATION')");
    expect(content).toContain("auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_UPLOAD_ATTACHMENT')");
    expect(content).toContain("auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_ABANDON_ATTACHMENT')");
    expect(content).toContain("auth_internal.verify_and_consume_request_assertion_v1(p_assertion, 'OP_SUBMIT_DISCLOSURE')");

    // 4. Ownership and grants
    expect(content).toContain('ALTER FUNCTION public.cancel_consent_invitation_v1(JSONB, UUID) OWNER TO ipr_definer;');
    expect(content).toContain('REVOKE ALL ON FUNCTION public.cancel_consent_invitation_v1(JSONB, UUID) FROM PUBLIC;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.cancel_consent_invitation_v1(JSONB, UUID) TO ipr_app;');

    expect(content).toContain('ALTER FUNCTION public.get_attachment_upload_context_v1(JSONB, UUID) OWNER TO ipr_definer;');
    expect(content).toContain('REVOKE ALL ON FUNCTION public.get_attachment_upload_context_v1(JSONB, UUID) FROM PUBLIC;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.get_attachment_upload_context_v1(JSONB, UUID) TO ipr_app;');

    expect(content).toContain('ALTER FUNCTION public.abandon_attachment_v1(JSONB, UUID) OWNER TO ipr_definer;');
    expect(content).toContain('REVOKE ALL ON FUNCTION public.abandon_attachment_v1(JSONB, UUID) FROM PUBLIC;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.abandon_attachment_v1(JSONB, UUID) TO ipr_app;');

    expect(content).toContain('ALTER FUNCTION public.submit_initial_disclosure_v3(JSONB, UUID) OWNER TO ipr_definer;');
    expect(content).toContain('REVOKE ALL ON FUNCTION public.submit_initial_disclosure_v3(JSONB, UUID) FROM PUBLIC;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.submit_initial_disclosure_v3(JSONB, UUID) TO ipr_app;');

    // 5. Strict least privilege verification: no direct table grants to ipr_app
    expect(content).not.toMatch(/GRANT\s+(SELECT|INSERT|UPDATE|DELETE)\s+ON\s+TABLE[^\n;]*TO\s+ipr_app/i);
    expect(content).not.toMatch(/GRANT\s+ALL\s+ON\s+ALL\s+TABLES/i);
  });

  it('should ensure balanced dollar quotes and delimiters in all migration files', () => {
    for (const filename of expectedFiles) {
      const content = fs.readFileSync(path.join(migrationsDir, filename), 'utf-8');
      const matches = content.match(/\$\$/g);
      if (matches) {
        expect(matches.length % 2).toBe(0);
      }
    }
  });

  it('should ensure function signature arguments in ALTER and GRANT statements do not contain type modifiers', () => {
    for (const filename of expectedFiles) {
      const content = fs.readFileSync(path.join(migrationsDir, filename), 'utf-8');
      const modifierPattern = /(ALTER|GRANT|REVOKE)\s+(EXECUTE\s+ON\s+)?FUNCTION\s+[^;]*?\([^;]*?VARCHAR\(\d+\)[^;]*?\)/i;
      expect(content).not.toMatch(modifierPattern);
    }
  });
});
