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

describe('GET /api/v1/disclosures/:id — View Disclosure Controller', () => {
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

  const sampleDisclosureId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const primaryInventorId = 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  const assignedReviewerId = 'r1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e';
  const assignedLegalId = 'l1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6f';
  const coInventorId = 'c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c60';

  const mockDbRow = {
    id: sampleDisclosureId,
    trackingNumber: 'IPR-202611001-XYZ',
    title: 'Novel Solar Inverter Control',
    status: 'SUBMITTED',
    primaryInventorId,
    assignedReviewerId,
    reviewStatus: 'UNDER_REVIEW',
    legalClearanceStatus: 'PENDING',
    pidcsData: { abstract: 'Solar inverter efficiency' },
    submissionTimestamp: '2026-11-26T10:00:00.000Z',
    createdAt: '2026-11-26T09:00:00.000Z',
    updatedAt: '2026-11-26T10:00:00.000Z'
  };

  interface HeaderOptions {
    disclosureId?: string;
    actorId?: string;
    roles?: string[];
    scope?: string;
    queryParams?: string;
    timestamp?: string;
    nonce?: string;
    overrideSignature?: string;
  }

  function makeGetBffHeaders(options: HeaderOptions = {}) {
    const disclosureId = options.disclosureId ?? sampleDisclosureId;
    const actorId = options.actorId ?? primaryInventorId;
    const roles = options.roles ?? ['Student'];
    const scope = options.scope ?? 'OP_VIEW_DISCLOSURE';
    const queryParams = options.queryParams ?? '';
    const timestamp = options.timestamp ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = options.nonce ?? 'get_nonce_' + Math.random().toString(36).substring(2) + Date.now();
    const bodyHash = computeSha256(''); // GET requests have empty body

    let canonical: string;
    if (roles.some((r) => (r as string) === 'NonExistentRole')) {
      canonical = `GET\n/api/v1/disclosures/${disclosureId}\n${queryParams}\n${scope}\n${actorId}\n${roles.join(',')}\n${timestamp}\n${nonce}\n${bodyHash}`;
    } else {
      canonical = buildCanonicalAssertionString({
        method: 'GET',
        canonicalPath: `/api/v1/disclosures/${disclosureId}`,
        queryParams,
        operationScope: scope,
        actorId,
        roles,
        timestamp,
        nonce,
        bodyHash
      });
    }

    const signature = options.overrideSignature ?? signCanonicalAssertion(canonical, secretHex);

    return {
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

  // 1. Primary inventor can read the disclosure
  it('permits primary inventor to read disclosure (200 OK)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockDbRow] });

    const headers = makeGetBffHeaders({
      actorId: primaryInventorId,
      roles: ['Student']
    });

    const res = await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.disclosure).toEqual(mockDbRow);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 2. Administrator can read any disclosure
  it('permits Administrator to read any disclosure (200 OK)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockDbRow] });

    const adminId = 'a1111111-2222-3333-4444-555555555555';
    const headers = makeGetBffHeaders({
      actorId: adminId,
      roles: ['Administrator']
    });

    const res = await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.disclosure).toEqual(mockDbRow);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 3. Assigned reviewer can read the disclosure
  it('permits assigned Reviewer to read the disclosure (200 OK)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockDbRow] });

    const headers = makeGetBffHeaders({
      actorId: assignedReviewerId,
      roles: ['Reviewer']
    });

    const res = await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.disclosure).toEqual(mockDbRow);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 4. Unassigned reviewer cannot read it
  it('denies unassigned Reviewer from reading disclosure (403 Forbidden)', async () => {
    const unassignedReviewerId = 'r9999999-0000-0000-0000-000000000000';
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error('FORBIDDEN: Actor not authorized to read disclosure'), {
        code: '42501'
      })
    );

    const headers = makeGetBffHeaders({
      actorId: unassignedReviewerId,
      roles: ['Reviewer']
    });

    const res = await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(403);

    expect(res.body.code).toBe('DISCLOSURE_ACCESS_DENIED');
    expect(res.body.detail).toBe('Actor is not authorized to read this disclosure.');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 5. Authorized Legal user can read it
  it('permits assigned Legal Officer to read disclosure (200 OK)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockDbRow] });

    const headers = makeGetBffHeaders({
      actorId: assignedLegalId,
      roles: ['Legal']
    });

    const res = await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.disclosure).toEqual(mockDbRow);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 6. Unassigned Legal user cannot read it
  it('denies unassigned Legal Officer from reading disclosure (403 Forbidden)', async () => {
    const unassignedLegalId = 'l9999999-0000-0000-0000-000000000000';
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error('FORBIDDEN: Actor not authorized to read disclosure'), {
        code: '42501'
      })
    );

    const headers = makeGetBffHeaders({
      actorId: unassignedLegalId,
      roles: ['Legal']
    });

    const res = await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(403);

    expect(res.body.code).toBe('DISCLOSURE_ACCESS_DENIED');
    expect(res.body.detail).toBe('Actor is not authorized to read this disclosure.');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 7. Co-inventor access follows database consent rules
  it('permits active/verified consenting co-inventor to read disclosure (200 OK)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockDbRow] });

    const headers = makeGetBffHeaders({
      actorId: coInventorId,
      roles: ['Student']
    });

    const res = await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.disclosure).toEqual(mockDbRow);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  it('denies revoked co-inventor from reading disclosure (403 Forbidden)', async () => {
    const revokedCoInventorId = 'c9999999-0000-0000-0000-000000000000';
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error('FORBIDDEN: Actor not authorized to read disclosure'), {
        code: '42501'
      })
    );

    const headers = makeGetBffHeaders({
      actorId: revokedCoInventorId,
      roles: ['Student']
    });

    const res = await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(403);

    expect(res.body.code).toBe('DISCLOSURE_ACCESS_DENIED');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 8. Malformed UUID is rejected before database access
  it('rejects malformed UUID with 400 without calling database', async () => {
    const malformedId = 'not-a-valid-uuid-1234';
    const headers = makeGetBffHeaders({ disclosureId: malformedId });

    const res = await request(app)
      .get(`/api/v1/disclosures/${malformedId}`)
      .set(headers)
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.detail).toBe('Disclosure identifier must be a valid UUID.');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 9. Missing database pool returns 503
  it('returns 503 DATABASE_UNAVAILABLE when dbPool is not configured', async () => {
    const appWithoutDb = createApp(testEnv, { nonceStore });
    const headers = makeGetBffHeaders();

    const res = await request(appWithoutDb)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(503);

    expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
    expect(res.body.detail).toBe('Database connection pool is not configured.');
  });

  // 10. Database errors never expose SQL, credentials, or internal details
  it('sanitizes internal database errors and prevents credential leakage (500)', async () => {
    mockPool.query.mockRejectedValueOnce(
      new Error('database error: password=secretDbPass999 host=192.168.1.50 SELECT * FROM public.disclosures')
    );

    const headers = makeGetBffHeaders();

    const res = await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(500);

    expect(res.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.detail).toBe('An unexpected internal error occurred.');
    const jsonString = JSON.stringify(res.body);
    expect(jsonString).not.toContain('secretDbPass999');
    expect(jsonString).not.toContain('192.168.1.50');
    expect(jsonString).not.toContain('SELECT');
  });

  // 11. OP_VIEW_DISCLOSURE scope authorization
  it('denies actor with disallowed role from using OP_VIEW_DISCLOSURE without calling database (403)', async () => {
    const headers = makeGetBffHeaders({
      roles: ['NonExistentRole' as unknown as string]
    });

    const res = await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(403);

    expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // 12. GET request canonicalization with query parameters
  it('matches canonical path, query parameters and empty-body hash in HMAC verification', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockDbRow] });

    const queryParams = 'include=evaluations&status=under_review';
    const headers = makeGetBffHeaders({ queryParams });

    const res = await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}?${queryParams}`)
      .set(headers)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // 13. Exact SQL parameterization and assertion propagation
  it('verifies exact parameterized database call with full 10-key assertion payload', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockDbRow] });

    const actorId = 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = 'param_verify_nonce_12345';

    const headers = makeGetBffHeaders({
      actorId,
      roles: ['Student'],
      timestamp,
      nonce
    });

    await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(200);

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sqlQuery, sqlParams] = mockPool.query.mock.calls[0];

    expect(sqlQuery).toContain('public.get_disclosure_v1($1::jsonb, $2::uuid)');
    expect(sqlParams).toHaveLength(2);

    const parsedAssertion = JSON.parse(sqlParams[0]);
    expect(parsedAssertion).toEqual({
      method: 'GET',
      canonical_path: `/api/v1/disclosures/${sampleDisclosureId}`,
      canonical_query: '',
      operation_scope: 'OP_VIEW_DISCLOSURE',
      actor_id: actorId,
      asserted_roles: ['Student'],
      timestamp,
      nonce,
      body_hash: headers['X-BFF-Body-Hash'],
      signature: headers['X-BFF-Signature']
    });

    expect(sqlParams[1]).toBe(sampleDisclosureId);
  });

  // 14. Disclosure not found returns 404
  it('returns 404 RESOURCE_NOT_FOUND when disclosure does not exist', async () => {
    mockPool.query.mockRejectedValueOnce(
      Object.assign(new Error(`NOT_FOUND: Disclosure "${sampleDisclosureId}" does not exist`), {
        code: 'P0002'
      })
    );

    const headers = makeGetBffHeaders();

    const res = await request(app)
      .get(`/api/v1/disclosures/${sampleDisclosureId}`)
      .set(headers)
      .expect(404);

    expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.detail).toContain('does not exist');
  });
});
