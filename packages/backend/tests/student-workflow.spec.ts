import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import {
  InMemoryNonceStore,
  computeSha256,
  signCanonicalAssertion,
  buildCanonicalAssertionString,
  OperationScope
} from '@ipr/shared';
import { createApp } from '../src/app.js';
import { BackendEnv } from '../src/config/env.config.js';

describe('Stage 2G — Student Disclosure Workflow Backend Endpoints', () => {
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

  const studentActorId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const sampleDisclosureId = 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

  beforeEach(() => {
    nonceStore = new InMemoryNonceStore(3600);
    mockPool = {
      query: vi.fn()
    };
    app = createApp(testEnv, {
      dbPool: mockPool as unknown as Pool,
      nonceStore
    });
  });

  function makeBffHeaders(params: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    scope: OperationScope;
    body?: unknown;
    actorId?: string;
    roles?: string[];
  }) {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = 'wf_nonce_' + Math.random().toString(36).substring(2) + Date.now();
    const actorId = params.actorId || studentActorId;
    const roles = params.roles || ['Student'];
    const bodyHash = computeSha256(params.body ? JSON.stringify(params.body) : '');

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
      'X-BFF-Signature': signature,
      'X-BFF-Actor-ID': actorId,
      'X-BFF-Roles': roles.join(','),
      'X-BFF-Timestamp': timestamp,
      'X-BFF-Nonce': nonce,
      'X-BFF-Operation-Scope': params.scope,
      'X-BFF-Body-Hash': bodyHash,
      'content-type': 'application/json'
    };
  }

  describe('GET /api/v1/disclosures (List Disclosures)', () => {
    it('returns 401 when BFF assertion is missing', async () => {
      const res = await request(app).get('/api/v1/disclosures');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('BFF_ASSERTION_MISSING_HEADERS');
    });

    it('successfully queries student disclosures and returns list', async () => {
      const mockDisclosures = [
        {
          id: sampleDisclosureId,
          trackingNumber: null,
          title: 'Smart AgTech Sensor',
          status: 'DRAFT',
          primaryInventorId: studentActorId,
          assignedReviewerId: null,
          reviewStatus: 'NOT_ASSIGNED',
          legalClearanceStatus: 'NOT_CLEARED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockDisclosures });

      const headers = makeBffHeaders({
        method: 'GET',
        path: '/api/v1/disclosures',
        scope: 'OP_VIEW_DISCLOSURE'
      });

      const res = await request(app)
        .get('/api/v1/disclosures')
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.disclosures).toHaveLength(1);
      expect(res.body.disclosures[0].title).toBe('Smart AgTech Sensor');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM public.disclosures'),
        [studentActorId]
      );
    });
  });

  describe('GET /api/v1/disclosures/:id/consents', () => {
    it('rejects invalid disclosure UUID with 400', async () => {
      const headers = makeBffHeaders({
        method: 'GET',
        path: '/api/v1/disclosures/not-a-uuid/consents',
        scope: 'OP_VIEW_DISCLOSURE'
      });

      const res = await request(app)
        .get('/api/v1/disclosures/not-a-uuid/consents')
        .set(headers);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('returns inventor consents for valid disclosure', async () => {
      const mockConsents = [
        {
          id: 'c1111111-2222-3333-4444-555555555555',
          disclosureId: sampleDisclosureId,
          userId: studentActorId,
          isExternal: false,
          externalName: null,
          externalEmail: null,
          externalOrganization: null,
          shareBasisPoints: 5000,
          status: 'VERIFIED',
          signatureEvidenceId: null,
          createdAt: new Date().toISOString()
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockConsents });

      const headers = makeBffHeaders({
        method: 'GET',
        path: `/api/v1/disclosures/${sampleDisclosureId}/consents`,
        scope: 'OP_VIEW_DISCLOSURE'
      });

      const res = await request(app)
        .get(`/api/v1/disclosures/${sampleDisclosureId}/consents`)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.consents).toHaveLength(1);
      expect(res.body.consents[0].shareBasisPoints).toBe(5000);
    });
  });

  describe('GET /api/v1/disclosures/:id/attachments', () => {
    it('returns attachments with scan status', async () => {
      const mockAttachments = [
        {
          id: 'a1111111-2222-3333-4444-555555555555',
          disclosureId: sampleDisclosureId,
          fileName: 'spec.pdf',
          fileSizeBytes: 1048576,
          mimeType: 'application/pdf',
          sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          scanStatus: 'CLEAN',
          createdAt: new Date().toISOString()
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockAttachments });

      const headers = makeBffHeaders({
        method: 'GET',
        path: `/api/v1/disclosures/${sampleDisclosureId}/attachments`,
        scope: 'OP_VIEW_DISCLOSURE'
      });

      const res = await request(app)
        .get(`/api/v1/disclosures/${sampleDisclosureId}/attachments`)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.attachments[0].scanStatus).toBe('CLEAN');
    });
  });

  describe('POST /api/v1/attachments (Create Attachment Metadata)', () => {
    it('validates attachment schema and registers metadata in PENDING_SCAN state', async () => {
      const body = {
        disclosureId: sampleDisclosureId,
        fileName: 'patent-claim.pdf',
        fileSizeBytes: 20480,
        mimeType: 'application/pdf',
        sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        storagePath: `disclosures/${sampleDisclosureId}/claim.pdf`
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            out_attachment_id: 'a9999999-8888-7777-6666-555555555555',
            out_token_id: 't9999999-8888-7777-6666-555555555555',
            out_token_expires_at: new Date(Date.now() + 3600000).toISOString()
          }
        ]
      });

      const headers = makeBffHeaders({
        method: 'POST',
        path: '/api/v1/attachments',
        scope: 'OP_UPLOAD_ATTACHMENT',
        body
      });

      const res = await request(app)
        .post('/api/v1/attachments')
        .set(headers)
        .send(body);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.attachmentId).toBe('a9999999-8888-7777-6666-555555555555');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('create_attachment_metadata_v1'),
        expect.arrayContaining([
          expect.any(String),
          sampleDisclosureId,
          'patent-claim.pdf',
          20480,
          'application/pdf',
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        ])
      );
    });

    it('rejects attachment with invalid sha256 with 400', async () => {
      const body = {
        disclosureId: sampleDisclosureId,
        fileName: 'test.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'not-a-valid-sha256',
        storagePath: 'disclosures/123/test.pdf'
      };

      const headers = makeBffHeaders({
        method: 'POST',
        path: '/api/v1/attachments',
        scope: 'OP_UPLOAD_ATTACHMENT',
        body
      });

      const res = await request(app)
        .post('/api/v1/attachments')
        .set(headers)
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
    });
  });

  describe('POST /api/v1/consent/request (Create Inventor Consent)', () => {
    it('creates external co-inventor consent request', async () => {
      const body = {
        disclosureId: sampleDisclosureId,
        shareBasisPoints: 2000,
        isExternal: true,
        externalName: 'Dr. Jane Smith',
        externalEmail: 'jane.smith@external-lab.org',
        externalOrganization: 'National Research Center'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ consent_id: 'c2222222-3333-4444-5555-666666666666' }]
      });

      const headers = makeBffHeaders({
        method: 'POST',
        path: '/api/v1/consent/request',
        scope: 'OP_CREATE_CONSENT',
        body
      });

      const res = await request(app)
        .post('/api/v1/consent/request')
        .set(headers)
        .send(body);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.consentId).toBe('c2222222-3333-4444-5555-666666666666');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('create_inventor_consent_request_v1'),
        expect.arrayContaining([
          expect.any(String),
          sampleDisclosureId,
          2000,
          null,
          true,
          'Dr. Jane Smith',
          'jane.smith@external-lab.org',
          'National Research Center'
        ])
      );
    });

    it('rejects external inventor without name/email with 400', async () => {
      const body = {
        disclosureId: sampleDisclosureId,
        shareBasisPoints: 2000,
        isExternal: true
      };

      const headers = makeBffHeaders({
        method: 'POST',
        path: '/api/v1/consent/request',
        scope: 'OP_CREATE_CONSENT',
        body
      });

      const res = await request(app)
        .post('/api/v1/consent/request')
        .set(headers)
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
    });
  });

  describe('POST /api/v1/consent/revoke (Revoke Inventor Consent)', () => {
    it('revokes consent request successfully', async () => {
      const body = {
        consentId: 'c2222222-3333-4444-5555-666666666666'
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const headers = makeBffHeaders({
        method: 'POST',
        path: '/api/v1/consent/revoke',
        scope: 'OP_REVOKE_CONSENT',
        body
      });

      const res = await request(app)
        .post('/api/v1/consent/revoke')
        .set(headers)
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('revoke_inventor_consent_v1'),
        [expect.any(String), body.consentId]
      );
    });
  });
});
