import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import {
  InMemoryNonceStore,
  computeSha256,
  signCanonicalAssertion,
  buildCanonicalAssertionString,
  canonicalizePath
} from '@ipr/shared';
import { createApp } from '../src/app.js';
import { BackendEnv } from '../src/config/env.config.js';

describe('POST /api/v1/drafts/:id/submit — Submit Draft Disclosure Controller', () => {
  const secretHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let nonceStore: InMemoryNonceStore;
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let app: ReturnType<typeof createApp>;

  const testEnv: BackendEnv = {
    NODE_ENV: 'test',
    PORT: 4002,
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

  const sampleDraftId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const primaryInventorId = 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

  interface HeaderOptions {
    canonicalPath?: string;
    draftId?: string;
    actorId?: string;
    roles?: string[];
    scope?: string;
    timestamp?: string;
    nonce?: string;
    body?: unknown;
    overrideSignature?: string;
    overrideBodyHash?: string;
  }

  function makeSubmitBffHeaders(options: HeaderOptions = {}) {
    const draftId = options.draftId ?? sampleDraftId;
    const actorId = options.actorId ?? primaryInventorId;
    const roles = options.roles ?? ['Student'];
    const scope = options.scope ?? 'OP_SUBMIT_DISCLOSURE';
    const timestamp = options.timestamp ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = options.nonce ?? 'submit_nonce_' + Math.random().toString(36).substring(2) + Date.now();
    const rawBody = options.body !== undefined ? JSON.stringify(options.body) : '';
    const bodyHash = options.overrideBodyHash ?? computeSha256(rawBody);

    const canonicalPath = options.canonicalPath ?? `/api/v1/drafts/${draftId}/submit`;

    const canonical = buildCanonicalAssertionString({
      method: 'POST',
      canonicalPath: canonicalizePath(canonicalPath),
      queryParams: '',
      operationScope: scope,
      actorId,
      roles,
      timestamp,
      nonce,
      bodyHash
    });

    const signature = options.overrideSignature ?? signCanonicalAssertion(canonical, secretHex);

    return {
      'Content-Type': 'application/json',
      'X-BFF-Signature': signature,
      'X-BFF-Actor-ID': actorId,
      'X-BFF-Roles': roles.join(','),
      'X-BFF-Operation-Scope': scope,
      'X-BFF-Timestamp': timestamp,
      'X-BFF-Nonce': nonce,
      'X-BFF-Body-Hash': bodyHash
    };
  }

  beforeEach(() => {
    nonceStore = new InMemoryNonceStore(3600);
    mockPool = { query: vi.fn() };
    app = createApp(testEnv, { dbPool: mockPool as unknown as Pool, nonceStore });
  });

  // 1. Successful submission
  it('successfully submits a valid draft disclosure (200 OK)', async () => {
    const generatedTrackingNumber = 'IPR-202611001-A7Z';
    mockPool.query.mockResolvedValueOnce({
      rows: [{ tracking_number: generatedTrackingNumber }]
    });

    const payload = { clientChecksum: 'f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2' };
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.trackingNumber).toBe(generatedTrackingNumber);
    expect(res.body.trackingNumber).toMatch(/^IPR-\d{6}\d{3}-[0-9A-Z]{3}$/);
    expect(res.body.draftId).toBe(sampleDraftId);
    expect(res.body.submittedAt).toBeUndefined();
    expect(mockPool.query).toHaveBeenCalledTimes(1);

    const [sqlQuery, sqlParams] = mockPool.query.mock.calls[0];
    expect(sqlQuery).toBe('SELECT public.submit_initial_disclosure_v3($1::jsonb, $2::uuid) AS tracking_number');
    expect(sqlParams[1]).toBe(sampleDraftId);
  });

  // 2. Faculty primary inventor successful submission
  it('permits Faculty primary inventor to submit disclosure (200 OK)', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ tracking_number: 'IPR-202611002-B8Y' }]
    });

    const facultyId = 'f1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const payload = {};
    const headers = makeSubmitBffHeaders({
      actorId: facultyId,
      roles: ['Faculty'],
      body: payload
    });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.trackingNumber).toBe('IPR-202611002-B8Y');
  });

  // 3. Role restriction: Reviewer denied by operation scope
  it('rejects Reviewer role from submitting disclosure (403 Scope Denied)', async () => {
    const reviewerId = 'r1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const payload = {};
    const headers = makeSubmitBffHeaders({
      actorId: reviewerId,
      roles: ['Reviewer'],
      body: payload
    });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(403);

    expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 4. Role restriction: Legal denied by operation scope
  it('rejects Legal officer role from submitting disclosure (403 Scope Denied)', async () => {
    const legalId = 'l1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const payload = {};
    const headers = makeSubmitBffHeaders({
      actorId: legalId,
      roles: ['Legal'],
      body: payload
    });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(403);

    expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 5. Role restriction: Administrator denied by operation scope
  it('rejects Administrator role from submitting disclosure (403 Scope Denied)', async () => {
    const adminId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const payload = {};
    const headers = makeSubmitBffHeaders({
      actorId: adminId,
      roles: ['Administrator'],
      body: payload
    });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(403);

    expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 6. Unauthorized Student (not primary inventor) rejected
  it('rejects submission when actor is not the primary inventor (403 Forbidden)', async () => {
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error('FORBIDDEN: Only the primary inventor may submit this disclosure'), {
        code: '42501'
      })
    );

    const nonPrimaryStudentId = 's9999999-9999-9999-9999-999999999999';
    const payload = {};
    const headers = makeSubmitBffHeaders({
      actorId: nonPrimaryStudentId,
      roles: ['Student'],
      body: payload
    });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(403);

    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.detail).toContain('primary inventor');
  });

  // 7. Malformed UUID rejected without DB call
  it('rejects malformed UUID with 400 before database call', async () => {
    const malformedId = 'not-a-valid-uuid-1234';
    const payload = {};
    const headers = makeSubmitBffHeaders({ draftId: malformedId, body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${malformedId}/submit`)
      .set(headers)
      .send(payload)
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.detail).toContain('valid UUID');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 8. Missing database pool returns 503
  it('returns 503 DATABASE_UNAVAILABLE when dbPool is not configured', async () => {
    const appWithoutDb = createApp(testEnv, { nonceStore });
    const payload = {};
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(appWithoutDb)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(503);

    expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
    expect(res.body.detail).toContain('pool is not configured');
  });

  // 8a. Database connection outage (ECONNREFUSED) returns 503 DATABASE_UNAVAILABLE
  it('returns 503 DATABASE_UNAVAILABLE when database connection fails (ECONNREFUSED)', async () => {
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' })
    );

    const payload = {};
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(503);

    expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
    expect(res.body.detail).toContain('temporarily unavailable');
  });

  // 8b. Database connection failure SQLSTATE (08006) returns 503 DATABASE_UNAVAILABLE
  it('returns 503 DATABASE_UNAVAILABLE when database connection drops (SQLSTATE 08006)', async () => {
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error('connection failure'), { code: '08006' })
    );

    const payload = {};
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(503);

    expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
    expect(res.body.detail).toContain('temporarily unavailable');
  });

  // 8c. Database shutdown SQLSTATE (57P01) returns 503 DATABASE_UNAVAILABLE
  it('returns 503 DATABASE_UNAVAILABLE when database is in shutdown (SQLSTATE 57P01)', async () => {
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error('admin shutdown'), { code: '57P01' })
    );

    const payload = {};
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(503);

    expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
    expect(res.body.detail).toContain('temporarily unavailable');
  });

  // 9. Missing request assertion returns 401
  it('returns 401 when BFF assertion headers are missing', async () => {
    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .send({})
      .expect(401);

    expect(res.body.code).toBe('BFF_ASSERTION_MISSING_HEADERS');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 10. Invalid HMAC signature returns 401
  it('returns 401 when HMAC signature is invalid', async () => {
    const payload = {};
    const headers = makeSubmitBffHeaders({
      body: payload,
      overrideSignature: '0000000000000000000000000000000000000000000000000000000000000000'
    });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(401);

    expect(res.body.code).toBe('BFF_SIGNATURE_INVALID');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 10a. Database gateway BFF_SIGNATURE_INVALID returns 401
  it('returns 401 when database gateway reports BFF_SIGNATURE_INVALID', async () => {
    mockPool.query.mockRejectedValueOnce(
      Object.assign(
        new Error('BFF_SIGNATURE_INVALID: Cryptographic request signature verification failed'),
        { code: '42501' }
      )
    );

    const payload = {};
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(401);

    expect(res.body.code).toBe('BFF_SIGNATURE_INVALID');
  });

  // 11. Replayed nonce returns 409
  it('returns 409 ASSERTION_REPLAY_DETECTED when nonce is reused', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ tracking_number: 'IPR-202611001-A7Z' }]
    });

    const payload = {};
    const fixedNonce = 'reusable_submit_nonce_888';
    const headers = makeSubmitBffHeaders({ nonce: fixedNonce, body: payload });

    // First request: succeeds
    await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(200);

    // Second request: rejected as replay
    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(409);

    expect(res.body.code).toBe('ASSERTION_REPLAY_DETECTED');
  });

  // 12. Non-DRAFT disclosure status returns 422
  it('rejects submission when disclosure is not in DRAFT status (422 INVALID_WORKFLOW_STATE)', async () => {
    mockPool.query.mockRejectedValueOnce(
      Object.assign(
        new Error('INVALID_STATE: Disclosure is in status "SUBMITTED", expected "DRAFT"'),
        { code: 'IPR05' }
      )
    );

    const payload = {};
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(422);

    expect(res.body.code).toBe('INVALID_WORKFLOW_STATE');
    expect(res.body.detail).toContain('expected "DRAFT"');
  });

  // 13. Missing consent verification returns 422
  it('rejects submission when inventor consents are not institutional VERIFIED (422 VALIDATION_FAILED)', async () => {
    mockPool.query.mockRejectedValueOnce(
      new Error('VALIDATION_FAILED: All inventor consents must be institutional VERIFIED before submission (1 unverified)')
    );

    const payload = {};
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(422);

    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.detail).toContain('All inventor consents must be institutional VERIFIED');
  });

  // 14. Invalid share distribution returns 422
  it('rejects submission when total inventor shares do not equal 10,000 basis points (422 VALIDATION_FAILED)', async () => {
    mockPool.query.mockRejectedValueOnce(
      new Error('VALIDATION_FAILED: Total inventor share must equal exactly 10,000 basis points (100%), found 9000')
    );

    const payload = {};
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(422);

    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.detail).toContain('must equal exactly 10,000 basis points');
  });

  // 15. Missing specification attachment returns 422
  it('rejects submission when disclosure lacks a specification attachment (422 VALIDATION_FAILED)', async () => {
    mockPool.query.mockRejectedValueOnce(
      new Error('VALIDATION_FAILED: At least one specification attachment is required for disclosure submission; consent evidence does not satisfy this requirement')
    );

    const payload = {};
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(422);

    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.detail).toContain('At least one specification attachment is required');
  });

  // 16. Non-clean attachments return 422 SECURITY_VIOLATION
  it('rejects submission when attachments are pending scan or infected (422 SECURITY_VIOLATION)', async () => {
    mockPool.query.mockRejectedValueOnce(
      new Error('SECURITY_VIOLATION: Cannot submit disclosure with pending, infected, or unscanned attachments')
    );

    const payload = {};
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(422);

    expect(res.body.code).toBe('SECURITY_VIOLATION');
    expect(res.body.detail).toContain('pending, infected, or unscanned attachments');
  });

  // 17. Disclosure not found returns 404
  it('returns 404 RESOURCE_NOT_FOUND when disclosure does not exist', async () => {
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error(`NOT_FOUND: Disclosure "${sampleDraftId}" does not exist`), {
        code: 'P0002'
      })
    );

    const payload = {};
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(404);

    expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.detail).toContain('does not exist');
  });

  // 18. Sanitized 500 error on unexpected database failures
  it('sanitizes unexpected database errors and prevents information leakage (500)', async () => {
    mockPool.query.mockRejectedValueOnce(
      new Error('FATAL: connection to server at 192.168.1.50 failed: database password secretPass123 rejected')
    );

    const payload = {};
    const headers = makeSubmitBffHeaders({ body: payload });

    const res = await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(500);

    expect(res.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.detail).toBe('An unexpected internal error occurred.');
    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain('secretPass123');
    expect(jsonStr).not.toContain('192.168.1.50');
    expect(jsonStr).not.toContain('FATAL');
  });

  // 19. Assertion propagation and parameterization
  it('verifies exact parameterized database call and 10-key assertion propagation', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ tracking_number: 'IPR-202611003-C9X' }]
    });

    const actorId = 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = 'specific_submit_nonce_555666';
    const payload = { clientChecksum: 'abc123def456' };

    const headers = makeSubmitBffHeaders({
      actorId,
      roles: ['Student'],
      timestamp,
      nonce,
      body: payload
    });

    await request(app)
      .post(`/api/v1/drafts/${sampleDraftId}/submit`)
      .set(headers)
      .send(payload)
      .expect(200);

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sqlQuery, sqlParams] = mockPool.query.mock.calls[0];

    expect(sqlQuery).toBe(
      'SELECT public.submit_initial_disclosure_v3($1::jsonb, $2::uuid) AS tracking_number'
    );
    expect(sqlParams).toHaveLength(2);

    const parsedAssertion = JSON.parse(sqlParams[0]);
    expect(parsedAssertion).toEqual({
      method: 'POST',
      canonical_path: `/api/v1/drafts/${sampleDraftId}/submit`,
      canonical_query: '',
      operation_scope: 'OP_SUBMIT_DISCLOSURE',
      actor_id: actorId,
      asserted_roles: ['Student'],
      timestamp,
      nonce,
      body_hash: headers['X-BFF-Body-Hash'],
      signature: headers['X-BFF-Signature']
    });

    expect(sqlParams[1]).toBe(sampleDraftId);
  });
});
