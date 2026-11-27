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

describe('Reviewer Portal Backend Integration & Authorization Tests', () => {
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

  const reviewerId = 'c1111111-2222-3333-4444-555555555555';
  const assignedDisclosureId = 'b1111111-2222-3333-4444-555555555555';
  const unassignedDisclosureId = 'b9999999-8888-7777-6666-555555555555';

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
    const actor = options.actorId || reviewerId;
    const roles = options.roles || ['Reviewer'];
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

  describe('1. Reviewer Disclosures Queue (GET /disclosures)', () => {
    it('Reviewer can list assigned disclosures', async () => {
      const mockAssignedDisclosures = [
        {
          id: assignedDisclosureId,
          trackingNumber: 'PU-IPR-2026-0042',
          title: 'Autonomous Drone Navigation for Precision Agriculture',
          status: 'SUBMITTED',
          primaryInventorId: 'a1111111-2222-3333-4444-555555555555',
          assignedReviewerId: reviewerId,
          reviewStatus: 'ASSIGNED',
          legalClearanceStatus: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockAssignedDisclosures });

      const path = '/api/v1/disclosures';
      const headers = makeBffHeaders({ path });
      const res = await request(app)
        .get(path)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.disclosures).toHaveLength(1);
      expect(res.body.disclosures[0].id).toBe(assignedDisclosureId);
      expect(res.body.disclosures[0].assignedReviewerId).toBe(reviewerId);
    });
  });

  describe('2. Assigned vs Unassigned Disclosure Access (GET /disclosures/:id)', () => {
    it('Reviewer can read full details of an assigned disclosure', async () => {
      const mockDetail = {
        id: assignedDisclosureId,
        trackingNumber: 'PU-IPR-2026-0042',
        title: 'Autonomous Drone Navigation for Precision Agriculture',
        status: 'SUBMITTED',
        primaryInventorId: 'a1111111-2222-3333-4444-555555555555',
        assignedReviewerId: reviewerId,
        reviewStatus: 'ASSIGNED',
        legalClearanceStatus: 'PENDING',
        pidcsData: {
          abstract: 'Novel drone obstacle avoidance algorithm.',
          detailedDescription: 'Full sensor fusion specification.'
        },
        submissionTimestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockDetail] });

      const path = `/api/v1/disclosures/${assignedDisclosureId}`;
      const headers = makeBffHeaders({ path });
      const res = await request(app)
        .get(path)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.disclosure.title).toBe(mockDetail.title);
      expect(res.body.disclosure.pidcsData.abstract).toBe(mockDetail.pidcsData.abstract);
    });

    it('Reviewer is rejected with 403 DISCLOSURE_ACCESS_DENIED for unassigned disclosure', async () => {
      // Database gateway raises insufficient_privilege when actor is neither primary inventor nor assigned reviewer
      const dbForbiddenErr = new Error('FORBIDDEN: Actor not authorized to read disclosure');
      Object.assign(dbForbiddenErr, { code: '42501' });
      mockPool.query.mockRejectedValueOnce(dbForbiddenErr);

      const path = `/api/v1/disclosures/${unassignedDisclosureId}`;
      const headers = makeBffHeaders({ path });
      const res = await request(app)
        .get(path)
        .set(headers);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('DISCLOSURE_ACCESS_DENIED');
      expect(res.body.detail).toContain('Actor is not authorized to read this disclosure');
    });

    it('Reviewer can view attachments and consents of assigned disclosure', async () => {
      const mockConsents = [
        {
          id: 'c1111111-0000-0000-0000-000000000001',
          disclosureId: assignedDisclosureId,
          userId: 'a1111111-2222-3333-4444-555555555555',
          isExternal: false,
          externalName: null,
          externalEmail: null,
          externalOrganization: null,
          shareBasisPoints: 10000,
          status: 'VERIFIED',
          signatureEvidenceId: null,
          createdAt: new Date().toISOString()
        }
      ];

      const mockAttachments = [
        {
          id: 'att-1111-2222-3333-4444',
          disclosureId: assignedDisclosureId,
          fileName: 'schematic.pdf',
          fileSizeBytes: 204800,
          mimeType: 'application/pdf',
          sha256Hash: 'a'.repeat(64),
          scanStatus: 'CLEAN',
          createdAt: new Date().toISOString()
        }
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: mockConsents })
        .mockResolvedValueOnce({ rows: mockAttachments });

      const consentsPath = `/api/v1/disclosures/${assignedDisclosureId}/consents`;
      const consentsHeaders = makeBffHeaders({ path: consentsPath });
      const consentsRes = await request(app)
        .get(consentsPath)
        .set(consentsHeaders);

      expect(consentsRes.status).toBe(200);
      expect(consentsRes.body.consents).toHaveLength(1);

      const attachPath = `/api/v1/disclosures/${assignedDisclosureId}/attachments`;
      const attachHeaders = makeBffHeaders({ path: attachPath });
      const attachRes = await request(app)
        .get(attachPath)
        .set(attachHeaders);

      expect(attachRes.status).toBe(200);
      expect(attachRes.body.attachments).toHaveLength(1);
      expect(attachRes.body.attachments[0].fileName).toBe('schematic.pdf');
    });
  });

  describe('3. Role-Based Access Boundary & Privilege Restriction', () => {
    it('Reviewer CANNOT allocate or assign reviewers (OP_ASSIGN_REVIEWER requires Administrator)', async () => {
      const path = `/api/v1/disclosures/${assignedDisclosureId}/assign-reviewer`;
      const bodyObj = { reviewerId: 'c2222222-2222-3333-4444-555555555555' };
      const headers = makeBffHeaders({
        path,
        method: 'POST',
        scope: 'OP_ASSIGN_REVIEWER',
        roles: ['Reviewer'],
        bodyObj
      });

      const res = await request(app)
        .post(path)
        .set(headers)
        .send(bodyObj);

      // BFF scope middleware rejects Reviewer for OP_ASSIGN_REVIEWER with 403
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    });

    it('Reviewer CANNOT modify or transition patent application stages', async () => {
      const path = '/api/v1/patents';
      const bodyObj = { disclosureId: assignedDisclosureId };
      const headers = makeBffHeaders({
        path,
        method: 'POST',
        scope: 'OP_CREATE_PATENT_APPLICATION',
        roles: ['Reviewer'],
        bodyObj
      });

      const res = await request(app)
        .post(path)
        .set(headers)
        .send(bodyObj);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    });
  });
});
