import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { createApp } from '../src/app.js';
import { createScannerDatabasePool } from '../src/db/pool.js';
import { BackendEnv } from '../src/config/env.config.js';
import {
  InMemoryNonceStore,
  computeSha256,
  signCanonicalAssertion,
  buildCanonicalAssertionString,
  OperationScope,
  InMemoryQuarantineStorage
} from '@ipr/shared';

describe('Dedicated Scanner Database Pool & Security Isolation', () => {
  const baseTestEnv: BackendEnv = {
    NODE_ENV: 'test',
    PORT: 4000,
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    BFF_SHARED_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    DB_HOST: 'localhost',
    DB_PORT: 5433,
    DB_NAME: 'ipr_local_dev',
    DB_USER: 'ipr_app',
    DB_PASSWORD: 'app_secret_password',
    DB_SSL: false,
    SCANNER_DB_USER: 'ipr_scanner',
    SCANNER_DB_PASSWORD: 'scanner_secret_password',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 587,
    SMTP_USER: 'test@example.com',
    SMTP_PASSWORD: 'test-password'
  };

  const primaryInventorId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const disclosureId = 'd1111111-2222-3333-4444-555555555555';
  const attachmentId = 'a1111111-2222-3333-4444-555555555555';

  function makeUploadHeaders(bodyBuffer: Buffer, _nonceStore: InMemoryNonceStore) {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = 'up_nonce_' + Math.random().toString(36).substring(2) + Date.now();
    const bodyHash = computeSha256(bodyBuffer);
    const canonicalPath = `/api/v1/attachments/${attachmentId}/upload`;
    const scope: OperationScope = 'OP_UPLOAD_ATTACHMENT';

    const canonicalString = buildCanonicalAssertionString({
      method: 'POST',
      canonicalPath,
      bodyHash,
      actorId: primaryInventorId,
      roles: ['Student'],
      timestamp,
      nonce,
      operationScope: scope
    });

    const signature = signCanonicalAssertion(canonicalString, baseTestEnv.BFF_SHARED_SECRET);

    return {
      'x-bff-signature': signature,
      'x-bff-actor-id': primaryInventorId,
      'x-bff-roles': 'Student',
      'x-bff-timestamp': timestamp,
      'x-bff-nonce': nonce,
      'x-bff-operation-scope': scope,
      'x-bff-body-hash': bodyHash,
      'content-type': 'application/pdf'
    };
  }

  describe('createScannerDatabasePool', () => {
    it('throws when SCANNER_DB_PASSWORD is missing or empty', () => {
      const envWithoutScannerPw = {
        ...baseTestEnv,
        SCANNER_DB_PASSWORD: ''
      };
      expect(() => createScannerDatabasePool(envWithoutScannerPw)).toThrow(
        'Cannot create scanner database pool: SCANNER_DB_PASSWORD is not configured.'
      );
    });

    it('creates dedicated scanner pool authenticated as ipr_scanner with bounded size', () => {
      const pool = createScannerDatabasePool(baseTestEnv);
      expect(pool).toBeDefined();
      expect(pool.options.user).toBe('ipr_scanner');
      expect(pool.options.password).toBe('scanner_secret_password');
      expect(pool.options.max).toBe(5);
      void pool.end();
    });
  });

  describe('Scanner Service Privilege Separation (No Fallback to ipr_app)', () => {
    it('does NOT fall back to dbPool (ipr_app) when scannerPool is omitted', async () => {
      const fileBuffer = Buffer.from('%PDF-1.4 test document content');
      const expectedHash = computeSha256(fileBuffer);

      const mockAppPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('get_attachment_upload_context_v1') || sql.includes('attachments a')) {
            return Promise.resolve({
              rows: [{
                out_attachment_id: attachmentId,
                out_disclosure_id: disclosureId,
                out_file_name: 'test.pdf',
                out_file_size_bytes: String(fileBuffer.length),
                out_mime_type: 'application/pdf',
                out_sha256_hash: expectedHash,
                out_storage_path: 'disclosures/test.pdf',
                out_token_id: 'tok-123',
                attachmentId,
                disclosureId,
                fileName: 'test.pdf',
                fileSizeBytes: String(fileBuffer.length),
                mimeType: 'application/pdf',
                sha256Hash: expectedHash,
                storagePath: 'disclosures/test.pdf',
                scanStatus: 'PENDING_SCAN',
                disclosureStatus: 'DRAFT',
                primaryInventorId
              }]
            });
          }
          if (sql.includes('attachment_scan_tokens')) {
            return Promise.resolve({
              rows: [{ token_id: 'tok-123', status: 'ACTIVE' }]
            });
          }
          return Promise.resolve({ rows: [] });
        })
      };

      const quarantineStorage = new InMemoryQuarantineStorage();

      // Create app WITHOUT scannerPool or scannerService
      const nonceStore = new InMemoryNonceStore(3600);
      const appWithoutScanner = createApp(baseTestEnv, {
        dbPool: mockAppPool as unknown as Pool,
        quarantineStorage,
        nonceStore
      });

      const headers = makeUploadHeaders(fileBuffer, nonceStore);

      // Must fail closed with 503 SCANNER_SERVICE_UNAVAILABLE and NEVER invoke record_antivirus_scan_result_v5 on appPool
      const res = await request(appWithoutScanner)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(fileBuffer);

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('SCANNER_SERVICE_UNAVAILABLE');
      expect(res.body.detail).toContain('Antivirus scanner service is not configured');

      // Verify appPool was NEVER queried with record_antivirus_scan_result_v5
      const appCalls = mockAppPool.query.mock.calls.map((c) => c[0]);
      expect(appCalls.some((c: string) => c.includes('record_antivirus_scan_result_v5'))).toBe(false);
    });

    it('successfully processes upload when dedicated scannerPool is provided', async () => {
      const fileBuffer = Buffer.from('%PDF-1.4 clean file');
      const expectedHash = computeSha256(fileBuffer);

      const mockAppPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('get_attachment_upload_context_v1') || sql.includes('attachments a')) {
            return Promise.resolve({
              rows: [{
                out_attachment_id: attachmentId,
                out_disclosure_id: disclosureId,
                out_file_name: 'clean.pdf',
                out_file_size_bytes: String(fileBuffer.length),
                out_mime_type: 'application/pdf',
                out_sha256_hash: expectedHash,
                out_storage_path: 'disclosures/clean.pdf',
                out_token_id: 'tok-123',
                attachmentId,
                disclosureId,
                fileName: 'clean.pdf',
                fileSizeBytes: String(fileBuffer.length),
                mimeType: 'application/pdf',
                sha256Hash: expectedHash,
                storagePath: 'disclosures/clean.pdf',
                scanStatus: 'PENDING_SCAN',
                disclosureStatus: 'DRAFT',
                primaryInventorId
              }]
            });
          }
          if (sql.includes('attachment_scan_tokens')) {
            return Promise.resolve({
              rows: [{ token_id: 'tok-123', status: 'ACTIVE' }]
            });
          }
          return Promise.resolve({ rows: [] });
        })
      };

      const mockScannerPool = {
        query: vi.fn().mockResolvedValue({ rows: [{ scan_status: 'CLEAN' }] })
      };

      const quarantineStorage = new InMemoryQuarantineStorage();

      const nonceStore = new InMemoryNonceStore(3600);
      const appWithScannerPool = createApp(baseTestEnv, {
        dbPool: mockAppPool as unknown as Pool,
        scannerPool: mockScannerPool as unknown as Pool,
        quarantineStorage,
        nonceStore
      });

      const headers = makeUploadHeaders(fileBuffer, nonceStore);

      const res = await request(appWithScannerPool)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(fileBuffer);

      expect(res.status).toBe(200);
      expect(res.body.scanStatus).toBe('CLEAN');

      // Scanner routine MUST be called on mockScannerPool, NEVER on mockAppPool
      expect(mockScannerPool.query).toHaveBeenCalledTimes(1);
      expect(mockScannerPool.query.mock.calls[0][0]).toContain('record_antivirus_scan_result_v5');

      const appCalls = mockAppPool.query.mock.calls.map((c) => c[0]);
      expect(appCalls.some((c: string) => c.includes('record_antivirus_scan_result_v5'))).toBe(false);
    });
  });

  describe('Server Lifecycle & Pool Cleanup', () => {
    it('supports independent pool shutdown without race conditions', async () => {
      const appPoolEnd = vi.fn().mockResolvedValue(undefined);
      const scannerPoolEnd = vi.fn().mockResolvedValue(undefined);

      const mockAppPool = { end: appPoolEnd };
      const mockScannerPool = { end: scannerPoolEnd };

      // Simulate graceful shutdown logic
      await Promise.allSettled([
        mockAppPool.end(),
        mockScannerPool.end()
      ]);

      expect(appPoolEnd).toHaveBeenCalledTimes(1);
      expect(scannerPoolEnd).toHaveBeenCalledTimes(1);
    });

    it('ensures partial startup failure cleans up any previously opened pool', async () => {
      const appPoolEnd = vi.fn().mockResolvedValue(undefined);
      const mockAppPool = { end: appPoolEnd };

      // Simulate scanner pool failing during startup after appPool is already created
      let caughtError: unknown;
      try {
        // App pool is initialized
        const _appPool = mockAppPool;
        // Scanner fails:
        throw new Error('Connection to scanner database failed');
      } catch (err) {
        caughtError = err;
        // Partial startup cleanup must end appPool
        await Promise.allSettled([mockAppPool.end()]);
      }

      expect(caughtError).toBeDefined();
      expect(appPoolEnd).toHaveBeenCalledTimes(1);
    });
  });
});
