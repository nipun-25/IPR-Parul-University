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

describe('Legal Portal Backend Integration & Authorization Tests', () => {
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

  const legalOfficerId = 'd1111111-2222-3333-4444-555555555555';
  const otherLegalOfficerId = 'd2222222-2222-3333-4444-555555555555';
  const disclosureId = 'b1111111-2222-3333-4444-555555555555';
  const patentApplicationId = 'e1111111-2222-3333-4444-555555555555';

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

  function makeBffHeaders(options: {
    path: string;
    method?: string;
    actorId?: string;
    roles?: string[];
    scope?: string;
    bodyObj?: Record<string, unknown>;
  }) {
    const path = options.path;
    const method = options.method || 'GET';
    const actor = options.actorId || legalOfficerId;
    const roles = options.roles || ['Legal'];
    const scope = options.scope || 'OP_VIEW_DISCLOSURE';
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = 'nonce_' + Math.random().toString(36).substring(2) + Date.now();
    const bodyStr = options.bodyObj ? JSON.stringify(options.bodyObj) : '';
    const bodyHash = computeSha256(Buffer.from(bodyStr));

    const canonicalString = buildCanonicalAssertionString({
      method,
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

  describe('1. Legal Clearance (POST /disclosures/:id/legal-clearance)', () => {
    it('Legal Officer can record CLEARED legal clearance', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const path = `/api/v1/disclosures/${disclosureId}/legal-clearance`;
      const body = {
        clearanceStatus: 'CLEARED',
        clearanceNotes: 'Patent search conducted on IPO inPASS. No anticipatory prior art found.'
      };
      const headers = makeBffHeaders({
        path,
        method: 'POST',
        scope: 'OP_LEGAL_CLEARANCE',
        bodyObj: body
      });

      const res = await request(app)
        .post(path)
        .set(headers)
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.clearanceStatus).toBe('CLEARED');
    });

    it('rejects legal clearance attempt from non-Legal actors (e.g. Student, Reviewer) at BFF boundary', async () => {
      const path = `/api/v1/disclosures/${disclosureId}/legal-clearance`;
      const body = {
        clearanceStatus: 'CLEARED',
        clearanceNotes: 'Unauthorized attempt'
      };
      const headers = makeBffHeaders({
        path,
        method: 'POST',
        scope: 'OP_LEGAL_CLEARANCE',
        roles: ['Reviewer'],
        bodyObj: body
      });

      const res = await request(app)
        .post(path)
        .set(headers)
        .send(body);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    });

    it('rejects legal clearance on DRAFT disclosure with 422 INVALID_WORKFLOW_STATE', async () => {
      const dbErr = new Error('INVALID_STATE: Legal clearance can only be recorded on SUBMITTED or APPROVED disclosures');
      mockPool.query.mockRejectedValueOnce(dbErr);

      const path = `/api/v1/disclosures/${disclosureId}/legal-clearance`;
      const body = {
        clearanceStatus: 'CLEARED',
        clearanceNotes: 'Attempt on draft'
      };
      const headers = makeBffHeaders({
        path,
        method: 'POST',
        scope: 'OP_LEGAL_CLEARANCE',
        bodyObj: body
      });

      const res = await request(app)
        .post(path)
        .set(headers)
        .send(body);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_WORKFLOW_STATE');
    });
  });

  describe('2. Patent Application Docket Creation (POST /patents)', () => {
    it('Legal Officer can create patent application from cleared disclosure', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ application_id: patentApplicationId }]
      });

      const path = '/api/v1/patents';
      const body = { disclosureId };
      const headers = makeBffHeaders({
        path,
        method: 'POST',
        scope: 'OP_CREATE_PATENT_APPLICATION',
        bodyObj: body
      });

      const res = await request(app)
        .post(path)
        .set(headers)
        .send(body);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.application.id).toBe(patentApplicationId);
      expect(res.body.application.currentStage).toBe('FILING_PREPARATION');
    });

    it('rejects patent application creation if disclosure is not CLEARED (422 INVALID_WORKFLOW_STATE)', async () => {
      const dbErr = new Error('INVALID_STATE: Patent applications can only be created from disclosures with CLEARED legal clearance (current: PENDING)');
      mockPool.query.mockRejectedValueOnce(dbErr);

      const path = '/api/v1/patents';
      const body = { disclosureId };
      const headers = makeBffHeaders({
        path,
        method: 'POST',
        scope: 'OP_CREATE_PATENT_APPLICATION',
        bodyObj: body
      });

      const res = await request(app)
        .post(path)
        .set(headers)
        .send(body);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_WORKFLOW_STATE');
    });

    it('rejects duplicate patent application in FILING_PREPARATION with 409 DUPLICATE_APPLICATION', async () => {
      const dbErr = new Error('DUPLICATE_APPLICATION: An active patent application is already in FILING_PREPARATION for disclosure');
      mockPool.query.mockRejectedValueOnce(dbErr);

      const path = '/api/v1/patents';
      const body = { disclosureId };
      const headers = makeBffHeaders({
        path,
        method: 'POST',
        scope: 'OP_CREATE_PATENT_APPLICATION',
        bodyObj: body
      });

      const res = await request(app)
        .post(path)
        .set(headers)
        .send(body);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_APPLICATION');
    });
  });

  describe('3. Patent Application Retrieval & Case Isolation (GET /patents/:id)', () => {
    it('Legal Officer can view their assigned patent application docket', async () => {
      const mockApp = {
        id: patentApplicationId,
        disclosureId,
        currentStage: 'FILING_PREPARATION',
        assignedLegalOfficerId: legalOfficerId,
        currentHistoryId: 'hist-1111-2222',
        filingDate: null,
        applicationNumber: '202621004821',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockApp] });

      const path = `/api/v1/patents/${patentApplicationId}`;
      const headers = makeBffHeaders({ path });

      const res = await request(app)
        .get(path)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.application.id).toBe(patentApplicationId);
      expect(res.body.application.currentStage).toBe('FILING_PREPARATION');
    });

    it('rejects access when legal officer is not assigned to the patent case (403 PATENT_ACCESS_DENIED)', async () => {
      const dbErr = new Error('FORBIDDEN: Legal officer not assigned to this patent case');
      Object.assign(dbErr, { code: '42501' });
      mockPool.query.mockRejectedValueOnce(dbErr);

      const path = `/api/v1/patents/${patentApplicationId}`;
      const headers = makeBffHeaders({
        path,
        actorId: otherLegalOfficerId
      });

      const res = await request(app)
        .get(path)
        .set(headers);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PATENT_ACCESS_DENIED');
    });
  });

  describe('4. Statutory Stage Transitions (POST /patents/:id/stage-transition)', () => {
    it('Legal Officer can transition patent stage along permitted matrix', async () => {
      const mockHistoryId = 'hist-9999-8888-7777-6666';
      mockPool.query.mockResolvedValueOnce({
        rows: [{ history_id: mockHistoryId }]
      });

      const path = `/api/v1/patents/${patentApplicationId}/stage-transition`;
      const body = {
        toStage: 'FORMALITIES_CHECK',
        transitionReason: 'Form 1 and Form 2 filed online with CBR confirmation receipt'
      };
      const headers = makeBffHeaders({
        path,
        method: 'POST',
        scope: 'OP_TRANSITION_PATENT_STAGE',
        bodyObj: body
      });

      const res = await request(app)
        .post(path)
        .set(headers)
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toStage).toBe('FORMALITIES_CHECK');
      expect(res.body.data.historyId).toBe(mockHistoryId);
    });

    it('rejects illegal stage transition violating institutional matrix with 422 INVALID_TRANSITION', async () => {
      const dbErr = new Error('INVALID_TRANSITION: Stage transition from "FILING_PREPARATION" to "GRANTED" is not permitted by institutional matrix');
      mockPool.query.mockRejectedValueOnce(dbErr);

      const path = `/api/v1/patents/${patentApplicationId}/stage-transition`;
      const body = {
        toStage: 'GRANTED',
        transitionReason: 'Illegal shortcut'
      };
      const headers = makeBffHeaders({
        path,
        method: 'POST',
        scope: 'OP_TRANSITION_PATENT_STAGE',
        bodyObj: body
      });

      const res = await request(app)
        .post(path)
        .set(headers)
        .send(body);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_TRANSITION');
    });

    it('rejects stage transition out of terminal state with 422 INVALID_OPERATION', async () => {
      const dbErr = new Error('INVALID_OPERATION: Cannot transition out of terminal patent stage "GRANTED"');
      mockPool.query.mockRejectedValueOnce(dbErr);

      const path = `/api/v1/patents/${patentApplicationId}/stage-transition`;
      const body = {
        toStage: 'FORMALITIES_CHECK',
        transitionReason: 'Attempt to reopen granted patent'
      };
      const headers = makeBffHeaders({
        path,
        method: 'POST',
        scope: 'OP_TRANSITION_PATENT_STAGE',
        bodyObj: body
      });

      const res = await request(app)
        .post(path)
        .set(headers)
        .send(body);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_OPERATION');
    });
  });
});
