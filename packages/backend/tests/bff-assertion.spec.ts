import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import {
  InMemoryNonceStore,
  TestResourceAuthorizationProvider,
  computeSha256,
  signCanonicalAssertion,
  buildCanonicalAssertionString
} from '@ipr/shared';
import { createApp } from '../src/app.js';
import { BackendEnv } from '../src/config/env.config.js';

describe('BFF Assertion Verification Middleware & Protected Boundary (Gate A2 Integration)', () => {
  const secretHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let nonceStore: InMemoryNonceStore;
  let resourceAuthProvider: TestResourceAuthorizationProvider;
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

  beforeEach(() => {
    nonceStore = new InMemoryNonceStore(3600); // 1 hour TTL for testing
    resourceAuthProvider = new TestResourceAuthorizationProvider([
      {
        resourceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ownerId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        coInventorIds: [],
        assignedReviewerIds: [],
        workflowStage: 'DRAFT'
      },
      {
        resourceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ownerId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        coInventorIds: [],
        assignedReviewerIds: ['a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e'],
        workflowStage: 'UNDER_REVIEW'
      },
      {
        resourceId: 'other-student-disc',
        ownerId: 'student-owner-uuid',
        coInventorIds: [],
        assignedReviewerIds: [],
        workflowStage: 'SUBMITTED'
      }
    ]);
    const mockDbPool = {
      query: vi.fn().mockImplementation((_queryText: string, params: unknown[]) => {
        const id = Array.isArray(params) && params[1] ? params[1] : 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
        if (id === 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22') {
          return Promise.reject(
            Object.assign(new Error('FORBIDDEN: Only the primary inventor may submit this disclosure'), {
              code: '42501'
            })
          );
        }
        return Promise.resolve({
          rows: [
            {
              id,
              tracking_number: 'IPR-202611001-XYZ',
              trackingNumber: 'IPR-202611001-XYZ',
              title: 'Test Disclosure',
              status: 'DRAFT',
              primaryInventorId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
              assignedReviewerId: null,
              reviewStatus: 'UNASSIGNED',
              legalClearanceStatus: 'PENDING',
              pidcsData: {},
              submissionTimestamp: null,
              createdAt: '2026-11-26T12:00:00Z',
              updatedAt: '2026-11-26T12:00:00Z'
            }
          ]
        });
      })
    } as unknown as Pool;
    app = createApp(testEnv, { nonceStore, resourceAuthProvider, dbPool: mockDbPool });
  });

  describe('Centralized Protected-Router Boundary Coverage', () => {
    it('permits public /health endpoint without any BFF assertion headers', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.environment).toBe('test');
    });

    it('rejects unauthenticated requests to protected /api/v1 endpoints with 401', async () => {
      const res = await request(app)
        .get('/api/v1/disclosures/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .expect(401);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('BFF_ASSERTION_MISSING_HEADERS');
    });

    it('fails closed when database connection pool is missing (503)', async () => {
      const appWithoutResourceProvider = createApp(testEnv, { nonceStore });
      const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const uniqueNonce = 'missing_provider_nonce_' + Math.random().toString(36).substring(2);
      const postPayload = '{"clientChecksum":"f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2"}';
      const postBodyHash = computeSha256(postPayload);

      const canonical = buildCanonicalAssertionString({
        method: 'POST',
        canonicalPath: '/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit',
        queryParams: '',
        operationScope: 'OP_SUBMIT_DISCLOSURE',
        actorId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        roles: ['Faculty'],
        timestamp: nowIso,
        nonce: uniqueNonce,
        bodyHash: postBodyHash
      });

      const signature = signCanonicalAssertion(canonical, secretHex);

      const res = await request(appWithoutResourceProvider)
        .post('/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit')
        .set('Content-Type', 'application/json')
        .set('X-BFF-Signature', signature)
        .set('X-BFF-Actor-ID', 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d')
        .set('X-BFF-Roles', 'Faculty')
        .set('X-BFF-Timestamp', nowIso)
        .set('X-BFF-Nonce', uniqueNonce)
        .set('X-BFF-Operation-Scope', 'OP_SUBMIT_DISCLOSURE')
        .set('X-BFF-Body-Hash', postBodyHash)
        .send(postPayload)
        .expect(503);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
    });

    it('enforces object-level authorization and rejects student accessing another student disclosure (403)', async () => {
      const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const uniqueNonce = 'student_unauth_nonce_' + Math.random().toString(36).substring(2);
      const postPayload = '{"clientChecksum":"f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2"}';
      const postBodyHash = computeSha256(postPayload);

      const canonical = buildCanonicalAssertionString({
        method: 'POST',
        canonicalPath: '/api/v1/drafts/b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22/submit',
        queryParams: '',
        operationScope: 'OP_SUBMIT_DISCLOSURE',
        actorId: 'student-attacker-uuid', // Not owner of target disclosure
        roles: ['Student'],
        timestamp: nowIso,
        nonce: uniqueNonce,
        bodyHash: postBodyHash
      });

      const signature = signCanonicalAssertion(canonical, secretHex);

      const res = await request(app)
        .post('/api/v1/drafts/b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22/submit')
        .set('Content-Type', 'application/json')
        .set('X-BFF-Signature', signature)
        .set('X-BFF-Actor-ID', 'student-attacker-uuid')
        .set('X-BFF-Roles', 'Student')
        .set('X-BFF-Timestamp', nowIso)
        .set('X-BFF-Nonce', uniqueNonce)
        .set('X-BFF-Operation-Scope', 'OP_SUBMIT_DISCLOSURE')
        .set('X-BFF-Body-Hash', postBodyHash)
        .send(postPayload)
        .expect(403);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.detail).toContain('primary inventor');
    });
  });

  describe('Revision 8 POST Submission Vector Execution', () => {
    const postPayload = '{"clientChecksum":"f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2"}';
    const postBodyHash = 'ffed0e09ec0b1e3b43f840c702a9853735eff5c6dd0a3acec763e0723b486dfa';
    const postSignature = 'f1ff1881ee136c675e74891e7a4d3f10ef6c1fbeab783696928ca08fb26eac4f';

    it('accepts authentic Revision 8 POST vector and sets trusted actor context', async () => {
      const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const uniqueNonce = 'live_post_nonce_' + Math.random().toString(36).substring(2);

      const canonical = buildCanonicalAssertionString({
        method: 'POST',
        canonicalPath: '/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit',
        queryParams: '',
        operationScope: 'OP_SUBMIT_DISCLOSURE',
        actorId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        roles: ['Faculty'],
        timestamp: nowIso,
        nonce: uniqueNonce,
        bodyHash: postBodyHash
      });

      const signature = signCanonicalAssertion(canonical, secretHex);

      const res = await request(app)
        .post('/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit')
        .set('Content-Type', 'application/json')
        .set('X-BFF-Signature', signature)
        .set('X-BFF-Actor-ID', 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d')
        .set('X-BFF-Roles', 'Faculty')
        .set('X-BFF-Timestamp', nowIso)
        .set('X-BFF-Nonce', uniqueNonce)
        .set('X-BFF-Operation-Scope', 'OP_SUBMIT_DISCLOSURE')
        .set('X-BFF-Body-Hash', postBodyHash)
        .send(postPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.actor).toMatchObject({
        actorId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        roles: ['Faculty'],
        operationScope: 'OP_SUBMIT_DISCLOSURE',
        nonce: uniqueNonce
      });
    });

    it('verifies exact mathematical Revision 8 POST vector with static timestamp', async () => {
      const canonical = [
        'POST',
        '/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit',
        '',
        'OP_SUBMIT_DISCLOSURE',
        'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        'Faculty',
        '2026-11-24T10:00:00Z',
        'c8f13e7b9a5d4c2e8f1a3b5c7d9e1f3a',
        postBodyHash
      ].join('\n');

      const expectedSignature = signCanonicalAssertion(canonical, secretHex);
      expect(expectedSignature).toBe(postSignature);

      const wideSkewEnv = { ...testEnv };
      const wideApp = createApp(wideSkewEnv, {
        nonceStore: new InMemoryNonceStore(1000000000),
        allowedClockSkewSeconds: 1000000000,
        resourceAuthProvider
      });

      const res = await request(wideApp)
        .post('/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit')
        .set('Content-Type', 'application/json')
        .set('X-BFF-Signature', '0000000000000000000000000000000000000000000000000000000000000000')
        .set('X-BFF-Actor-ID', 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d')
        .set('X-BFF-Roles', 'Faculty')
        .set('X-BFF-Timestamp', '2026-11-24T10:00:00Z')
        .set('X-BFF-Nonce', 'c8f13e7b9a5d4c2e8f1a3b5c7d9e1f3a')
        .set('X-BFF-Operation-Scope', 'OP_SUBMIT_DISCLOSURE')
        .send(postPayload)
        .expect(401);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('BFF_SIGNATURE_INVALID');
    });
  });

  describe('Revision 8 GET Vector Execution', () => {
    it('accepts authentic Revision 8 GET query with parameters', async () => {
      const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const uniqueNonce = 'live_get_nonce_' + Math.random().toString(36).substring(2);
      const emptyBodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

      const canonical = buildCanonicalAssertionString({
        method: 'GET',
        canonicalPath: '/api/v1/disclosures/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        queryParams: 'include=evaluations&status=under_review',
        operationScope: 'OP_VIEW_DISCLOSURE',
        actorId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e',
        roles: ['Administrator', 'Reviewer'],
        timestamp: nowIso,
        nonce: uniqueNonce,
        bodyHash: emptyBodyHash
      });

      const signature = signCanonicalAssertion(canonical, secretHex);

      const res = await request(app)
        .get('/api/v1/disclosures/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11?status=under_review&include=evaluations')
        .set('X-BFF-Signature', signature)
        .set('X-BFF-Actor-ID', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e')
        .set('X-BFF-Roles', 'Administrator,Reviewer')
        .set('X-BFF-Timestamp', nowIso)
        .set('X-BFF-Nonce', uniqueNonce)
        .set('X-BFF-Operation-Scope', 'OP_VIEW_DISCLOSURE')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.disclosureId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(res.body.actor.roles).toEqual(['Administrator', 'Reviewer']);
    });
  });

  describe('Replay Protection & Fail-Closed Behavior', () => {
    it('rejects duplicate requests using the same nonce (409 Conflict)', async () => {
      const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const reusableNonce = 'replay_test_nonce_999';
      const emptyBodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

      const canonical = buildCanonicalAssertionString({
        method: 'GET',
        canonicalPath: '/api/v1/disclosures/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        queryParams: '',
        operationScope: 'OP_VIEW_DISCLOSURE',
        actorId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e',
        roles: ['Reviewer'],
        timestamp: nowIso,
        nonce: reusableNonce,
        bodyHash: emptyBodyHash
      });

      const signature = signCanonicalAssertion(canonical, secretHex);

      // First request: Must succeed
      await request(app)
        .get('/api/v1/disclosures/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .set('X-BFF-Signature', signature)
        .set('X-BFF-Actor-ID', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e')
        .set('X-BFF-Roles', 'Reviewer')
        .set('X-BFF-Timestamp', nowIso)
        .set('X-BFF-Nonce', reusableNonce)
        .set('X-BFF-Operation-Scope', 'OP_VIEW_DISCLOSURE')
        .expect(200);

      // Second request (identical nonce): Must be rejected with 409
      const replayRes = await request(app)
        .get('/api/v1/disclosures/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .set('X-BFF-Signature', signature)
        .set('X-BFF-Actor-ID', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e')
        .set('X-BFF-Roles', 'Reviewer')
        .set('X-BFF-Timestamp', nowIso)
        .set('X-BFF-Nonce', reusableNonce)
        .set('X-BFF-Operation-Scope', 'OP_VIEW_DISCLOSURE')
        .expect(409);

      expect(replayRes.headers['content-type']).toContain('application/problem+json');
      expect(replayRes.body.code).toBe('ASSERTION_REPLAY_DETECTED');
    });

    it('fails closed when the nonce store is unavailable (503 Service Unavailable)', async () => {
      const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const nonce = 'fail_closed_test_nonce';
      const emptyBodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

      const canonical = buildCanonicalAssertionString({
        method: 'GET',
        canonicalPath: '/api/v1/disclosures/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        queryParams: '',
        operationScope: 'OP_VIEW_DISCLOSURE',
        actorId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e',
        roles: ['Reviewer'],
        timestamp: nowIso,
        nonce,
        bodyHash: emptyBodyHash
      });

      const signature = signCanonicalAssertion(canonical, secretHex);

      // Simulate store outage
      nonceStore.setSimulateFailure(true);

      const res = await request(app)
        .get('/api/v1/disclosures/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .set('X-BFF-Signature', signature)
        .set('X-BFF-Actor-ID', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e')
        .set('X-BFF-Roles', 'Reviewer')
        .set('X-BFF-Timestamp', nowIso)
        .set('X-BFF-Nonce', nonce)
        .set('X-BFF-Operation-Scope', 'OP_VIEW_DISCLOSURE')
        .expect(503);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('NONCE_STORE_UNAVAILABLE');
    });
  });

  describe('Scope and Role Authorization Controls', () => {
    it('rejects mismatched HTTP method for scope (e.g. GET with OP_SUBMIT_DISCLOSURE)', async () => {
      const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const nonce = 'scope_mismatch_nonce';
      const emptyBodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

      const canonical = buildCanonicalAssertionString({
        method: 'GET',
        canonicalPath: '/api/v1/disclosures/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        queryParams: '',
        operationScope: 'OP_SUBMIT_DISCLOSURE', // Scope only allows POST
        actorId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        roles: ['Faculty'],
        timestamp: nowIso,
        nonce,
        bodyHash: emptyBodyHash
      });

      const signature = signCanonicalAssertion(canonical, secretHex);

      const res = await request(app)
        .get('/api/v1/disclosures/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .set('X-BFF-Signature', signature)
        .set('X-BFF-Actor-ID', 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d')
        .set('X-BFF-Roles', 'Faculty')
        .set('X-BFF-Timestamp', nowIso)
        .set('X-BFF-Nonce', nonce)
        .set('X-BFF-Operation-Scope', 'OP_SUBMIT_DISCLOSURE')
        .expect(403);

      expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
      expect(res.body.detail).toContain('is not permitted for scope');
    });

    it('rejects unauthorized actor roles for scope (e.g. Student with OP_REVIEW_EVALUATION)', async () => {
      const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const nonce = 'role_unauthorized_nonce';
      const emptyBodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

      const canonical = buildCanonicalAssertionString({
        method: 'POST',
        canonicalPath: '/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit',
        queryParams: '',
        operationScope: 'OP_REVIEW_EVALUATION', // Requires Reviewer
        actorId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        roles: ['Student'], // Student is not authorized
        timestamp: nowIso,
        nonce,
        bodyHash: emptyBodyHash
      });

      const signature = signCanonicalAssertion(canonical, secretHex);

      const res = await request(app)
        .post('/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit')
        .set('X-BFF-Signature', signature)
        .set('X-BFF-Actor-ID', 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d')
        .set('X-BFF-Roles', 'Student')
        .set('X-BFF-Timestamp', nowIso)
        .set('X-BFF-Nonce', nonce)
        .set('X-BFF-Operation-Scope', 'OP_REVIEW_EVALUATION')
        .expect(403);

      expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
      expect(res.body.detail).toContain('None of actor roles [Student] are authorized');
    });
  });
});
