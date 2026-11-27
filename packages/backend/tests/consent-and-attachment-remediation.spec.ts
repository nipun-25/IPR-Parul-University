import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import {
  InMemoryNonceStore,
  InMemoryQuarantineStorage,
  computeSha256,
  signCanonicalAssertion,
  buildCanonicalAssertionString,
  OperationScope
} from '@ipr/shared';
import { createApp } from '../src/app.js';
import type { BackendEnv } from '../src/config/env.config.js';
import { AntivirusScannerService } from '../src/services/scanner.service.js';

describe('Stage 2G.7 — Student Portal E2E Defect Remediation Tests', () => {
  const secretHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let nonceStore: InMemoryNonceStore;
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockScannerPool: { query: ReturnType<typeof vi.fn> };
  let quarantineStorage: InMemoryQuarantineStorage;
  let scannerService: AntivirusScannerService;
  let app: ReturnType<typeof createApp>;

  const testEnv: BackendEnv = {
    NODE_ENV: 'test',
    PORT: 4003,
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    BFF_SHARED_SECRET: secretHex,
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_NAME: 'ipr_test',
    DB_USER: 'ipr_app',
    DB_PASSWORD: 'secret',
    DB_SSL: false,
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 587,
    SMTP_USER: 'test@example.com',
    SMTP_PASSWORD: 'test-password'
  };

  const primaryInventorId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const coInventorId = 'c2222222-3333-4444-5555-666666666666';
  const unauthorizedActorId = 'e9999999-8888-7777-6666-555555555555';
  const disclosureId = 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  const consentId = 'e1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  const attachmentId = 'f1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  const scanTokenId = 't1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

  beforeEach(() => {
    nonceStore = new InMemoryNonceStore(3600);
    mockPool = { query: vi.fn() };
    mockScannerPool = { query: vi.fn() };
    quarantineStorage = new InMemoryQuarantineStorage();
    scannerService = new AntivirusScannerService(
      mockScannerPool as unknown as Pool,
      quarantineStorage
    );

    app = createApp(testEnv, {
      dbPool: mockPool as unknown as Pool,
      scannerPool: mockScannerPool as unknown as Pool,
      quarantineStorage,
      scannerService,
      nonceStore
    });
  });

  function makeBffHeaders(params: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    scope: OperationScope;
    body?: unknown;
    bodyBuffer?: Buffer;
    actorId?: string;
    roles?: string[];
  }) {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = 'rem_nonce_' + Math.random().toString(36).substring(2) + Date.now();
    const actorId = params.actorId || primaryInventorId;
    const roles = params.roles || ['Student'];

    let bodyHash: string;
    if (params.bodyBuffer) {
      bodyHash = computeSha256(params.bodyBuffer);
    } else if (params.body !== undefined) {
      bodyHash = computeSha256(JSON.stringify(params.body));
    } else {
      bodyHash = computeSha256('');
    }

    const canonicalString = buildCanonicalAssertionString({
      method: params.method,
      canonicalPath: params.path,
      queryParams: '',
      operationScope: params.scope,
      actorId,
      roles,
      timestamp,
      nonce,
      bodyHash
    });

    const signature = signCanonicalAssertion(canonicalString, secretHex);

    return {
      'x-bff-signature': signature,
      'x-bff-actor-id': actorId,
      'x-bff-roles': roles.join(','),
      'x-bff-timestamp': timestamp,
      'x-bff-nonce': nonce,
      'x-bff-operation-scope': params.scope,
      'x-bff-body-hash': bodyHash
    };
  }

  // --------------------------------------------------------------------------
  // Test 1: Primary inventor cancelling a pending external invitation
  // --------------------------------------------------------------------------
  it('1. Primary inventor cancelling a pending external invitation', async () => {
    const body = { consentId };
    const headers = makeBffHeaders({
      method: 'POST',
      path: '/api/v1/consent/cancel',
      scope: 'OP_CANCEL_CONSENT_INVITATION',
      body,
      actorId: primaryInventorId
    });

    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/v1/consent/cancel')
      .set(headers)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Inventor consent invitation cancelled successfully');

    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT public.cancel_consent_invitation_v1($1::jsonb, $2::uuid)',
      [expect.any(String), consentId]
    );

    const passedAssertion = JSON.parse(mockPool.query.mock.calls[0][1][0]);
    expect(passedAssertion.operation_scope).toBe('OP_CANCEL_CONSENT_INVITATION');
    expect(passedAssertion.actor_id).toBe(primaryInventorId);
  });

  // --------------------------------------------------------------------------
  // Test 2: Primary inventor cancelling a pending internal invitation
  // --------------------------------------------------------------------------
  it('2. Primary inventor cancelling a pending internal invitation', async () => {
    const internalConsentId = 'e2222222-4444-5555-6666-777777777777';
    const body = { consentId: internalConsentId };
    const headers = makeBffHeaders({
      method: 'POST',
      path: '/api/v1/consent/cancel',
      scope: 'OP_CANCEL_CONSENT_INVITATION',
      body,
      actorId: primaryInventorId
    });

    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/v1/consent/cancel')
      .set(headers)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT public.cancel_consent_invitation_v1($1::jsonb, $2::uuid)',
      [expect.any(String), internalConsentId]
    );
  });

  // --------------------------------------------------------------------------
  // Test 3: Inventor revoking their own consent
  // --------------------------------------------------------------------------
  it('3. Inventor revoking their own consent', async () => {
    const body = { consentId };
    const headers = makeBffHeaders({
      method: 'POST',
      path: '/api/v1/consent/revoke',
      scope: 'OP_REVOKE_CONSENT',
      body,
      actorId: coInventorId
    });

    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/v1/consent/revoke')
      .set(headers)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Inventor consent revoked successfully');

    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT public.revoke_inventor_consent_v1($1::jsonb, $2::uuid)',
      [expect.any(String), consentId]
    );

    const passedAssertion = JSON.parse(mockPool.query.mock.calls[0][1][0]);
    expect(passedAssertion.operation_scope).toBe('OP_REVOKE_CONSENT');
    expect(passedAssertion.actor_id).toBe(coInventorId);
  });

  // --------------------------------------------------------------------------
  // Test 4: Primary inventor being unable to revoke another inventor's verified consent
  // --------------------------------------------------------------------------
  it("4. Primary inventor being unable to revoke another inventor's verified consent", async () => {
    const body = { consentId };
    const headers = makeBffHeaders({
      method: 'POST',
      path: '/api/v1/consent/revoke',
      scope: 'OP_REVOKE_CONSENT',
      body,
      actorId: primaryInventorId // Primary inventor attempting to revoke co-inventor consent
    });

    mockPool.query.mockRejectedValueOnce(
      Object.assign(
        new Error('FORBIDDEN: Only the consenting inventor may revoke consent'),
        { code: '42501' }
      )
    );

    const res = await request(app)
      .post('/api/v1/consent/revoke')
      .set(headers)
      .send(body);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CONSENT_REVOCATION_FORBIDDEN');
    expect(res.body.detail).toBe('Only the consenting inventor may revoke their consent.');
  });

  // --------------------------------------------------------------------------
  // Test 5: Preventing cancellation of verified consent
  // --------------------------------------------------------------------------
  it('5. Preventing cancellation of verified consent', async () => {
    const body = { consentId };
    const headers = makeBffHeaders({
      method: 'POST',
      path: '/api/v1/consent/cancel',
      scope: 'OP_CANCEL_CONSENT_INVITATION',
      body,
      actorId: primaryInventorId
    });

    mockPool.query.mockRejectedValueOnce(
      new Error('INVALID_STATE: Verified consent cannot be cancelled (current: VERIFIED)')
    );

    const res = await request(app)
      .post('/api/v1/consent/cancel')
      .set(headers)
      .send(body);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_WORKFLOW_STATE');
    expect(res.body.detail).toBe('Verified consent cannot be cancelled.');
  });

  // --------------------------------------------------------------------------
  // Test 6: Unauthorized actors being unable to cancel invitations
  // --------------------------------------------------------------------------
  it('6. Unauthorized actors being unable to cancel invitations', async () => {
    const body = { consentId };
    const headers = makeBffHeaders({
      method: 'POST',
      path: '/api/v1/consent/cancel',
      scope: 'OP_CANCEL_CONSENT_INVITATION',
      body,
      actorId: unauthorizedActorId // Non-primary inventor actor
    });

    mockPool.query.mockRejectedValueOnce(
      Object.assign(
        new Error('FORBIDDEN: Only the primary inventor may cancel pending consent invitations'),
        { code: '42501' }
      )
    );

    const res = await request(app)
      .post('/api/v1/consent/cancel')
      .set(headers)
      .send(body);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CONSENT_CANCELLATION_FORBIDDEN');
    expect(res.body.detail).toBe('Only the primary inventor may cancel pending consent invitations.');
  });

  // --------------------------------------------------------------------------
  // Test 7: Attachment metadata retrieval through authorized database gateways
  // --------------------------------------------------------------------------
  it('7. Attachment metadata retrieval through authorized database gateways', async () => {
    const content = Buffer.from('%PDF-1.4 spec document');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const headers = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/attachments/${attachmentId}/upload`,
      scope: 'OP_UPLOAD_ATTACHMENT',
      bodyBuffer: content,
      actorId: primaryInventorId
    });

    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          out_attachment_id: attachmentId,
          out_disclosure_id: disclosureId,
          out_file_name: 'spec.pdf',
          out_file_size_bytes: String(content.length),
          out_mime_type: 'application/pdf',
          out_sha256_hash: hash,
          out_storage_path: `disclosures/${disclosureId}/spec.pdf`,
          out_token_id: scanTokenId
        }
      ]
    });

    mockScannerPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`/api/v1/attachments/${attachmentId}/upload`)
      .set(headers)
      .send(content);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify metadata was retrieved via gateway routine and NOT direct table SELECT
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('public.get_attachment_upload_context_v1($1::jsonb, $2::uuid)'),
      [expect.any(String), attachmentId]
    );
    expect(mockPool.query).not.toHaveBeenCalledWith(
      expect.stringMatching(/SELECT.*FROM\s+public\.attachments/i)
    );

    // Verify scan token is NEVER exposed in the HTTP response
    expect(res.body.tokenId).toBeUndefined();
    expect(res.body.out_token_id).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Test 8: Upload rejection for another user's disclosure
  // --------------------------------------------------------------------------
  it("8. Upload rejection for another user's disclosure", async () => {
    const content = Buffer.from('%PDF-1.4 spec document');
    const headers = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/attachments/${attachmentId}/upload`,
      scope: 'OP_UPLOAD_ATTACHMENT',
      bodyBuffer: content,
      actorId: unauthorizedActorId // Not the primary inventor
    });

    mockPool.query.mockRejectedValueOnce(
      Object.assign(
        new Error('FORBIDDEN: Only the primary inventor may upload file content to this disclosure'),
        { code: '42501' }
      )
    );

    const res = await request(app)
      .post(`/api/v1/attachments/${attachmentId}/upload`)
      .set(headers)
      .send(content);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ATTACHMENT_FORBIDDEN');
    expect(res.body.detail).toBe('Only the primary inventor may upload file content to this disclosure.');
  });

  // --------------------------------------------------------------------------
  // Test 9: Scanner token single-use enforcement
  // --------------------------------------------------------------------------
  it('9. Scanner token single-use enforcement', async () => {
    const content = Buffer.from('%PDF-1.4 spec document');
    const headers = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/attachments/${attachmentId}/upload`,
      scope: 'OP_UPLOAD_ATTACHMENT',
      bodyBuffer: content,
      actorId: primaryInventorId
    });

    // Simulating token consumed or missing on repeated attempt
    mockPool.query.mockRejectedValueOnce(
      new Error('INVALID_SCAN_TOKEN: No active scan token found for this attachment. Token may have expired or already been consumed')
    );

    const res = await request(app)
      .post(`/api/v1/attachments/${attachmentId}/upload`)
      .set(headers)
      .send(content);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_SCAN_TOKEN');
    expect(res.body.detail).toBe('No active scan token found for this attachment. Token may have expired or already been consumed.');
  });

  // --------------------------------------------------------------------------
  // Test 10: Confirmation that ipr_app has no direct table permissions
  // --------------------------------------------------------------------------
  it('10. Confirmation that ipr_app has no direct table permissions', () => {
    const migrationsDir = path.resolve(__dirname, '../migrations');

    // 10a: Migration 006 enforces complete table access revocation
    const m006 = fs.readFileSync(path.join(migrationsDir, '006_grants_privileges.sql'), 'utf-8');
    expect(m006).toMatch(/REVOKE\s+ALL\s+ON\s+TABLES\s+FROM\s+PUBLIC,\s*ipr_app,\s*ipr_scanner,\s*ipr_worker/i);

    // 10b: Migrations 007, 008, 009, 010, 011 contain no direct table grants to ipr_app
    const incrementalMigrations = [
      '007_authentication.sql',
      '008_pidcs_partial_update.sql',
      '009_verification_resend.sql',
      '010_disclosure_queries.sql',
      '011_consent_and_attachment_remediation.sql'
    ];

    for (const mig of incrementalMigrations) {
      const content = fs.readFileSync(path.join(migrationsDir, mig), 'utf-8');
      expect(content).not.toMatch(/GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\s+ON\s+(TABLE|ALL\s+TABLES)[^\n;]*TO\s+ipr_app/i);
    }

    // 10c: Migration 011 strictly grants EXECUTE only to ipr_app on definer-owned gateways
    const m011 = fs.readFileSync(path.join(migrationsDir, '011_consent_and_attachment_remediation.sql'), 'utf-8');
    expect(m011).toContain('GRANT EXECUTE ON FUNCTION public.cancel_consent_invitation_v1(JSONB, UUID) TO ipr_app;');
    expect(m011).toContain('GRANT EXECUTE ON FUNCTION public.get_attachment_upload_context_v1(JSONB, UUID) TO ipr_app;');
    expect(m011).toContain('ALTER FUNCTION public.cancel_consent_invitation_v1(JSONB, UUID) OWNER TO ipr_definer;');
    expect(m011).toContain('ALTER FUNCTION public.get_attachment_upload_context_v1(JSONB, UUID) OWNER TO ipr_definer;');
  });

  // --------------------------------------------------------------------------
  // Test 11: Concurrent upload safety: only one request can claim and use token
  // --------------------------------------------------------------------------
  it('11. Concurrent upload safety: only one request can claim and use scanner token', async () => {
    const content1 = Buffer.from('%PDF-1.4 request 1 payload');
    const hash1 = crypto.createHash('sha256').update(content1).digest('hex');
    const headers1 = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/attachments/${attachmentId}/upload`,
      scope: 'OP_UPLOAD_ATTACHMENT',
      bodyBuffer: content1,
      actorId: primaryInventorId
    });

    const content2 = Buffer.from('%PDF-1.4 request 2 payload');
    const headers2 = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/attachments/${attachmentId}/upload`,
      scope: 'OP_UPLOAD_ATTACHMENT',
      bodyBuffer: content2,
      actorId: primaryInventorId
    });

    // Request 1 successfully claims the token via gateway
    mockPool.query
      .mockResolvedValueOnce({
        rows: [
          {
            out_attachment_id: attachmentId,
            out_disclosure_id: disclosureId,
            out_file_name: 'doc.pdf',
            out_file_size_bytes: String(content1.length),
            out_mime_type: 'application/pdf',
            out_sha256_hash: hash1,
            out_storage_path: `disclosures/${disclosureId}/doc.pdf`,
            out_token_id: scanTokenId
          }
        ]
      })
      // Request 2 encounters row locked / already claimed by request 1
      .mockRejectedValueOnce(
        new Error(`INVALID_SCAN_TOKEN: Scan token for attachment "${attachmentId}" is already claimed by an active upload in progress`)
      );

    mockScannerPool.query.mockResolvedValueOnce({ rows: [] });

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers1)
        .send(content1),
      request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers2)
        .send(content2)
    ]);

    // Exactly one request succeeds with 200
    expect(res1.status).toBe(200);
    expect(res1.body.scanStatus).toBe('CLEAN');

    // The concurrent request is rejected with 422 INVALID_SCAN_TOKEN
    expect(res2.status).toBe(422);
    expect(res2.body.code).toBe('INVALID_SCAN_TOKEN');
    expect(res2.body.detail).toContain('already claimed by an active upload in progress');

    // Dedicated scanner was invoked only ONCE for the successfully claimed token
    expect(mockScannerPool.query).toHaveBeenCalledTimes(1);
    expect(mockScannerPool.query).toHaveBeenCalledWith(
      'SELECT public.record_antivirus_scan_result_v5($1::uuid, $2::uuid, $3::varchar, $4::text, $5::varchar, $6::text)',
      [scanTokenId, attachmentId, hash1, `disclosures/${disclosureId}/doc.pdf`, 'CLEAN', expect.any(String)]
    );
  });

  // --------------------------------------------------------------------------
  // Test 12: Post-claim failure handling: claimed tokens are not silently reusable
  // --------------------------------------------------------------------------
  it('12. Post-claim failure handling: claimed tokens are not silently reusable after failure', async () => {
    const wrongBytes = Buffer.from('%PDF-1.4 wrong corrupted bytes');
    const headers1 = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/attachments/${attachmentId}/upload`,
      scope: 'OP_UPLOAD_ATTACHMENT',
      bodyBuffer: wrongBytes,
      actorId: primaryInventorId
    });

    // Upload 1 claims token, but uploaded bytes mismatch registered SHA-256
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          out_attachment_id: attachmentId,
          out_disclosure_id: disclosureId,
          out_file_name: 'spec.pdf',
          out_file_size_bytes: String(wrongBytes.length),
          out_mime_type: 'application/pdf',
          out_sha256_hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          out_storage_path: `disclosures/${disclosureId}/spec.pdf`,
          out_token_id: scanTokenId
        }
      ]
    });

    const res1 = await request(app)
      .post(`/api/v1/attachments/${attachmentId}/upload`)
      .set(headers1)
      .send(wrongBytes);

    expect(res1.status).toBe(422);
    expect(res1.body.code).toBe('CHECKSUM_MISMATCH');

    // Subsequent upload attempt cannot reuse the claimed token
    const headers2 = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/attachments/${attachmentId}/upload`,
      scope: 'OP_UPLOAD_ATTACHMENT',
      bodyBuffer: wrongBytes,
      actorId: primaryInventorId
    });

    mockPool.query.mockRejectedValueOnce(
      new Error(`INVALID_SCAN_TOKEN: Scan token for attachment "${attachmentId}" is already claimed by an active upload in progress`)
    );

    const res2 = await request(app)
      .post(`/api/v1/attachments/${attachmentId}/upload`)
      .set(headers2)
      .send(wrongBytes);

    expect(res2.status).toBe(422);
    expect(res2.body.code).toBe('INVALID_SCAN_TOKEN');
    expect(res2.body.detail).toContain('already claimed');

    // Token was never passed to scanner for clean promotion
    expect(mockScannerPool.query).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Test 13: Consent cancellation audit-event traceability and preservation of evidence
  // --------------------------------------------------------------------------
  it('13. Consent cancellation audit-event traceability and preservation of evidence', () => {
    const migrationsDir = path.resolve(__dirname, '../migrations');
    const m011 = fs.readFileSync(path.join(migrationsDir, '011_consent_and_attachment_remediation.sql'), 'utf-8');

    // 13a: Traceable outbox audit event emitted with full structured payload
    expect(m011).toContain("'INVENTOR_CONSENT_INVITATION_CANCELLED'");
    expect(m011).toContain("'INVENTOR_CONSENT'");
    expect(m011).toContain("'consent_id', p_consent_id");
    expect(m011).toContain("'disclosure_id', v_consent.disclosure_id");
    expect(m011).toContain("'cancelled_by', v_actor_id");
    expect(m011).toContain("'is_external', v_consent.is_external");
    expect(m011).toContain("'signature_evidence_id', v_consent.signature_evidence_id");
    expect(m011).toContain("'cancelled_at', clock_timestamp()");

    // 13b: Record is NOT deleted; status transitions to CANCELLED
    expect(m011).toContain("SET status = 'CANCELLED'");
    expect(m011).not.toMatch(/DELETE\s+FROM\s+public\.inventor_consents/i);

    // 13c: Cancellation explicitly blocked if consent is VERIFIED (evidence protected)
    expect(m011).toContain("IF v_consent.status = 'VERIFIED' THEN");
    expect(m011).toContain("RAISE EXCEPTION 'INVALID_STATE: Verified consent cannot be cancelled");
    expect(m011).toContain("USING ERRCODE = 'check_violation'");
  });

  // --------------------------------------------------------------------------
  // Test 14: Primary inventor can abandon an eligible failed/pending upload
  // --------------------------------------------------------------------------
  it('14. Primary inventor can abandon an eligible failed/pending upload', async () => {
    const headers = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/attachments/${attachmentId}/abandon`,
      scope: 'OP_ABANDON_ATTACHMENT',
      body: {},
      actorId: primaryInventorId
    });

    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res = await request(app)
      .post(`/api/v1/attachments/${attachmentId}/abandon`)
      .set(headers)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scanStatus).toBe('ABANDONED');
    expect(res.body.attachmentId).toBe(attachmentId);
    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT public.abandon_attachment_v1($1::jsonb, $2::uuid)',
      [expect.any(String), attachmentId]
    );
  });

  // --------------------------------------------------------------------------
  // Test 15: Another user cannot abandon it
  // --------------------------------------------------------------------------
  it('15. Another user cannot abandon it', async () => {
    const headers = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/attachments/${attachmentId}/abandon`,
      scope: 'OP_ABANDON_ATTACHMENT',
      body: {},
      actorId: unauthorizedActorId
    });

    mockPool.query.mockRejectedValueOnce(
      new Error('FORBIDDEN: Only the primary inventor may abandon an attachment for this disclosure')
    );

    const res = await request(app)
      .post(`/api/v1/attachments/${attachmentId}/abandon`)
      .set(headers)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ATTACHMENT_FORBIDDEN');
    expect(res.body.detail).toContain('Only the primary inventor may abandon');
  });

  // --------------------------------------------------------------------------
  // Test 16: CLEAN attachments cannot be abandoned
  // --------------------------------------------------------------------------
  it('16. CLEAN attachments cannot be abandoned', async () => {
    const headers = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/attachments/${attachmentId}/abandon`,
      scope: 'OP_ABANDON_ATTACHMENT',
      body: {},
      actorId: primaryInventorId
    });

    mockPool.query.mockRejectedValueOnce(
      new Error('INVALID_STATE: Successfully scanned CLEAN attachments cannot be abandoned')
    );

    const res = await request(app)
      .post(`/api/v1/attachments/${attachmentId}/abandon`)
      .set(headers)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ATTACHMENT_ALREADY_CLEAN');
    expect(res.body.detail).toContain('CLEAN attachments cannot be abandoned');
  });

  // --------------------------------------------------------------------------
  // Test 17: Active scanning cannot be interrupted
  // --------------------------------------------------------------------------
  it('17. Active scanning cannot be interrupted', async () => {
    const headers = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/attachments/${attachmentId}/abandon`,
      scope: 'OP_ABANDON_ATTACHMENT',
      body: {},
      actorId: primaryInventorId
    });

    const lockErr = Object.assign(
      new Error('LOCK_CONFLICT: Attachment is actively being processed or scanned; cannot abandon while scan is in progress'),
      { code: '55P03' }
    );
    mockPool.query.mockRejectedValueOnce(lockErr);

    const res = await request(app)
      .post(`/api/v1/attachments/${attachmentId}/abandon`)
      .set(headers)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SCAN_IN_PROGRESS');
    expect(res.body.detail).toContain('cannot abandon while scan is in progress');
  });

  // --------------------------------------------------------------------------
  // Test 18: Abandoned attachments do not satisfy submission requirements
  // --------------------------------------------------------------------------
  it('18. Abandoned attachments do not satisfy submission requirements', () => {
    const migrationsDir = path.resolve(__dirname, '../migrations');
    const m011 = fs.readFileSync(path.join(migrationsDir, '011_consent_and_attachment_remediation.sql'), 'utf-8');

    // 18a: Specification count query strictly excludes ABANDONED attachments
    expect(m011).toContain("WHERE a.disclosure_id = p_disclosure_id");
    expect(m011).toContain("AND a.scan_status != 'ABANDONED'");

    // 18b: If all attachments are ABANDONED (v_spec_attachment_count = 0), gateway rejects submission
    expect(m011).toContain("IF v_spec_attachment_count = 0 THEN");
    expect(m011).toContain("RAISE EXCEPTION 'VALIDATION_FAILED: At least one specification attachment is required for disclosure submission; consent evidence does not satisfy this requirement'");
  });

  // --------------------------------------------------------------------------
  // Test 19: Abandoned attachments do not block submission when valid CLEAN specifications exist
  // --------------------------------------------------------------------------
  it('19. Abandoned attachments do not block submission when valid CLEAN specifications exist', async () => {
    const migrationsDir = path.resolve(__dirname, '../migrations');
    const m011 = fs.readFileSync(path.join(migrationsDir, '011_consent_and_attachment_remediation.sql'), 'utf-8');

    // 19a: Cleanliness check strictly ignores ABANDONED attachments
    expect(m011).toContain("WHERE disclosure_id = p_disclosure_id");
    expect(m011).toContain("AND scan_status != 'ABANDONED'");
    expect(m011).toContain("AND scan_status != 'CLEAN'");

    // 19b: Functional submission succeeds through controller when database returns tracking number
    const headers = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/drafts/${disclosureId}/submit`,
      scope: 'OP_SUBMIT_DISCLOSURE',
      body: {},
      actorId: primaryInventorId
    });

    mockPool.query.mockResolvedValueOnce({
      rows: [{ tracking_number: 'IPR-202611001-XYZ' }]
    });

    const res = await request(app)
      .post(`/api/v1/drafts/${disclosureId}/submit`)
      .set(headers)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trackingNumber).toBe('IPR-202611001-XYZ');
  });

  // --------------------------------------------------------------------------
  // Test 20: Audit history is preserved
  // --------------------------------------------------------------------------
  it('20. Audit history is preserved', () => {
    const migrationsDir = path.resolve(__dirname, '../migrations');
    const m011 = fs.readFileSync(path.join(migrationsDir, '011_consent_and_attachment_remediation.sql'), 'utf-8');

    // 20a: Outbox message emitted with full structured aggregate payload
    expect(m011).toContain("'ATTACHMENT_ABANDONED'");
    expect(m011).toContain("'ATTACHMENT'");
    expect(m011).toContain("'attachment_id', p_attachment_id");
    expect(m011).toContain("'previous_scan_status', v_att.scan_status");
    expect(m011).toContain("'abandoned_by', v_actor_id");
    expect(m011).toContain("'abandoned_at', clock_timestamp()");

    // 20b: Soft status transition only; no DELETE statements
    expect(m011).toContain("SET scan_status = 'ABANDONED'");
    expect(m011).not.toMatch(/DELETE\s+FROM\s+public\.attachments/i);

    // 20c: Active scan tokens expired upon abandonment
    expect(m011).toContain("UPDATE public.attachment_scan_tokens");
    expect(m011).toContain("SET status = 'EXPIRED'");
  });

  // --------------------------------------------------------------------------
  // Test 21: Quarantine cleanup failures are handled safely
  // --------------------------------------------------------------------------
  it('21. Quarantine cleanup failures are handled safely', async () => {
    const headers = makeBffHeaders({
      method: 'POST',
      path: `/api/v1/attachments/${attachmentId}/abandon`,
      scope: 'OP_ABANDON_ATTACHMENT',
      body: {},
      actorId: primaryInventorId
    });

    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    // Simulate quarantine storage adapter failure on deletion
    vi.spyOn(quarantineStorage, 'deleteQuarantineObject').mockRejectedValueOnce(
      new Error('S3 bucket temporary timeout or connection reset')
    );

    const res = await request(app)
      .post(`/api/v1/attachments/${attachmentId}/abandon`)
      .set(headers)
      .send({});

    // Quarantine cleanup error is safely absorbed; response still returns 200 OK
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scanStatus).toBe('ABANDONED');
  });
});
