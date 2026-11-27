import crypto from 'node:crypto';
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
import { BackendEnv } from '../src/config/env.config.js';
import { AntivirusScannerService } from '../src/services/scanner.service.js';

describe('Stage 2G.3 — Complete Student Portal End-to-End Workflow & Business Rules', () => {
  const secretHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const csrfSecret = '8f4e2b1c9a7d3e5f6a8b0c2d4e6f8a0b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f';
  let nonceStore: InMemoryNonceStore;
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockScannerPool: { query: ReturnType<typeof vi.fn> };
  let quarantineStorage: InMemoryQuarantineStorage;
  let scannerService: AntivirusScannerService;
  let app: ReturnType<typeof createApp>;

  const testEnv: BackendEnv = {
    NODE_ENV: 'test',
    PORT: 4002,
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    BFF_SHARED_SECRET: secretHex,
    CSRF_SECRET: csrfSecret,
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
  const internalCoInventorId = 'b1111111-2222-3333-4444-555555555555';
  const reviewerActorId = 'r1111111-2222-3333-4444-555555555555';
  const _adminActorId = 'ad111111-2222-3333-4444-555555555555';
  const disclosureId = 'd1111111-2222-3333-4444-555555555555';
  const attachmentId = 'a1111111-2222-3333-4444-555555555555';
  const scanTokenId = 'tok11111-2222-3333-4444-555555555555';

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
      nonceStore,
      csrfSecret
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
    contentType?: string;
  }) {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = 'e2e_nonce_' + Math.random().toString(36).substring(2) + Date.now();
    const actorId = params.actorId || studentActorId;
    const roles = params.roles || ['Student'];
    const bodyHash = params.bodyBuffer
      ? computeSha256(params.bodyBuffer)
      : computeSha256(params.body ? JSON.stringify(params.body) : '');

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
      'content-type': params.contentType || 'application/json'
    };
  }

  describe('1. Full Lifecycle: Draft Creation, Mutation, Consents, Upload, and Submission', () => {
    it('executes the full student journey step-by-step', async () => {
      // Step A: Create Draft Disclosure
      mockPool.query.mockResolvedValueOnce({
        rows: [{ draft_id: disclosureId }]
      });

      const createDraftBody = {
        title: 'Autonomous Drone Pollination System',
        pidcsData: {
          fieldOfInvention: 'AgriTech Robotics',
          abstract: 'Autonomous micro-drones for precision crop pollination',
          detailedDescription: 'Full hardware schematics and vision-guided flight algorithm',
          commercialPotential: 'Commercial orchards and seed production facilities',
          priorArtDetails: 'Existing manual and mechanical vibration techniques'
        }
      };

      const createDraftHeaders = makeBffHeaders({
        method: 'POST',
        path: '/api/v1/drafts',
        scope: 'OP_CREATE_DRAFT',
        body: createDraftBody
      });

      const draftRes = await request(app)
        .post('/api/v1/drafts')
        .set(createDraftHeaders)
        .send(createDraftBody);

      expect(draftRes.status).toBe(201);
      expect(draftRes.body.draftId).toBe(disclosureId);

      // Step B: Update Draft PIDCS details
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const patchBody = {
        title: 'Autonomous Drone Pollination System (Refined)',
        pidcsData: {
          ...createDraftBody.pidcsData,
          commercialPotential: 'Global greenhouse market estimated at $3.2B'
        }
      };

      const patchHeaders = makeBffHeaders({
        method: 'PATCH',
        path: `/api/v1/drafts/${disclosureId}`,
        scope: 'OP_UPDATE_DRAFT',
        body: patchBody
      });

      const patchRes = await request(app)
        .patch(`/api/v1/drafts/${disclosureId}`)
        .set(patchHeaders)
        .send(patchBody);

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.success).toBe(true);

      // Step C: Add Internal Co-Inventor (4,000 bps)
      mockPool.query.mockResolvedValueOnce({
        rows: [{ consent_id: 'c1111111-2222-3333-4444-555555555555' }]
      });

      const internalConsentBody = {
        disclosureId,
        shareBasisPoints: 4000,
        isExternal: false,
        userId: internalCoInventorId
      };

      const internalConsentHeaders = makeBffHeaders({
        method: 'POST',
        path: '/api/v1/consent/request',
        scope: 'OP_CREATE_CONSENT',
        body: internalConsentBody
      });

      const internalConsentRes = await request(app)
        .post('/api/v1/consent/request')
        .set(internalConsentHeaders)
        .send(internalConsentBody);

      expect(internalConsentRes.status).toBe(201);
      expect(internalConsentRes.body.consentId).toBe('c1111111-2222-3333-4444-555555555555');

      // Step D: Add External Co-Inventor (1,000 bps)
      mockPool.query.mockResolvedValueOnce({
        rows: [{ consent_id: 'c2222222-3333-4444-5555-666666666666' }]
      });

      const externalConsentBody = {
        disclosureId,
        shareBasisPoints: 1000,
        isExternal: true,
        externalName: 'Dr. Jane Smith',
        externalEmail: 'jane.smith@external-lab.org',
        externalOrganization: 'National Agri Research Lab'
      };

      const externalConsentHeaders = makeBffHeaders({
        method: 'POST',
        path: '/api/v1/consent/request',
        scope: 'OP_CREATE_CONSENT',
        body: externalConsentBody
      });

      const externalConsentRes = await request(app)
        .post('/api/v1/consent/request')
        .set(externalConsentHeaders)
        .send(externalConsentBody);

      expect(externalConsentRes.status).toBe(201);
      expect(externalConsentRes.body.consentId).toBe('c2222222-3333-4444-5555-666666666666');

      // Step E: Query Disclosure Consents
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'c0000000-1111-2222-3333-444444444444',
            disclosureId,
            userId: studentActorId,
            isExternal: false,
            externalName: null,
            externalEmail: null,
            externalOrganization: null,
            shareBasisPoints: 5000,
            status: 'VERIFIED',
            signatureEvidenceId: null,
            createdAt: new Date().toISOString()
          },
          {
            id: 'c1111111-2222-3333-4444-555555555555',
            disclosureId,
            userId: internalCoInventorId,
            isExternal: false,
            externalName: null,
            externalEmail: null,
            externalOrganization: null,
            shareBasisPoints: 4000,
            status: 'VERIFIED',
            signatureEvidenceId: null,
            createdAt: new Date().toISOString()
          },
          {
            id: 'c2222222-3333-4444-5555-666666666666',
            disclosureId,
            userId: null,
            isExternal: true,
            externalName: 'Dr. Jane Smith',
            externalEmail: 'jane.smith@external-lab.org',
            externalOrganization: 'National Agri Research Lab',
            shareBasisPoints: 1000,
            status: 'VERIFIED',
            signatureEvidenceId: null,
            createdAt: new Date().toISOString()
          }
        ]
      });

      const viewConsentsHeaders = makeBffHeaders({
        method: 'GET',
        path: `/api/v1/disclosures/${disclosureId}/consents`,
        scope: 'OP_VIEW_DISCLOSURE'
      });

      const consentsRes = await request(app)
        .get(`/api/v1/disclosures/${disclosureId}/consents`)
        .set(viewConsentsHeaders);

      expect(consentsRes.status).toBe(200);
      expect(consentsRes.body.consents).toHaveLength(3);
      const totalBps = consentsRes.body.consents.reduce(
        (sum: number, c: { shareBasisPoints: number }) => sum + c.shareBasisPoints,
        0
      );
      expect(totalBps).toBe(10000); // 100% distribution

      // Step F: Stage 1 — Register Attachment Metadata
      const specContent = Buffer.from('%PDF-1.4 Drone pollination specification documentation');
      const specHash = crypto.createHash('sha256').update(specContent).digest('hex');

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            out_attachment_id: attachmentId,
            out_token_id: scanTokenId,
            out_token_expires_at: new Date(Date.now() + 3600000).toISOString()
          }
        ]
      });

      const registerAttBody = {
        disclosureId,
        fileName: 'pollination-spec.pdf',
        fileSizeBytes: specContent.length,
        mimeType: 'application/pdf',
        sha256Hash: specHash,
        storagePath: `disclosures/${disclosureId}/pollination-spec.pdf`
      };

      const registerAttHeaders = makeBffHeaders({
        method: 'POST',
        path: '/api/v1/attachments',
        scope: 'OP_UPLOAD_ATTACHMENT',
        body: registerAttBody
      });

      const registerAttRes = await request(app)
        .post('/api/v1/attachments')
        .set(registerAttHeaders)
        .send(registerAttBody);

      expect(registerAttRes.status).toBe(201);
      expect(registerAttRes.body.attachmentId).toBe(attachmentId);

      // Step G: Stage 2 — Stream Raw Bytes to Quarantine Upload Endpoint
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            out_attachment_id: attachmentId,
            out_disclosure_id: disclosureId,
            out_file_name: 'pollination-spec.pdf',
            out_file_size_bytes: String(specContent.length),
            out_mime_type: 'application/pdf',
            out_sha256_hash: specHash,
            out_storage_path: `disclosures/${disclosureId}/pollination-spec.pdf`,
            out_token_id: scanTokenId
          }
        ]
      });

      mockScannerPool.query.mockResolvedValueOnce({ rows: [] });

      const uploadHeaders = makeBffHeaders({
        method: 'POST',
        path: `/api/v1/attachments/${attachmentId}/upload`,
        scope: 'OP_UPLOAD_ATTACHMENT',
        bodyBuffer: specContent,
        contentType: 'application/pdf'
      });

      const uploadRes = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(uploadHeaders)
        .send(specContent);

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.scanStatus).toBe('CLEAN');

      // Step H: Submit Initial Disclosure
      const generatedTrackingNumber = 'IPR-202611001-K9P';
      mockPool.query.mockResolvedValueOnce({
        rows: [{ tracking_number: generatedTrackingNumber }]
      });

      const submitHeaders = makeBffHeaders({
        method: 'POST',
        path: `/api/v1/drafts/${disclosureId}/submit`,
        scope: 'OP_SUBMIT_DISCLOSURE',
        body: {}
      });

      const submitRes = await request(app)
        .post(`/api/v1/drafts/${disclosureId}/submit`)
        .set(submitHeaders)
        .send({});

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.trackingNumber).toBe(generatedTrackingNumber);
      expect(submitRes.body.trackingNumber).toMatch(/^IPR-\d{6}\d{3}-[0-9A-Z]{3}$/);

      // Step I: Attempt to Edit Submitted Disclosure — Must be Rejected (422)
      mockPool.query.mockRejectedValueOnce(
        new Error('INVALID_STATE: Only DRAFT disclosures can be updated (current: SUBMITTED)')
      );

      const postSubmitHeaders = makeBffHeaders({
        method: 'PATCH',
        path: `/api/v1/drafts/${disclosureId}`,
        scope: 'OP_UPDATE_DRAFT',
        body: patchBody
      });

      const postSubmitPatchRes = await request(app)
        .patch(`/api/v1/drafts/${disclosureId}`)
        .set(postSubmitHeaders)
        .send(patchBody);

      expect(postSubmitPatchRes.status).toBe(422);
      expect(postSubmitPatchRes.body.code).toBe('INVALID_WORKFLOW_STATE');

      // Step J: View Submitted Disclosure
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: disclosureId,
            trackingNumber: generatedTrackingNumber,
            title: 'Autonomous Drone Pollination System (Refined)',
            status: 'SUBMITTED',
            primaryInventorId: studentActorId,
            assignedReviewerId: null,
            reviewStatus: 'NOT_ASSIGNED',
            legalClearanceStatus: 'NOT_CLEARED',
            pidcsData: createDraftBody.pidcsData,
            submissionTimestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      });

      const getDisclosureHeaders = makeBffHeaders({
        method: 'GET',
        path: `/api/v1/disclosures/${disclosureId}`,
        scope: 'OP_VIEW_DISCLOSURE'
      });

      const getRes = await request(app)
        .get(`/api/v1/disclosures/${disclosureId}`)
        .set(getDisclosureHeaders);

      expect(getRes.status).toBe(200);
      expect(getRes.body.disclosure.status).toBe('SUBMITTED');
      expect(getRes.body.disclosure.trackingNumber).toBe(generatedTrackingNumber);
    });
  });

  describe('2. Important Business Rules Verification', () => {
    it('proves external inventors cannot log in (schema rejection & credential absence)', async () => {
      const csrfRes = await request(app)
        .get('/api/v1/auth/csrf')
        .set('Origin', 'http://localhost:3000');
      const csrfToken = csrfRes.body.csrfToken;
      const csrfCookie = csrfRes.headers['set-cookie']?.[0] || '';

      // 1. External email domains are strictly barred by LoginSchema (400 SCHEMA_VALIDATION_FAILED)
      const externalDomainRes = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', csrfCookie)
        .send({
          email: 'jane.smith@external-lab.org',
          password: 'ExternalPassword123!'
        });

      expect(externalDomainRes.status).toBe(400);
      expect(externalDomainRes.body.code).toBe('SCHEMA_VALIDATION_FAILED');
      expect(externalDomainRes.body.invalidParams?.[0]?.reason).toContain('@paruluniversity.ac.in');

      // 2. Even with institutional format, external inventors lack portal accounts in portal_users (401 INVALID_CREDENTIALS)
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // get_login_credentials_v1 returns empty

      const unassignedRes = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', csrfCookie)
        .send({
          email: 'external.inventor@paruluniversity.ac.in',
          password: 'ExternalPassword123!'
        });

      expect(unassignedRes.status).toBe(401);
      expect(unassignedRes.body.code).toBe('INVALID_CREDENTIALS');
      expect(unassignedRes.headers['set-cookie']).toBeUndefined();
    });

    it('rejects Reviewer role from verifying inventor signatures (only Administrator authorized)', async () => {
      // Reviewer attempts OP_VERIFY_CONSENT
      const reviewerHeaders = makeBffHeaders({
        method: 'POST',
        path: '/api/v1/consent/verify',
        scope: 'OP_VERIFY_CONSENT',
        actorId: reviewerActorId,
        roles: ['Reviewer'],
        body: { consentId: 'c1111111-2222-3333-4444-555555555555' }
      });

      // BFF assertion middleware enforces scope matrix: OP_VERIFY_CONSENT is permitted ONLY to Administrator
      const res = await request(app)
        .post('/api/v1/consent/verify')
        .set(reviewerHeaders)
        .send({ consentId: 'c1111111-2222-3333-4444-555555555555' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects Student role from verifying inventor signatures (only Administrator authorized)', async () => {
      const studentHeaders = makeBffHeaders({
        method: 'POST',
        path: '/api/v1/consent/verify',
        scope: 'OP_VERIFY_CONSENT',
        actorId: studentActorId,
        roles: ['Student'],
        body: { consentId: 'c1111111-2222-3333-4444-555555555555' }
      });

      const res = await request(app)
        .post('/api/v1/consent/verify')
        .set(studentHeaders)
        .send({ consentId: 'c1111111-2222-3333-4444-555555555555' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('BFF_SCOPE_AUTHORIZATION_DENIED');
    });

    it('rejects submission when total shares do not equal 10,000 basis points (422)', async () => {
      mockPool.query.mockRejectedValueOnce(
        new Error('VALIDATION_FAILED: Total inventor share must equal exactly 10,000 basis points (100%), found 9000')
      );

      const submitHeaders = makeBffHeaders({
        method: 'POST',
        path: `/api/v1/drafts/${disclosureId}/submit`,
        scope: 'OP_SUBMIT_DISCLOSURE',
        body: {}
      });

      const res = await request(app)
        .post(`/api/v1/drafts/${disclosureId}/submit`)
        .set(submitHeaders)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.detail).toContain('10,000 basis points');
    });

    it('rejects submission when any inventor consent is unverified (422)', async () => {
      mockPool.query.mockRejectedValueOnce(
        new Error('VALIDATION_FAILED: All inventor consents must be institutional VERIFIED before submission (1 unverified)')
      );

      const submitHeaders = makeBffHeaders({
        method: 'POST',
        path: `/api/v1/drafts/${disclosureId}/submit`,
        scope: 'OP_SUBMIT_DISCLOSURE',
        body: {}
      });

      const res = await request(app)
        .post(`/api/v1/drafts/${disclosureId}/submit`)
        .set(submitHeaders)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.detail).toContain('institutional VERIFIED');
    });

    it('rejects submission when required specification attachments are not clean (422)', async () => {
      mockPool.query.mockRejectedValueOnce(
        new Error('SECURITY_VIOLATION: Cannot submit disclosure with pending, infected, or unscanned attachments')
      );

      const submitHeaders = makeBffHeaders({
        method: 'POST',
        path: `/api/v1/drafts/${disclosureId}/submit`,
        scope: 'OP_SUBMIT_DISCLOSURE',
        body: {}
      });

      const res = await request(app)
        .post(`/api/v1/drafts/${disclosureId}/submit`)
        .set(submitHeaders)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('SECURITY_VIOLATION');
      expect(res.body.detail).toContain('pending, infected, or unscanned attachments');
    });

    it('verifies tracking number strictly matches format IPR-YYYYMMNNN-XXX', async () => {
      const generatedTrackingNumber = 'IPR-202611005-Z8Q';
      mockPool.query.mockResolvedValueOnce({
        rows: [{ tracking_number: generatedTrackingNumber }]
      });

      const submitHeaders = makeBffHeaders({
        method: 'POST',
        path: `/api/v1/drafts/${disclosureId}/submit`,
        scope: 'OP_SUBMIT_DISCLOSURE',
        body: {}
      });

      const res = await request(app)
        .post(`/api/v1/drafts/${disclosureId}/submit`)
        .set(submitHeaders)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.trackingNumber).toBe(generatedTrackingNumber);

      // Verify exact structure
      const match = res.body.trackingNumber.match(/^IPR-(\d{4})(\d{2})(\d{3})-([0-9A-Z]{3})$/);
      expect(match).not.toBeNull();
      const [, year, month, seq, suffix] = match;
      expect(year).toBe('2026');
      expect(month).toBe('11');
      expect(seq).toBe('005');
      expect(suffix).toHaveLength(3);
    });
  });
});
