import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import {
  InMemoryNonceStore,
  computeSha256,
  signCanonicalAssertion,
  buildCanonicalAssertionString
} from '@ipr/shared';
import { createApp } from '../src/app.js';
import { BackendEnv } from '../src/config/env.config.js';

describe('POST /api/v1/drafts — Create Draft Disclosure Controller', () => {
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

  interface HeaderOptions {
    actorId?: string;
    roles?: string[];
    scope?: string;
    timestamp?: string;
    nonce?: string;
    body?: unknown;
    overrideSignature?: string;
    overrideBodyHash?: string;
  }

  function makeBffHeaders(options: HeaderOptions = {}) {
    const actorId = options.actorId ?? 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const roles = options.roles ?? ['Student'];
    const scope = options.scope ?? 'OP_CREATE_DRAFT';
    const timestamp = options.timestamp ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = options.nonce ?? 'nonce_' + Math.random().toString(36).substring(2) + Date.now();
    const rawBody = options.body !== undefined ? JSON.stringify(options.body) : '';
    const bodyHash = options.overrideBodyHash ?? computeSha256(rawBody);

    const canonical = buildCanonicalAssertionString({
      method: 'POST',
      canonicalPath: '/api/v1/drafts',
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

  // 1. Successful Student draft creation
  it('successfully creates draft disclosure as a Student actor', async () => {
    const mockDraftId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    mockPool.query.mockResolvedValueOnce({
      rows: [{ draft_id: mockDraftId }]
    });

    const payload = { title: 'Novel Solar Thermal Storage' };
    const headers = makeBffHeaders({ roles: ['Student'], body: payload });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(201);

    expect(res.body).toEqual({
      success: true,
      draftId: mockDraftId,
      message: 'Draft disclosure created successfully'
    });
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 2. Successful Faculty draft creation
  it('successfully creates draft disclosure as a Faculty actor', async () => {
    const mockDraftId = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    mockPool.query.mockResolvedValueOnce({
      rows: [{ draft_id: mockDraftId }]
    });

    const payload = {
      title: 'Advanced Robotic Arm Gripper',
      pidcsData: {}
    };
    const headers = makeBffHeaders({ roles: ['Faculty'], body: payload });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(201);

    expect(res.body).toEqual({
      success: true,
      draftId: mockDraftId,
      message: 'Draft disclosure created successfully'
    });
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 3. Missing title
  it('rejects request when title is missing without calling database', async () => {
    const payload = { pidcsData: {} };
    const headers = makeBffHeaders({ body: payload });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(400);

    expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 4. Empty and whitespace-only title
  it('rejects request when title is empty string without calling database', async () => {
    const payload = { title: '' };
    const headers = makeBffHeaders({ body: payload });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(400);

    expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('rejects request when title is whitespace-only without calling database', async () => {
    const payload = { title: '     ' };
    const headers = makeBffHeaders({ body: payload });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(400);

    expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 5. Invalid PIDCS data
  it('rejects request when pidcsData is a primitive type without calling database', async () => {
    const payload = { title: 'Valid Title', pidcsData: 'invalid-string' };
    const headers = makeBffHeaders({ body: payload });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(400);

    expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('rejects request when pidcsData contains invalid schema structure without calling database', async () => {
    const payload = {
      title: 'Valid Title',
      pidcsData: {
        inventors: [
          { id: 'not-a-valid-uuid' }
        ]
      }
    };
    const headers = makeBffHeaders({ body: payload });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(400);

    expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 6. Reviewer, Legal and Administrator authorization denial
  it('denies draft creation for Reviewer role without calling database', async () => {
    const payload = { title: 'Unauthorized Draft' };
    const headers = makeBffHeaders({ roles: ['Reviewer'], body: payload });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(403);

    expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('denies draft creation for Legal role without calling database', async () => {
    const payload = { title: 'Unauthorized Draft' };
    const headers = makeBffHeaders({ roles: ['Legal'], body: payload });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(403);

    expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('denies draft creation for Administrator role without calling database', async () => {
    const payload = { title: 'Unauthorized Draft' };
    const headers = makeBffHeaders({ roles: ['Administrator'], body: payload });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(403);

    expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 7. Invalid HMAC assertion
  it('rejects request with invalid HMAC signature without calling database', async () => {
    const payload = { title: 'Valid Title' };
    const headers = makeBffHeaders({
      body: payload,
      overrideSignature: '0000000000000000000000000000000000000000000000000000000000000000'
    });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(401);

    expect(res.body.code).toBe('BFF_SIGNATURE_INVALID');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 8. Expired timestamp
  it('rejects request with expired timestamp without calling database', async () => {
    const payload = { title: 'Valid Title' };
    const headers = makeBffHeaders({
      body: payload,
      timestamp: '2020-01-01T00:00:00Z'
    });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(401);

    expect(res.body.code).toBe('BFF_ASSERTION_TIMESTAMP_EXPIRED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 9. Replayed nonce
  it('rejects duplicate request replay with 409 and calls database only once', async () => {
    const mockDraftId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    mockPool.query.mockResolvedValue({
      rows: [{ draft_id: mockDraftId }]
    });

    const payload = { title: 'Unique Invention' };
    const fixedHeaders = makeBffHeaders({ body: payload });

    // First attempt succeeds
    const res1 = await request(app)
      .post('/api/v1/drafts')
      .set(fixedHeaders)
      .send(payload)
      .expect(201);
    expect(res1.body.draftId).toBe(mockDraftId);
    expect(mockPool.query).toHaveBeenCalledTimes(1);

    // Second replay attempt fails with 409
    const res2 = await request(app)
      .post('/api/v1/drafts')
      .set(fixedHeaders)
      .send(payload)
      .expect(409);
    expect(res2.body.code).toBe('ASSERTION_REPLAY_DETECTED');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 10. Database function failure and sanitized error response
  it('sanitizes internal database errors and prevents information leakage', async () => {
    mockPool.query.mockRejectedValueOnce(
      new Error('Connection lost to postgres://ipr_app:secretPassword123@10.0.0.5:5432/ipr_prod')
    );

    const payload = { title: 'Failing DB Draft' };
    const headers = makeBffHeaders({ body: payload });

    const res = await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(500);

    expect(res.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.detail).toBe('An unexpected internal error occurred.');
    // Ensure sensitive information is never leaked in the response
    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain('secretPassword123');
    expect(jsonStr).not.toContain('10.0.0.5');
    expect(jsonStr).not.toContain('postgres://');
  });

  // 11. Correct SQL parameterization and exact assertion propagation
  it('verifies exact parameterized database call and assertion propagation', async () => {
    const mockDraftId = 'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
    mockPool.query.mockResolvedValueOnce({
      rows: [{ draft_id: mockDraftId }]
    });

    const actorId = 'e2b3c4d5-f6a7-8b9c-0d1e-2f3a4b5c6d7e';
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = 'specific_test_nonce_987654321';
    const payload = {
      title: '   Trimmed Title With Whitespace   ',
      pidcsData: { abstract: 'A novel mechanism' }
    };

    const headers = makeBffHeaders({
      actorId,
      roles: ['Faculty'],
      timestamp,
      nonce,
      body: payload
    });

    await request(app)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(201);

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sqlQuery, sqlParams] = mockPool.query.mock.calls[0];

    // Verify exact SQL query
    expect(sqlQuery).toBe(
      'SELECT public.create_draft_disclosure_v1($1::jsonb, $2::varchar, $3::jsonb) AS draft_id'
    );

    // Verify parameters: [assertion JSON, title, pidcsData JSON]
    expect(Array.isArray(sqlParams)).toBe(true);
    expect(sqlParams).toHaveLength(3);

    const parsedAssertion = JSON.parse(sqlParams[0]);
    expect(parsedAssertion).toEqual({
      method: 'POST',
      canonical_path: '/api/v1/drafts',
      canonical_query: '',
      operation_scope: 'OP_CREATE_DRAFT',
      actor_id: actorId,
      asserted_roles: ['Faculty'],
      timestamp,
      nonce,
      body_hash: headers['X-BFF-Body-Hash'],
      signature: headers['X-BFF-Signature']
    });

    // Verify trimmed title
    expect(sqlParams[1]).toBe('Trimmed Title With Whitespace');

    // Verify PIDCS data
    expect(JSON.parse(sqlParams[2])).toEqual({ abstract: 'A novel mechanism' });
  });

  it('fails with 503 when dbPool is not configured', async () => {
    const appWithoutDb = createApp(testEnv, { nonceStore });
    const payload = { title: 'No DB Pool Draft' };
    const headers = makeBffHeaders({ body: payload });

    const res = await request(appWithoutDb)
      .post('/api/v1/drafts')
      .set(headers)
      .send(payload)
      .expect(503);

    expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
  });
});
