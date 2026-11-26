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

describe('PATCH /api/v1/drafts/:id — Update Draft Disclosure Controller', () => {
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

  function makePatchBffHeaders(options: HeaderOptions = {}) {
    const draftId = options.draftId ?? sampleDraftId;
    const actorId = options.actorId ?? primaryInventorId;
    const roles = options.roles ?? ['Student'];
    const scope = options.scope ?? 'OP_UPDATE_DRAFT';
    const timestamp = options.timestamp ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = options.nonce ?? 'patch_nonce_' + Math.random().toString(36).substring(2) + Date.now();
    const rawBody = options.body !== undefined ? JSON.stringify(options.body) : '';
    const bodyHash = options.overrideBodyHash ?? computeSha256(rawBody);

    const canonicalPath = options.canonicalPath ?? `/api/v1/drafts/${draftId}`;

    const canonical = buildCanonicalAssertionString({
      method: 'PATCH',
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
      'X-BFF-Timestamp': timestamp,
      'X-BFF-Nonce': nonce,
      'X-BFF-Operation-Scope': scope,
      'X-BFF-Body-Hash': bodyHash
    };
  }

  beforeEach(() => {
    nonceStore = new InMemoryNonceStore(3600);
    mockPool = {
      query: vi.fn()
    };
    app = createApp(testEnv, {
      nonceStore,
      dbPool: mockPool as unknown as Pool
    });
  });

  // 1. Primary inventor successfully updates their own draft
  it('permits primary inventor to update their draft (200 OK)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const payload = {
      title: 'Updated Invention Title',
      pidcsData: { abstract: 'Updated abstract' }
    };
    const headers = makePatchBffHeaders({ body: payload });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(200);

    expect(res.body).toEqual({
      success: true,
      message: 'Draft disclosure updated successfully',
      draftId: sampleDraftId
    });
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 2. Title-only update
  it('updates title only and passes null for pidcsData to preserve existing PIDCS (200 OK)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const payload = { title: 'New Distinct Title' };
    const headers = makePatchBffHeaders({ body: payload });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [, , passedTitle, passedPidcs] = mockPool.query.mock.calls[0][1];
    expect(passedTitle).toBe('New Distinct Title');
    expect(passedPidcs).toBeNull();
  });

  // 3. PIDCS-only update
  it('updates pidcsData only and passes null for title to preserve existing title (200 OK)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const payload = { pidcsData: { detailedDescription: 'Expanded experimental section' } };
    const headers = makePatchBffHeaders({ body: payload });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [, , passedTitle, passedPidcs] = mockPool.query.mock.calls[0][1];
    expect(passedTitle).toBeNull();
    expect(JSON.parse(passedPidcs)).toEqual({ detailedDescription: 'Expanded experimental section' });
  });

  // 4. Combined title and PIDCS update
  it('updates both title and pidcsData simultaneously (200 OK)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const payload = {
      title: 'Combined Update Title',
      pidcsData: { commercialPotential: 'High market demand' }
    };
    const headers = makePatchBffHeaders({ body: payload });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [, , passedTitle, passedPidcs] = mockPool.query.mock.calls[0][1];
    expect(passedTitle).toBe('Combined Update Title');
    expect(JSON.parse(passedPidcs)).toEqual({ commercialPotential: 'High market demand' });
  });

  // 5. Missing disclosure ID (subpath not matching router returns 404)
  it('rejects request with missing disclosure ID route with 404', async () => {
    const payload = { title: 'Some Title' };
    const headers = makePatchBffHeaders({
      canonicalPath: '/api/v1/drafts/',
      body: payload
    });
    const res = await request(app)
      .patch('/api/v1/drafts/')
      .set(headers)
      .send(payload);

    expect(res.status).toBe(404);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 6. Malformed UUID
  it('rejects malformed UUID with 400 without calling database', async () => {
    const malformedId = 'not-a-valid-uuid-5678';
    const payload = { title: 'Valid Title' };
    const headers = makePatchBffHeaders({ draftId: malformedId, body: payload });

    const res = await request(app)
      .patch(`/api/v1/drafts/${malformedId}`)
      .set(headers)
      .send(payload)
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.detail).toBe('Disclosure identifier must be a valid UUID.');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 7. Empty update object
  it('rejects empty update object {} with 400 without calling database', async () => {
    const payload = {};
    const headers = makePatchBffHeaders({ body: payload });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(400);

    expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 8. Reject unsupported/malformed fields
  it('rejects unsupported fields (e.g. status, actorId) with 400 without calling database', async () => {
    const payload = {
      title: 'Valid Title',
      status: 'APPROVED',
      actorId: 'attacker-uuid'
    };
    const headers = makePatchBffHeaders({ body: payload });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(400);

    expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 9. Whitespace-only title
  it('rejects whitespace-only title with 400 without calling database', async () => {
    const payload = { title: '      ' };
    const headers = makePatchBffHeaders({ body: payload });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(400);

    expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 10. Invalid PIDCS data
  it('rejects invalid PIDCS data with 400 without calling database', async () => {
    const payload = {
      title: 'Valid Title',
      pidcsData: {
        inventors: [{ id: 'not-a-valid-uuid' }]
      }
    };
    const headers = makePatchBffHeaders({ body: payload });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(400);

    expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 11. Unauthenticated request
  it('rejects request with missing BFF assertion headers with 401', async () => {
    const payload = { title: 'Unauthenticated Update' };

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .send(payload)
      .expect(401);

    expect(res.body.code).toBe('BFF_ASSERTION_MISSING_HEADERS');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 12. Invalid HMAC assertion
  it('rejects request with invalid signature with 401 without calling database', async () => {
    const payload = { title: 'Tampered Title' };
    const headers = makePatchBffHeaders({
      body: payload,
      overrideSignature: '0000000000000000000000000000000000000000000000000000000000000000'
    });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(401);

    expect(res.body.code).toBe('BFF_SIGNATURE_INVALID');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 13. Expired timestamp
  it('rejects request with expired timestamp with 401 without calling database', async () => {
    const payload = { title: 'Expired Update' };
    const headers = makePatchBffHeaders({
      body: payload,
      timestamp: '2020-01-01T00:00:00Z'
    });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(401);

    expect(res.body.code).toBe('BFF_ASSERTION_TIMESTAMP_EXPIRED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 14. Replayed nonce
  it('rejects duplicate request using replayed nonce with 409', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    const payload = { title: 'Replay Title' };
    const fixedHeaders = makePatchBffHeaders({ body: payload });

    // First request succeeds
    await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(fixedHeaders)
      .send(payload)
      .expect(200);

    expect(mockPool.query).toHaveBeenCalledTimes(1);

    // Replay with identical nonce fails
    const replayRes = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(fixedHeaders)
      .send(payload)
      .expect(409);

    expect(replayRes.body.code).toBe('ASSERTION_REPLAY_DETECTED');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 15. Unauthorized Student
  it('denies update when Student is not the primary inventor (403 Forbidden)', async () => {
    const otherStudentId = 's9999999-0000-0000-0000-000000000000';
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error('FORBIDDEN: Only primary inventor may update draft disclosure'), {
        code: '42501'
      })
    );

    const payload = { title: 'Attacker Title' };
    const headers = makePatchBffHeaders({
      actorId: otherStudentId,
      roles: ['Student'],
      body: payload
    });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(403);

    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.detail).toContain('Only primary inventor may update draft disclosure');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 16. Unauthorized Faculty
  it('denies update when Faculty is not the primary inventor (403 Forbidden)', async () => {
    const otherFacultyId = 'f9999999-0000-0000-0000-000000000000';
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error('FORBIDDEN: Only primary inventor may update draft disclosure'), {
        code: '42501'
      })
    );

    const payload = { title: 'Other Faculty Title' };
    const headers = makePatchBffHeaders({
      actorId: otherFacultyId,
      roles: ['Faculty'],
      body: payload
    });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(403);

    expect(res.body.code).toBe('FORBIDDEN');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 17. Reviewer denied
  it('denies Reviewer role at scope level before calling database (403 Forbidden)', async () => {
    const payload = { title: 'Reviewer Title' };
    const headers = makePatchBffHeaders({
      roles: ['Reviewer'],
      body: payload
    });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(403);

    expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 18. Legal user denied
  it('denies Legal role at scope level before calling database (403 Forbidden)', async () => {
    const payload = { title: 'Legal Title' };
    const headers = makePatchBffHeaders({
      roles: ['Legal'],
      body: payload
    });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(403);

    expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 19. Submitted disclosure cannot be updated
  it('rejects update when disclosure is not in DRAFT status with 422 INVALID_WORKFLOW_STATE', async () => {
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error('INVALID_STATE: Only DRAFT disclosures can be updated (current: SUBMITTED)'), {
        code: 'IPR05'
      })
    );

    const payload = { title: 'Post-submission title' };
    const headers = makePatchBffHeaders({ body: payload });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(422);

    expect(res.body.code).toBe('INVALID_WORKFLOW_STATE');
    expect(res.body.detail).toContain('Only DRAFT disclosures can be updated');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 20. Missing database pool returns 503
  it('returns 503 DATABASE_UNAVAILABLE when dbPool is not configured', async () => {
    const appWithoutDb = createApp(testEnv, { nonceStore });
    const payload = { title: 'Valid Title' };
    const headers = makePatchBffHeaders({ body: payload });

    const res = await request(appWithoutDb)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(503);

    expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
    expect(res.body.detail).toBe('Database connection pool is not configured.');
  });

  // 21. Database errors are sanitized
  it('sanitizes unexpected database errors and prevents information leakage (500)', async () => {
    mockPool.query.mockRejectedValueOnce(
      new Error('fatal error: host=10.0.0.99 user=ipr_app password=secretPass123 UPDATE public.disclosures')
    );

    const payload = { title: 'Valid Title' };
    const headers = makePatchBffHeaders({ body: payload });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(500);

    expect(res.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.detail).toBe('An unexpected internal error occurred.');
    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain('secretPass123');
    expect(jsonStr).not.toContain('10.0.0.99');
    expect(jsonStr).not.toContain('UPDATE');
  });

  // 22. Exact assertion propagation & 23. SQL parameterization
  it('verifies exact parameterized database call and 10-key assertion propagation', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const actorId = 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = 'specific_patch_nonce_123456';
    const payload = {
      title: '   Trimmed Invention Title   ',
      pidcsData: { abstract: 'Trimmed abstract' }
    };

    const headers = makePatchBffHeaders({
      actorId,
      roles: ['Faculty'],
      timestamp,
      nonce,
      body: payload
    });

    await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(200);

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sqlQuery, sqlParams] = mockPool.query.mock.calls[0];

    expect(sqlQuery).toBe(
      'SELECT public.update_draft_disclosure_v1($1::jsonb, $2::uuid, $3::varchar, $4::jsonb)'
    );
    expect(sqlParams).toHaveLength(4);

    const parsedAssertion = JSON.parse(sqlParams[0]);
    expect(parsedAssertion).toEqual({
      method: 'PATCH',
      canonical_path: `/api/v1/drafts/${sampleDraftId}`,
      canonical_query: '',
      operation_scope: 'OP_UPDATE_DRAFT',
      actor_id: actorId,
      asserted_roles: ['Faculty'],
      timestamp,
      nonce,
      body_hash: headers['X-BFF-Body-Hash'],
      signature: headers['X-BFF-Signature']
    });

    expect(sqlParams[1]).toBe(sampleDraftId);
    expect(sqlParams[2]).toBe('Trimmed Invention Title');
    expect(JSON.parse(sqlParams[3])).toEqual({ abstract: 'Trimmed abstract' });
  });

  // 24. No database call on validation failure
  it('verifies no database call is made when request validation fails', async () => {
    const invalidPayload = { title: '' };
    const headers = makePatchBffHeaders({ body: invalidPayload });

    await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(invalidPayload)
      .expect(400);

    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 25. Partial PIDCS updates preserve omitted fields
  it('preserves existing PIDCS fields when only title is updated by passing null to gateway', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const payload = { title: 'Only Title Changed' };
    const headers = makePatchBffHeaders({ body: payload });

    await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(200);

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [, , passedTitle, passedPidcs] = mockPool.query.mock.calls[0][1];
    expect(passedTitle).toBe('Only Title Changed');
    // Gateway contract preserves existing pidcs_data via COALESCE(p_pidcs_data, pidcs_data) when passed null
    expect(passedPidcs).toBeNull();
  });

  // 26. Not-found draft disclosure returns 404
  it('returns 404 RESOURCE_NOT_FOUND when draft does not exist', async () => {
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error(`NOT_FOUND: Disclosure "${sampleDraftId}" does not exist`), {
        code: 'P0002'
      })
    );

    const payload = { title: 'Non-existent draft' };
    const headers = makePatchBffHeaders({ body: payload });

    const res = await request(app)
      .patch(`/api/v1/drafts/${sampleDraftId}`)
      .set(headers)
      .send(payload)
      .expect(404);

    expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.detail).toContain('does not exist');
  });
});

