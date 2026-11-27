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
import { AntivirusScannerService, EICAR_SIGNATURE } from '../src/services/scanner.service.js';

describe('Stage 2G.2 — Attachment Upload & Quarantine Pipeline Endpoints', () => {
  const secretHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
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

  const primaryInventorId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const otherStudentId = 'b1111111-2222-3333-4444-555555555555';
  const disclosureId = 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  const attachmentId = 'c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  const tokenId = 't1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

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
      nonceStore
    });
  });

  function makeBffUploadHeaders(params: {
    attachmentId: string;
    bodyBuffer: Buffer;
    actorId?: string;
    roles?: string[];
    contentType?: string;
  }) {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = 'up_nonce_' + Math.random().toString(36).substring(2) + Date.now();
    const actorId = params.actorId || primaryInventorId;
    const roles = params.roles || ['Student'];
    const bodyHash = computeSha256(params.bodyBuffer);
    const canonicalPath = `/api/v1/attachments/${params.attachmentId}/upload`;
    const scope: OperationScope = 'OP_UPLOAD_ATTACHMENT';

    const canonicalString = buildCanonicalAssertionString({
      method: 'POST',
      canonicalPath,
      queryParams: '',
      operationScope: scope,
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
      'X-BFF-Operation-Scope': scope,
      'X-BFF-Body-Hash': bodyHash,
      'content-type': params.contentType || 'application/pdf'
    };
  }

  describe('POST /api/v1/attachments/:id/upload', () => {
    it('returns 401 when BFF assertion headers are missing', async () => {
      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set('content-type', 'application/pdf')
        .send(Buffer.from('%PDF-1.4 test content'));

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('BFF_ASSERTION_MISSING_HEADERS');
    });

    it('returns 400 when attachment identifier is not a valid UUID', async () => {
      const content = Buffer.from('%PDF-1.4 sample file');
      const headers = makeBffUploadHeaders({
        attachmentId: 'invalid-id-format',
        bodyBuffer: content
      });

      const res = await request(app)
        .post('/api/v1/attachments/invalid-id-format/upload')
        .set(headers)
        .send(content);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('returns 400 when upload payload is empty', async () => {
      const content = Buffer.alloc(0);
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: content
      });

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(content);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('EMPTY_FILE');
    });

    it('returns 404 when attachment record does not exist', async () => {
      const content = Buffer.from('%PDF-1.4 sample');
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: content
      });

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(content);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 403 when caller is not the primary inventor', async () => {
      const content = Buffer.from('%PDF-1.4 sample');
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: content,
        actorId: otherStudentId
      });

      mockPool.query.mockRejectedValueOnce(
        Object.assign(
          new Error('FORBIDDEN: Only the primary inventor may upload file content to this disclosure'),
          { code: '42501' }
        )
      );

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(content);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ATTACHMENT_FORBIDDEN');
    });

    it('returns 422 when disclosure is not in DRAFT state', async () => {
      const content = Buffer.from('%PDF-1.4 sample');
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: content
      });

      mockPool.query.mockRejectedValueOnce(
        new Error('INVALID_STATE: Attachments can only be uploaded to DRAFT disclosures (current: SUBMITTED)')
      );

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(content);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_WORKFLOW_STATE');
    });

    it('returns 409 when attachment was already processed (DUPLICATE_UPLOAD)', async () => {
      const content = Buffer.from('%PDF-1.4 sample');
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: content
      });

      mockPool.query.mockRejectedValueOnce(
        new Error('DUPLICATE_UPLOAD: Attachment has already been processed with status "CLEAN"')
      );

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(content);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_UPLOAD');
    });

    it('returns 415 when file extension is not permitted', async () => {
      const content = Buffer.from('binary-payload');
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: content
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            out_attachment_id: attachmentId,
            out_disclosure_id: disclosureId,
            out_file_name: 'malicious.exe',
            out_file_size_bytes: String(content.length),
            out_mime_type: 'application/octet-stream',
            out_sha256_hash: crypto.createHash('sha256').update(content).digest('hex'),
            out_storage_path: 'disclosures/test.exe',
            out_token_id: tokenId
          }
        ]
      });

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(content);

      expect(res.status).toBe(415);
      expect(res.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('returns 422 CHECKSUM_MISMATCH when actual byte SHA-256 does not match registered hash', async () => {
      const actualContent = Buffer.from('%PDF-1.4 real uploaded bytes');
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: actualContent
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            out_attachment_id: attachmentId,
            out_disclosure_id: disclosureId,
            out_file_name: 'spec.pdf',
            out_file_size_bytes: String(actualContent.length),
            out_mime_type: 'application/pdf',
            out_sha256_hash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            out_storage_path: 'disclosures/test.pdf',
            out_token_id: tokenId
          }
        ]
      });

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(actualContent);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('CHECKSUM_MISMATCH');

      // Proves file was never added to approved storage
      const quarantined = await quarantineStorage.getQuarantineObject(attachmentId);
      expect(quarantined).toBeNull();
    });

    it('returns 422 SIZE_MISMATCH when actual byte size does not match registered size', async () => {
      const content = Buffer.from('%PDF-1.4 content bytes');
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: content
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            out_attachment_id: attachmentId,
            out_disclosure_id: disclosureId,
            out_file_name: 'spec.pdf',
            out_file_size_bytes: String(content.length + 100),
            out_mime_type: 'application/pdf',
            out_sha256_hash: crypto.createHash('sha256').update(content).digest('hex'),
            out_storage_path: 'disclosures/test.pdf',
            out_token_id: tokenId
          }
        ]
      });

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(content);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('SIZE_MISMATCH');
    });

    it('returns 422 INVALID_SCAN_TOKEN when active token is not found or expired', async () => {
      const content = Buffer.from('%PDF-1.4 clean document');
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: content
      });

      mockPool.query.mockRejectedValueOnce(
        new Error('INVALID_SCAN_TOKEN: No active scan token found for this attachment. Token may have expired or already been consumed')
      );

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(content);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_SCAN_TOKEN');
    });

    it('successfully processes clean file: isolates in quarantine, verifies hash, records CLEAN, and promotes', async () => {
      const content = Buffer.from('%PDF-1.4 authentic clean specification document for agricultural IoT');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: content
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            out_attachment_id: attachmentId,
            out_disclosure_id: disclosureId,
            out_file_name: 'spec.pdf',
            out_file_size_bytes: String(content.length),
            out_mime_type: 'application/pdf',
            out_sha256_hash: hash,
            out_storage_path: 'disclosures/test.pdf',
            out_token_id: tokenId
          }
        ]
      });

      mockScannerPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(content);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scanStatus).toBe('CLEAN');
      expect(res.body.attachmentId).toBe(attachmentId);

      // Verify scanner database gateway was invoked with ipr_scanner session
      expect(mockScannerPool.query).toHaveBeenCalledWith(
        'SELECT public.record_antivirus_scan_result_v5($1::uuid, $2::uuid, $3::varchar, $4::text, $5::varchar, $6::text)',
        [tokenId, attachmentId, hash, 'disclosures/test.pdf', 'CLEAN', expect.any(String)]
      );

      // Verify object was promoted in storage
      const approved = await quarantineStorage.getApprovedObject(attachmentId);
      expect(approved).not.toBeNull();
    });

    it('detects malware (EICAR signature), records INFECTED, isolates in quarantine, and blocks promotion', async () => {
      const content = Buffer.from(`%PDF-1.4 ${EICAR_SIGNATURE}`);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: content
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            out_attachment_id: attachmentId,
            out_disclosure_id: disclosureId,
            out_file_name: 'infected.pdf',
            out_file_size_bytes: String(content.length),
            out_mime_type: 'application/pdf',
            out_sha256_hash: hash,
            out_storage_path: 'disclosures/infected.pdf',
            out_token_id: tokenId
          }
        ]
      });

      mockScannerPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(content);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scanStatus).toBe('INFECTED');

      // Verify scanner gateway recorded INFECTED
      expect(mockScannerPool.query).toHaveBeenCalledWith(
        'SELECT public.record_antivirus_scan_result_v5($1::uuid, $2::uuid, $3::varchar, $4::text, $5::varchar, $6::text)',
        [tokenId, attachmentId, hash, 'disclosures/infected.pdf', 'INFECTED', expect.stringContaining('Malware signature detected')]
      );

      // File must NOT be approved
      const approved = await quarantineStorage.getApprovedObject(attachmentId);
      expect(approved).toBeNull();

      const quarantined = await quarantineStorage.getQuarantineObject(attachmentId);
      expect(quarantined?.metadata.state).toBe('SCAN_INFECTED');
    });

    it('returns 500 when quarantine storage adapter fails to put object', async () => {
      const content = Buffer.from('%PDF-1.4 clean doc');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: content
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            out_attachment_id: attachmentId,
            out_disclosure_id: disclosureId,
            out_file_name: 'spec.pdf',
            out_file_size_bytes: String(content.length),
            out_mime_type: 'application/pdf',
            out_sha256_hash: hash,
            out_storage_path: 'disclosures/test.pdf',
            out_token_id: tokenId
          }
        ]
      });

      // Force storage error
      vi.spyOn(quarantineStorage, 'putQuarantineObject').mockRejectedValueOnce(
        new Error('Disk write error in quarantine volume')
      );

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(content);

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('STORAGE_ERROR');
    });

    it('returns 500 SCANNER_ERROR and does not mark CLEAN if scanner gateway throws error', async () => {
      const content = Buffer.from('%PDF-1.4 clean doc');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const headers = makeBffUploadHeaders({
        attachmentId,
        bodyBuffer: content
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            out_attachment_id: attachmentId,
            out_disclosure_id: disclosureId,
            out_file_name: 'spec.pdf',
            out_file_size_bytes: String(content.length),
            out_mime_type: 'application/pdf',
            out_sha256_hash: hash,
            out_storage_path: 'disclosures/test.pdf',
            out_token_id: tokenId
          }
        ]
      });

      mockScannerPool.query.mockRejectedValueOnce(
        new Error('Scanner database connection aborted')
      );

      const res = await request(app)
        .post(`/api/v1/attachments/${attachmentId}/upload`)
        .set(headers)
        .send(content);

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('SCANNER_ERROR');

      // Must never be promoted to approved
      const approved = await quarantineStorage.getApprovedObject(attachmentId);
      expect(approved).toBeNull();
    });
  });
});
