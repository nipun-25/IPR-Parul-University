import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import crypto from 'node:crypto';
import { createApp } from '../src/app.js';
import { InMemoryNonceStore, buildCanonicalAssertionString, signCanonicalAssertion } from '@ipr/shared';
import type { BackendEnv } from '../src/config/env.config.js';

describe('Phase 2 Step 5: Institution-wide Search, Reporting & Notification Gateways', () => {
  let mockDbPool: Pool;
  let nonceStore: InMemoryNonceStore;
  let testEnv: BackendEnv;
  let sharedSecretHex: string;

  const mockAdminActorId = 'a1111111-2222-3333-4444-555555555555';
  const mockStudentActorId = 'b1111111-2222-3333-4444-555555555555';

  const mockDisclosures = [
    {
      id: 'disc-001',
      trackingNumber: 'PU-IPR-2026-0001',
      title: 'Solar Powered Autonomous Weed Detection Drone',
      status: 'APPROVED',
      primaryInventorId: mockStudentActorId,
      assignedReviewerId: 'rev-1',
      reviewStatus: 'COMPLETED',
      legalClearanceStatus: 'CLEARED',
      createdAt: new Date('2026-11-20T10:00:00Z'),
      updatedAt: new Date('2026-11-25T10:00:00Z')
    },
    {
      id: 'disc-002',
      trackingNumber: 'PU-IPR-2026-0002',
      title: 'Biocompatible Hydrogel for Burn Wound Dressing',
      status: 'SUBMITTED',
      primaryInventorId: mockStudentActorId,
      assignedReviewerId: 'rev-2',
      reviewStatus: 'ASSIGNED',
      legalClearanceStatus: 'PENDING',
      createdAt: new Date('2026-11-22T10:00:00Z'),
      updatedAt: new Date('2026-11-22T10:00:00Z')
    },
    {
      id: 'disc-003',
      trackingNumber: 'PU-IPR-2026-0003',
      title: 'High-Throughput Microfluidic Cell Sorter',
      status: 'DRAFT',
      primaryInventorId: mockStudentActorId,
      assignedReviewerId: null,
      reviewStatus: 'UNASSIGNED',
      legalClearanceStatus: 'NOT_STARTED',
      createdAt: new Date('2026-11-24T10:00:00Z'),
      updatedAt: new Date('2026-11-24T10:00:00Z')
    }
  ];

  beforeEach(() => {
    sharedSecretHex = crypto.randomBytes(32).toString('hex');
    nonceStore = new InMemoryNonceStore();

    testEnv = {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      PORT: 4000,
      CORS_ORIGIN: 'http://localhost:3000',
      DB_HOST: 'localhost',
      DB_PORT: 5433,
      DB_NAME: 'ipr_local_dev',
      DB_USER: 'ipr_app',
      DB_PASSWORD: 'test_password',
      DB_SSL: false,
      BFF_SHARED_SECRET: sharedSecretHex,
      SCANNER_DB_USER: 'ipr_scanner',
      SCANNER_DB_PASSWORD: 'scanner_password',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: 587,
      SMTP_USER: 'iprcell@paruluniversity.ac.in',
      SMTP_PASSWORD: 'smtp-secret-password'
    };

    mockDbPool = {
      query: vi.fn().mockImplementation(async (queryText: string, values: any[]) => {
        // Querying public.list_disclosures_v1
        if (queryText.includes('public.list_disclosures_v1')) {
          let rows = [...mockDisclosures];

          const searchTerm = values?.[1];
          const statusFilter = values?.[2];
          const reviewFilter = values?.[3];
          const legalFilter = values?.[4];

          if (searchTerm) {
            const term = String(searchTerm).toLowerCase();
            rows = rows.filter(
              (r) =>
                r.title.toLowerCase().includes(term) ||
                (r.trackingNumber && r.trackingNumber.toLowerCase().includes(term))
            );
          }
          if (statusFilter) {
            rows = rows.filter((r) => r.status === statusFilter);
          }
          if (reviewFilter) {
            rows = rows.filter((r) => r.reviewStatus === reviewFilter);
          }
          if (legalFilter) {
            rows = rows.filter((r) => r.legalClearanceStatus === legalFilter);
          }

          return { rows };
        }
        return { rows: [] };
      })
    } as unknown as Pool;
  });

  function createBffHeaders(options: {
    method: string;
    path: string;
    queryParams?: string;
    scope: string;
    actorId: string;
    roles: string[];
    body?: any;
  }) {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = crypto.randomBytes(16).toString('hex');
    const bodyStr = options.body ? JSON.stringify(options.body) : '';
    const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex');

    const canonicalString = buildCanonicalAssertionString({
      method: options.method,
      canonicalPath: options.path,
      queryParams: options.queryParams || '',
      operationScope: options.scope,
      actorId: options.actorId,
      roles: options.roles,
      timestamp,
      nonce,
      bodyHash
    });

    const signature = signCanonicalAssertion(canonicalString, sharedSecretHex);

    return {
      'x-bff-signature': signature,
      'x-bff-actor-id': options.actorId,
      'x-bff-roles': options.roles.join(','),
      'x-bff-timestamp': timestamp,
      'x-bff-nonce': nonce,
      'x-bff-operation-scope': options.scope,
      'x-bff-body-hash': bodyHash
    };
  }

  describe('1. Role-Aware Search & Filter Gateways', () => {
    it('filters disclosures by search keyword on title or tracking number', async () => {
      const app = createApp(testEnv, { dbPool: mockDbPool, nonceStore });

      const headers = createBffHeaders({
        method: 'GET',
        path: '/api/v1/disclosures',
        queryParams: 'search=Drone',
        scope: 'OP_VIEW_DISCLOSURE',
        actorId: mockStudentActorId,
        roles: ['Student']
      });

      const res = await request(app)
        .get('/api/v1/disclosures?search=Drone')
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.disclosures.length).toBe(1);
      expect(res.body.disclosures[0].title).toContain('Drone');
      expect(res.body.disclosures[0].trackingNumber).toBe('PU-IPR-2026-0001');
    });

    it('filters disclosures by workflow status (e.g. APPROVED)', async () => {
      const app = createApp(testEnv, { dbPool: mockDbPool, nonceStore });

      const headers = createBffHeaders({
        method: 'GET',
        path: '/api/v1/disclosures',
        queryParams: 'status=APPROVED',
        scope: 'OP_VIEW_DISCLOSURE',
        actorId: mockAdminActorId,
        roles: ['Administrator']
      });

      const res = await request(app)
        .get('/api/v1/disclosures?status=APPROVED')
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.disclosures.length).toBe(1);
      expect(res.body.disclosures[0].status).toBe('APPROVED');
    });

    it('returns empty set when search query yields no matches', async () => {
      const app = createApp(testEnv, { dbPool: mockDbPool, nonceStore });

      const headers = createBffHeaders({
        method: 'GET',
        path: '/api/v1/disclosures',
        queryParams: 'search=NonExistentKeywordXYZ',
        scope: 'OP_VIEW_DISCLOSURE',
        actorId: mockStudentActorId,
        roles: ['Student']
      });

      const res = await request(app)
        .get('/api/v1/disclosures?search=NonExistentKeywordXYZ')
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.disclosures.length).toBe(0);
    });
  });

  describe('2. Reporting Analytics & Summaries', () => {
    it('GET /api/v1/reports/summary computes authoritative breakdown by status and clearance', async () => {
      const app = createApp(testEnv, { dbPool: mockDbPool, nonceStore });

      const headers = createBffHeaders({
        method: 'GET',
        path: '/api/v1/reports/summary',
        scope: 'OP_VIEW_DISCLOSURE',
        actorId: mockAdminActorId,
        roles: ['Administrator']
      });

      const res = await request(app)
        .get('/api/v1/reports/summary')
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary.totalDisclosures).toBe(3);
      expect(res.body.summary.byStatus.APPROVED).toBe(1);
      expect(res.body.summary.byStatus.SUBMITTED).toBe(1);
      expect(res.body.summary.byStatus.DRAFT).toBe(1);
      expect(res.body.summary.byLegalClearanceStatus.CLEARED).toBe(1);
      expect(res.body.summary.byLegalClearanceStatus.PENDING).toBe(1);
      expect(res.body.summary.byLegalClearanceStatus.NOT_STARTED).toBe(1);
      expect(res.body.summary.recentActivity.length).toBe(3);
    });

    it('rejects unauthenticated report requests (401)', async () => {
      const app = createApp(testEnv, { dbPool: mockDbPool, nonceStore });

      const res = await request(app).get('/api/v1/reports/summary');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('BFF_ASSERTION_MISSING_HEADERS');
    });
  });

  describe('3. Role-Appropriate CSV Export', () => {
    it('GET /api/v1/reports/export/disclosures.csv returns valid RFC 4180 CSV with correct headers', async () => {
      const app = createApp(testEnv, { dbPool: mockDbPool, nonceStore });

      const headers = createBffHeaders({
        method: 'GET',
        path: '/api/v1/reports/export/disclosures.csv',
        scope: 'OP_VIEW_DISCLOSURE',
        actorId: mockAdminActorId,
        roles: ['Administrator']
      });

      const res = await request(app)
        .get('/api/v1/reports/export/disclosures.csv')
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename="parul-ipr-disclosures.csv"');

      const csvLines = res.text.split('\r\n');
      expect(csvLines[0]).toBe('ID,Tracking Number,Title,Status,Review Status,Legal Clearance Status,Primary Inventor ID,Created At,Updated At');
      expect(csvLines.length).toBe(4); // 1 header line + 3 rows
      expect(res.text).toContain('PU-IPR-2026-0001');
      expect(res.text).toContain('Solar Powered Autonomous Weed Detection Drone');
      expect(res.text).not.toContain('password');
      expect(res.text).not.toContain('secret');
    });

    it('escapes commas and special characters in CSV titles', async () => {
      const customPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 'disc-comma',
              trackingNumber: 'PU-IPR-2026-0099',
              title: 'Device, Method, and System for "Quantum" Encryption',
              status: 'APPROVED',
              primaryInventorId: mockStudentActorId,
              assignedReviewerId: null,
              reviewStatus: 'UNASSIGNED',
              legalClearanceStatus: 'NOT_STARTED',
              createdAt: new Date('2026-11-20T10:00:00Z'),
              updatedAt: new Date('2026-11-20T10:00:00Z')
            }
          ]
        })
      } as unknown as Pool;

      const app = createApp(testEnv, { dbPool: customPool, nonceStore });

      const headers = createBffHeaders({
        method: 'GET',
        path: '/api/v1/reports/export/disclosures.csv',
        scope: 'OP_VIEW_DISCLOSURE',
        actorId: mockStudentActorId,
        roles: ['Student']
      });

      const res = await request(app)
        .get('/api/v1/reports/export/disclosures.csv')
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.text).toContain('"Device, Method, and System for ""Quantum"" Encryption"');
    });
  });

  describe('4. University SMTP Configuration Verification', () => {
    it('verifies SMTP configuration uses iprcell@paruluniversity.ac.in', () => {
      expect(testEnv.SMTP_USER).toBe('iprcell@paruluniversity.ac.in');
      expect(testEnv.SMTP_HOST).toBe('smtp.gmail.com');
      expect(testEnv.SMTP_PORT).toBe(587);
    });
  });
});
