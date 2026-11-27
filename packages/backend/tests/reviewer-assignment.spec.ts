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

describe('POST /api/v1/disclosures/:id/assign-reviewer — Reviewer Assignment Controller', () => {
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
  const adminActorId = 'ad111111-2222-3333-4444-555555555555';
  const validReviewerId = 'c1111111-2222-3333-4444-555555555555';

  function makeBffHeaders(options: {
    disclosureId?: string;
    actorId?: string;
    roles?: string[];
    scope?: string;
    bodyObj?: Record<string, unknown>;
  }) {
    const discId = options.disclosureId || sampleDisclosureId;
    const path = `/api/v1/disclosures/${discId}/assign-reviewer`;
    const actor = options.actorId || adminActorId;
    const roles = options.roles || ['Administrator'];
    const scope = options.scope || 'OP_ASSIGN_REVIEWER';
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = 'nonce_' + Math.random().toString(36).substring(2) + Date.now();
    const bodyStr = options.bodyObj ? JSON.stringify(options.bodyObj) : '';
    const bodyHash = computeSha256(Buffer.from(bodyStr));

    const canonicalString = buildCanonicalAssertionString({
      method: 'POST',
      canonicalPath: path,
      queryParams: '',
      operationScope: scope,
      actorId: actor,
      roles,
      timestamp,
      nonce,
      bodyHash
    });

    const signature = signCanonicalAssertion(canonicalString, secretHex);

    return {
      'X-BFF-Signature': signature,
      'X-BFF-Actor-ID': actor,
      'X-BFF-Roles': roles.join(','),
      'X-BFF-Timestamp': timestamp,
      'X-BFF-Nonce': nonce,
      'X-BFF-Operation-Scope': scope,
      'X-BFF-Body-Hash': bodyHash,
      'X-Request-ID': 'req_' + Date.now(),
      'Content-Type': 'application/json'
    };
  }

  beforeEach(() => {
    nonceStore = new InMemoryNonceStore(3600);
    mockPool = { query: vi.fn() };
    app = createApp(testEnv, {
      dbPool: mockPool as unknown as Pool,
      nonceStore
    });
  });

  it('successfully assigns an active reviewer when invoked by an Administrator', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const body = { reviewerId: validReviewerId };
    const headers = makeBffHeaders({ bodyObj: body });

    const res = await request(app)
      .post(`/api/v1/disclosures/${sampleDisclosureId}/assign-reviewer`)
      .set(headers)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Reviewer successfully assigned');
    expect(res.body.disclosureId).toBe(sampleDisclosureId);
    expect(res.body.reviewerId).toBe(validReviewerId);

    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT public.assign_disclosure_reviewer_v1($1::jsonb, $2::uuid, $3::uuid)',
      [expect.any(String), sampleDisclosureId, validReviewerId]
    );
  });

  it('rejects assignment attempts from non-Administrator actors at BFF boundary with 403 BFF_SCOPE_AUTHORIZATION_DENIED', async () => {
    const body = { reviewerId: validReviewerId };
    const headers = makeBffHeaders({
      roles: ['Student'],
      bodyObj: body
    });

    const res = await request(app)
      .post(`/api/v1/disclosures/${sampleDisclosureId}/assign-reviewer`)
      .set(headers)
      .send(body);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
  });

  it('rejects assignment when database rejects actor role context with 403 ADMIN_FORBIDDEN', async () => {
    const error = new Error('FORBIDDEN: User does not possess the Administrator role');
    Object.assign(error, { code: '42501' });
    mockPool.query.mockRejectedValueOnce(error);

    const body = { reviewerId: validReviewerId };
    const headers = makeBffHeaders({ bodyObj: body });

    const res = await request(app)
      .post(`/api/v1/disclosures/${sampleDisclosureId}/assign-reviewer`)
      .set(headers)
      .send(body);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_FORBIDDEN');
    expect(res.body.detail).toContain('Only institutional Administrators');
  });

  it('rejects assigning a target user who does not possess the Reviewer role with 403 INVALID_REVIEWER_ROLE', async () => {
    const error = new Error('FORBIDDEN: User does not possess the Reviewer role');
    Object.assign(error, { code: '42501' });
    mockPool.query.mockRejectedValueOnce(error);

    const body = { reviewerId: 'e1111111-2222-3333-4444-555555555555' };
    const headers = makeBffHeaders({ bodyObj: body });

    const res = await request(app)
      .post(`/api/v1/disclosures/${sampleDisclosureId}/assign-reviewer`)
      .set(headers)
      .send(body);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INVALID_REVIEWER_ROLE');
    expect(res.body.detail).toContain('Reviewer role');
  });

  it('returns 404 RESOURCE_NOT_FOUND when disclosure does not exist', async () => {
    const error = new Error(`NOT_FOUND: Disclosure "${sampleDisclosureId}" does not exist`);
    Object.assign(error, { code: 'P0002' });
    mockPool.query.mockRejectedValueOnce(error);

    const body = { reviewerId: validReviewerId };
    const headers = makeBffHeaders({ bodyObj: body });

    const res = await request(app)
      .post(`/api/v1/disclosures/${sampleDisclosureId}/assign-reviewer`)
      .set(headers)
      .send(body);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns 422 INVALID_WORKFLOW_STATE when disclosure is not in SUBMITTED or APPROVED status', async () => {
    const error = new Error('INVALID_STATE: Reviewers can only be assigned to SUBMITTED or APPROVED disclosures (current: DRAFT)');
    mockPool.query.mockRejectedValueOnce(error);

    const body = { reviewerId: validReviewerId };
    const headers = makeBffHeaders({ bodyObj: body });

    const res = await request(app)
      .post(`/api/v1/disclosures/${sampleDisclosureId}/assign-reviewer`)
      .set(headers)
      .send(body);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_WORKFLOW_STATE');
    expect(res.body.detail).toContain('SUBMITTED or APPROVED');
  });

  it('returns 400 VALIDATION_FAILED for malformed disclosure UUID or invalid reviewer UUID', async () => {
    const headers = makeBffHeaders({
      disclosureId: 'not-a-valid-uuid',
      bodyObj: { reviewerId: validReviewerId }
    });

    const res = await request(app)
      .post('/api/v1/disclosures/not-a-valid-uuid/assign-reviewer')
      .set(headers)
      .send({ reviewerId: validReviewerId });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('rejects requests without BFF assertion headers with 401', async () => {
    const res = await request(app)
      .post(`/api/v1/disclosures/${sampleDisclosureId}/assign-reviewer`)
      .send({ reviewerId: validReviewerId });

    expect(res.status).toBe(401);
  });
});
