import crypto from 'node:crypto';
import path from 'node:path';
import { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import type { IQuarantineStorageAdapter } from '@ipr/shared';
import { AppError } from '../middleware/error-handler.middleware.js';
import { isDatabaseUnavailable } from '../utils/db-error.util.js';
import { AntivirusScannerService } from '../services/scanner.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

      const fileBuffer = req.rawBody ?? (Buffer.isBuffer(req.body) ? req.body : undefined);
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

      // Retrieve registered attachment metadata, disclosure state, and active scan token
      // via authorized SECURITY DEFINER gateway function (enforcing privilege separation)
      let record: {
        attachmentId: string;
        disclosureId: string;
        fileName: string;
        fileSizeBytes: string;
        mimeType: string;
        sha256Hash: string;
        storagePath: string;
        tokenId: string;
      };

      try {
        const dbResult = await dbPool.query<{
          out_attachment_id: string;
          out_disclosure_id: string;
          out_file_name: string;
          out_file_size_bytes: string;
          out_mime_type: string;
          out_sha256_hash: string;
          out_storage_path: string;
          out_token_id: string;
        }>(
          `SELECT
            out_attachment_id,
            out_disclosure_id,
            out_file_name,
            out_file_size_bytes,
            out_mime_type,
            out_sha256_hash,
            out_storage_path,
            out_token_id
          FROM public.get_attachment_upload_context_v1($1::jsonb, $2::uuid)`,
          [JSON.stringify(req.assertion), attachmentId]
        );

        const row = dbResult.rows[0];
        if (!row) {
          throw new AppError({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
            title: 'Resource Not Found',
            detail: `Attachment "${attachmentId}" does not exist.`
          });
        }

        record = {
          attachmentId: row.out_attachment_id,
          disclosureId: row.out_disclosure_id,
          fileName: row.out_file_name,
          fileSizeBytes: String(row.out_file_size_bytes),
          mimeType: row.out_mime_type,
          sha256Hash: row.out_sha256_hash,
          storagePath: row.out_storage_path,
          tokenId: row.out_token_id
        };
      } catch (dbErr: unknown) {
        if (dbErr instanceof AppError) {
          throw dbErr;
        }

        const errRecord = (typeof dbErr === 'object' && dbErr !== null) ? (dbErr as Record<string, unknown>) : {};
        const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

        if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
          throw new AppError({
            statusCode: 403,
            code: 'ATTACHMENT_FORBIDDEN',
            title: 'Forbidden Access',
            detail: 'Only the primary inventor may upload file content to this disclosure.'
          });
        }

        if (errMsg.includes('INVALID_STATE')) {
          throw new AppError({
            statusCode: 422,
            code: 'INVALID_WORKFLOW_STATE',
            title: 'Invalid State',
            detail: 'Attachments can only be uploaded to DRAFT disclosures.'
          });
        }

        if (errMsg.includes('DUPLICATE_UPLOAD')) {
          throw new AppError({
            statusCode: 409,
            code: 'DUPLICATE_UPLOAD',
            title: 'Duplicate Upload',
            detail: 'Attachment has already been processed.'
          });
        }

        if (errMsg.includes('INVALID_SCAN_TOKEN')) {
          throw new AppError({
            statusCode: 422,
            code: 'INVALID_SCAN_TOKEN',
            title: 'Invalid Scan Token',
            detail: errMsg.includes('already claimed')
              ? 'Scan token is already claimed by an active upload in progress.'
              : 'No active scan token found for this attachment. Token may have expired or already been consumed.'
          });
        }

        if (errMsg.includes('NOT_FOUND') || errRecord.code === 'P0002') {
          throw new AppError({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
            title: 'Resource Not Found',
            detail: `Attachment "${attachmentId}" does not exist.`
          });
        }

        throw dbErr;
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

      // Trigger Antivirus Scan Pipeline
      if (!scannerService) {
        throw new AppError({
          statusCode: 503,
          code: 'SCANNER_SERVICE_UNAVAILABLE',
          title: 'Scanner Service Unavailable',
          detail: 'Antivirus scanner service is not configured with a dedicated scanner pool.'
        });
      }

      let scanStatus = 'PENDING_SCAN';
      let scanDetails = 'Awaiting scanner evaluation';

      try {
        const scanRes = await scannerService.scanAndRecord({
          tokenId: record.tokenId,
          attachmentId,
          sha256Hash: actualSha256,
          storagePath: record.storagePath,
          fileContent: fileBuffer
        });
        scanStatus = scanRes.scanStatus;
        scanDetails = scanRes.scanDetails;
      } catch (scanErr: unknown) {
          const scanErrMsg = scanErr instanceof Error ? scanErr.message : String(scanErr);
          if (scanErrMsg.includes('INVALID_SCAN_TOKEN') || scanErrMsg.includes('Scan token is invalid')) {
            throw new AppError({
              statusCode: 422,
              code: 'INVALID_SCAN_TOKEN',
              title: 'Invalid Scan Token',
              detail: 'Scan token is invalid, expired, or already consumed.'
            });
          }
          throw new AppError({
            statusCode: 500,
            code: 'SCANNER_ERROR',
            title: 'Scanner Error',
            detail: `Antivirus scan pipeline failed: ${scanErrMsg}`
          });
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

export function abandonAttachmentHandler(
  dbPool?: Pool,
  quarantineStorage?: IQuarantineStorageAdapter
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
          detail: 'Verified request assertion is required to abandon an attachment.'
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

      // Execute database abandonment gateway
      try {
        await dbPool.query(
          'SELECT public.abandon_attachment_v1($1::jsonb, $2::uuid)',
          [JSON.stringify(req.assertion), attachmentId]
        );
      } catch (dbErr: unknown) {
        const errRecord = (typeof dbErr === 'object' && dbErr !== null) ? (dbErr as Record<string, unknown>) : {};
        const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

        if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
          throw new AppError({
            statusCode: 403,
            code: 'ATTACHMENT_FORBIDDEN',
            title: 'Forbidden Access',
            detail: 'Only the primary inventor may abandon an attachment for this disclosure.'
          });
        }

        if (errMsg.includes('LOCK_CONFLICT') || errRecord.code === '55P03') {
          throw new AppError({
            statusCode: 409,
            code: 'SCAN_IN_PROGRESS',
            title: 'Scan In Progress',
            detail: 'Attachment is actively being processed or scanned; cannot abandon while scan is in progress.'
          });
        }

        if (errMsg.includes('INVALID_STATE')) {
          if (errMsg.includes('CLEAN')) {
            throw new AppError({
              statusCode: 422,
              code: 'ATTACHMENT_ALREADY_CLEAN',
              title: 'Attachment Clean',
              detail: 'Successfully scanned CLEAN attachments cannot be abandoned.'
            });
          }
          if (errMsg.includes('already abandoned')) {
            throw new AppError({
              statusCode: 409,
              code: 'ATTACHMENT_ALREADY_ABANDONED',
              title: 'Already Abandoned',
              detail: 'Attachment is already abandoned.'
            });
          }
          throw new AppError({
            statusCode: 422,
            code: 'INVALID_WORKFLOW_STATE',
            title: 'Invalid Workflow State',
            detail: errMsg.replace(/^.*?INVALID_STATE:\s*/, '')
          });
        }

        if (errMsg.includes('NOT_FOUND') || errRecord.code === 'P0002') {
          throw new AppError({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
            title: 'Resource Not Found',
            detail: `Attachment "${attachmentId}" does not exist.`
          });
        }

        throw dbErr;
      }

      // Safe cleanup of quarantine storage object
      if (quarantineStorage && typeof quarantineStorage.deleteQuarantineObject === 'function') {
        try {
          await quarantineStorage.deleteQuarantineObject(attachmentId);
        } catch (cleanupErr: unknown) {
          // Safe error absorption: quarantine storage failure does not fail the transaction
          // Requirement: "Quarantine cleanup failures are handled safely"
          if (process.env.NODE_ENV !== 'test') {
            console.warn(`[Attachment] Quarantine cleanup failed for abandoned attachment ${attachmentId}:`, cleanupErr);
          }
        }
      }

      res.status(200).json({
        success: true,
        message: 'Attachment successfully abandoned. You may now register and upload a fresh copy.',
        attachmentId,
        scanStatus: 'ABANDONED'
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

