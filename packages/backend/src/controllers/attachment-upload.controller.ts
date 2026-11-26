import crypto from 'node:crypto';
import path from 'node:path';
import { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import type { IQuarantineStorageAdapter } from '@ipr/shared';
import { AppError } from '../middleware/error-handler.middleware.js';
import { isDatabaseUnavailable } from '../utils/db-error.util.js';
import { AntivirusScannerService } from '../services/scanner.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_SIZE_BYTES = 26214400; // 25 MB

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.zip']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/zip',
  'application/octet-stream'
]);

export function uploadAttachmentContentHandler(
  dbPool?: Pool,
  quarantineStorage?: IQuarantineStorageAdapter,
  scannerService?: AntivirusScannerService
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!dbPool) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection pool is not configured.'
        });
      }

      if (!req.assertion) {
        throw new AppError({
          statusCode: 401,
          code: 'BFF_ASSERTION_MISSING',
          title: 'Missing Request Assertion',
          detail: 'Verified request assertion is required to upload attachment content.'
        });
      }

      const attachmentId = req.params.id;
      if (!attachmentId || !UUID_REGEX.test(attachmentId)) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: 'Attachment identifier must be a valid UUID.'
        });
      }

      const fileBuffer = req.rawBody;
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new AppError({
          statusCode: 400,
          code: 'EMPTY_FILE',
          title: 'Empty File',
          detail: 'Upload file content cannot be empty.'
        });
      }

      if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
        throw new AppError({
          statusCode: 413,
          code: 'PAYLOAD_TOO_LARGE',
          title: 'Payload Too Large',
          detail: `File exceeds maximum permitted limit of ${MAX_FILE_SIZE_BYTES} bytes (25 MB).`
        });
      }

      // Query registered attachment and disclosure ownership state
      const dbResult = await dbPool.query<{
        attachmentId: string;
        disclosureId: string;
        fileName: string;
        fileSizeBytes: string;
        mimeType: string;
        sha256Hash: string;
        storagePath: string;
        scanStatus: string;
        disclosureStatus: string;
        primaryInventorId: string;
      }>(
        `SELECT
          a.id AS "attachmentId",
          a.disclosure_id AS "disclosureId",
          a.file_name AS "fileName",
          a.file_size_bytes AS "fileSizeBytes",
          a.mime_type AS "mimeType",
          a.sha256_hash AS "sha256Hash",
          a.storage_path AS "storagePath",
          a.scan_status AS "scanStatus",
          d.status AS "disclosureStatus",
          d.primary_inventor_id AS "primaryInventorId"
        FROM public.attachments a
        JOIN public.disclosures d ON d.id = a.disclosure_id
        WHERE a.id = $1`,
        [attachmentId]
      );

      const record = dbResult.rows[0];
      if (!record) {
        throw new AppError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Resource Not Found',
          detail: `Attachment "${attachmentId}" does not exist.`
        });
      }

      // Verify Actor is Primary Inventor
      const actorId = req.actor?.actorId || req.assertion.actor_id;
      if (record.primaryInventorId !== actorId) {
        throw new AppError({
          statusCode: 403,
          code: 'ATTACHMENT_FORBIDDEN',
          title: 'Forbidden Access',
          detail: 'Only the primary inventor may upload file content to this disclosure.'
        });
      }

      // Verify DRAFT status
      if (record.disclosureStatus !== 'DRAFT') {
        throw new AppError({
          statusCode: 422,
          code: 'INVALID_WORKFLOW_STATE',
          title: 'Invalid State',
          detail: 'Attachments can only be uploaded to DRAFT disclosures.'
        });
      }

      // Verify not already uploaded / scanned
      if (record.scanStatus !== 'PENDING_SCAN') {
        throw new AppError({
          statusCode: 409,
          code: 'DUPLICATE_UPLOAD',
          title: 'Duplicate Upload',
          detail: `Attachment has already been processed with status "${record.scanStatus}".`
        });
      }

      // Verify File Extension & MIME Type
      const ext = path.extname(record.fileName).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        throw new AppError({
          statusCode: 415,
          code: 'UNSUPPORTED_MEDIA_TYPE',
          title: 'Unsupported File Extension',
          detail: `File extension "${ext}" is not permitted. Permitted extensions: .pdf, .png, .jpg, .jpeg, .zip`
        });
      }

      const contentTypeHeader = (req.headers['content-type'] || '').split(';')[0]?.trim().toLowerCase();
      if (contentTypeHeader && !ALLOWED_MIME_TYPES.has(contentTypeHeader)) {
        throw new AppError({
          statusCode: 415,
          code: 'UNSUPPORTED_MEDIA_TYPE',
          title: 'Unsupported Media Type',
          detail: `Content-Type "${contentTypeHeader}" is not allowed. Permitted MIME types: PDF, PNG, JPEG, ZIP`
        });
      }

      // Compute Actual SHA-256 and Verify Against Registered Checksum
      const actualSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      if (actualSha256.toLowerCase() !== record.sha256Hash.toLowerCase()) {
        throw new AppError({
          statusCode: 422,
          code: 'CHECKSUM_MISMATCH',
          title: 'Checksum Mismatch',
          detail: 'Actual SHA-256 checksum of uploaded bytes does not match expected registered checksum.'
        });
      }

      if (fileBuffer.length !== Number(record.fileSizeBytes)) {
        throw new AppError({
          statusCode: 422,
          code: 'SIZE_MISMATCH',
          title: 'Size Mismatch',
          detail: `Actual file size (${fileBuffer.length} bytes) does not match registered size (${record.fileSizeBytes} bytes).`
        });
      }

      // Store in Quarantine Isolation Storage
      if (quarantineStorage) {
        try {
          await quarantineStorage.putQuarantineObject(
            attachmentId,
            fileBuffer,
            record.fileName,
            record.mimeType
          );
        } catch (storageErr) {
          throw new AppError({
            statusCode: 500,
            code: 'STORAGE_ERROR',
            title: 'Quarantine Storage Error',
            detail: storageErr instanceof Error ? storageErr.message : 'Failed to isolate file in quarantine storage.'
          });
        }
      }

      // Retrieve Active Scan Token
      const tokenResult = await dbPool.query<{
        token_id: string;
      }>(
        `SELECT token_id
         FROM public.attachment_scan_tokens
         WHERE attachment_id = $1 AND status = 'ACTIVE' AND expires_at > clock_timestamp()
         ORDER BY created_at DESC
         LIMIT 1`,
        [attachmentId]
      );

      const tokenRow = tokenResult.rows[0];
      if (!tokenRow) {
        throw new AppError({
          statusCode: 422,
          code: 'INVALID_SCAN_TOKEN',
          title: 'Invalid Scan Token',
          detail: 'No active scan token found for this attachment. Token may have expired or already been consumed.'
        });
      }

      // Trigger Antivirus Scan Pipeline
      let scanStatus = 'PENDING_SCAN';
      let scanDetails = 'Awaiting scanner evaluation';

      if (scannerService) {
        const scanRes = await scannerService.scanAndRecord({
          tokenId: tokenRow.token_id,
          attachmentId,
          sha256Hash: actualSha256,
          storagePath: record.storagePath,
          fileContent: fileBuffer
        });
        scanStatus = scanRes.scanStatus;
        scanDetails = scanRes.scanDetails;
      }

      res.status(200).json({
        success: true,
        attachmentId,
        scanStatus,
        scanDetails,
        message: scanStatus === 'CLEAN'
          ? 'File uploaded to quarantine and verified clean by antivirus scanner.'
          : scanStatus === 'INFECTED'
          ? 'File uploaded to quarantine. Antivirus scanner flagged this file as infected.'
          : 'File uploaded to quarantine successfully.'
      });
    } catch (err: unknown) {
      if (isDatabaseUnavailable(err)) {
        return next(new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection failed or service is temporarily unavailable.'
        }));
      }
      next(err);
    }
  };
}

