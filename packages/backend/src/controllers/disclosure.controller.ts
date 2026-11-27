import { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import {
  CreateAttachmentSchema,
  CreateConsentRequestSchema,
  RevokeConsentSchema,
  CancelConsentInvitationSchema,
  VerifyConsentSchema,
  DisclosureListItemDto,
  InventorConsentItemDto,
  AttachmentItemDto
} from '@ipr/shared';
import { AppError } from '../middleware/error-handler.middleware.js';
import { isDatabaseUnavailable } from '../utils/db-error.util.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getDisclosureHandler(dbPool?: Pool) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Missing database pool returns HTTP 503
      if (!dbPool) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection pool is not configured.'
        });
      }

      // 2. Verified request assertion required
      if (!req.assertion) {
        throw new AppError({
          statusCode: 401,
          code: 'BFF_ASSERTION_MISSING',
          title: 'Missing Request Assertion',
          detail: 'Verified request assertion is required to invoke database gateway.'
        });
      }

      // 3. Malformed UUID is rejected before database access (HTTP 400)
      const disclosureId = req.params.id;
      if (!disclosureId || !UUID_REGEX.test(disclosureId)) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: 'Disclosure identifier must be a valid UUID.'
        });
      }

      // 4. Parameterized database gateway invocation
      const result = await dbPool.query<{
        id: string;
        trackingNumber: string | null;
        title: string;
        status: string;
        primaryInventorId: string;
        assignedReviewerId: string | null;
        reviewStatus: string;
        legalClearanceStatus: string;
        pidcsData: Record<string, unknown>;
        submissionTimestamp: string | null;
        createdAt: string;
        updatedAt: string;
      }>(
        `SELECT
          out_id AS id,
          out_tracking_number AS "trackingNumber",
          out_title AS title,
          out_status AS status,
          out_primary_inventor_id AS "primaryInventorId",
          out_assigned_reviewer_id AS "assignedReviewerId",
          out_review_status AS "reviewStatus",
          out_legal_clearance_status AS "legalClearanceStatus",
          out_pidcs_data AS "pidcsData",
          out_submission_timestamp AS "submissionTimestamp",
          out_created_at AS "createdAt",
          out_updated_at AS "updatedAt"
        FROM public.get_disclosure_v1($1::jsonb, $2::uuid)`,
        [JSON.stringify(req.assertion), disclosureId]
      );

      const row = result.rows[0];
      if (!row) {
        throw new AppError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Resource Not Found',
          detail: `Disclosure "${disclosureId}" does not exist.`
        });
      }

      res.status(200).json({
        success: true,
        disclosure: row,
        disclosureId: row.id,
        actor: req.actor
      });
    } catch (err: unknown) {
      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('NOT_FOUND') || errRecord.code === 'P0002') {
        return next(new AppError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Resource Not Found',
          detail: `Disclosure "${req.params.id}" does not exist.`
        }));
      }

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'DISCLOSURE_ACCESS_DENIED',
          title: 'Forbidden Resource Access',
          detail: 'Actor is not authorized to read this disclosure.'
        }));
      }

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

export function listDisclosuresHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to list disclosures.'
        });
      }

      const result = await dbPool.query<DisclosureListItemDto>(
        `SELECT
          out_id AS id,
          out_tracking_number AS "trackingNumber",
          out_title AS title,
          out_status AS status,
          out_primary_inventor_id AS "primaryInventorId",
          out_assigned_reviewer_id AS "assignedReviewerId",
          out_review_status AS "reviewStatus",
          out_legal_clearance_status AS "legalClearanceStatus",
          out_created_at AS "createdAt",
          out_updated_at AS "updatedAt"
        FROM public.list_disclosures_v1($1::jsonb)`,
        [JSON.stringify(req.assertion)]
      );

      res.status(200).json({
        success: true,
        disclosures: result.rows
      });
    } catch (err: unknown) {
      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'DISCLOSURE_ACCESS_DENIED',
          title: 'Forbidden Resource Access',
          detail: 'Actor is not authorized to list disclosures.'
        }));
      }

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

export function getDisclosureConsentsHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to view consents.'
        });
      }

      const disclosureId = req.params.id;
      if (!disclosureId || !UUID_REGEX.test(disclosureId)) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: 'Disclosure identifier must be a valid UUID.'
        });
      }

      const result = await dbPool.query<InventorConsentItemDto>(
        `SELECT
          out_id AS id,
          out_disclosure_id AS "disclosureId",
          out_user_id AS "userId",
          out_is_external AS "isExternal",
          out_external_name AS "externalName",
          out_external_email AS "externalEmail",
          out_external_organization AS "externalOrganization",
          out_share_basis_points AS "shareBasisPoints",
          out_status AS status,
          out_signature_evidence_id AS "signatureEvidenceId",
          out_created_at AS "createdAt"
        FROM public.get_disclosure_consents_v1($1::jsonb, $2::uuid)`,
        [JSON.stringify(req.assertion), disclosureId]
      );

      res.status(200).json({
        success: true,
        consents: result.rows
      });
    } catch (err: unknown) {
      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('NOT_FOUND') || errRecord.code === 'P0002') {
        return next(new AppError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Resource Not Found',
          detail: `Disclosure "${req.params.id}" does not exist.`
        }));
      }

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'DISCLOSURE_ACCESS_DENIED',
          title: 'Forbidden Resource Access',
          detail: 'Actor is not authorized to view consents for this disclosure.'
        }));
      }

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

export function getDisclosureAttachmentsHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to view attachments.'
        });
      }

      const disclosureId = req.params.id;
      if (!disclosureId || !UUID_REGEX.test(disclosureId)) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: 'Disclosure identifier must be a valid UUID.'
        });
      }

      const result = await dbPool.query<AttachmentItemDto>(
        `SELECT
          out_id AS id,
          out_disclosure_id AS "disclosureId",
          out_file_name AS "fileName",
          out_file_size_bytes AS "fileSizeBytes",
          out_mime_type AS "mimeType",
          out_sha256_hash AS "sha256Hash",
          out_scan_status AS "scanStatus",
          out_created_at AS "createdAt"
        FROM public.get_disclosure_attachments_v1($1::jsonb, $2::uuid)`,
        [JSON.stringify(req.assertion), disclosureId]
      );

      res.status(200).json({
        success: true,
        attachments: result.rows
      });
    } catch (err: unknown) {
      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('NOT_FOUND') || errRecord.code === 'P0002') {
        return next(new AppError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Resource Not Found',
          detail: `Disclosure "${req.params.id}" does not exist.`
        }));
      }

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'DISCLOSURE_ACCESS_DENIED',
          title: 'Forbidden Resource Access',
          detail: 'Actor is not authorized to view attachments for this disclosure.'
        }));
      }

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

export function createAttachmentHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to upload attachments.'
        });
      }

      const parseResult = CreateAttachmentSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const { disclosureId, fileName, fileSizeBytes, mimeType, sha256Hash, storagePath } = parseResult.data;

      const result = await dbPool.query<{
        out_attachment_id: string;
        out_token_id: string;
        out_token_expires_at: string;
      }>(
        `SELECT out_attachment_id, out_token_id, out_token_expires_at
         FROM public.create_attachment_metadata_v1($1::jsonb, $2::uuid, $3::varchar, $4::bigint, $5::varchar, $6::varchar, $7::text)`,
        [
          JSON.stringify(req.assertion),
          disclosureId,
          fileName,
          fileSizeBytes,
          mimeType,
          sha256Hash,
          storagePath
        ]
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error('Database gateway did not return attachment metadata');
      }

      res.status(201).json({
        success: true,
        attachmentId: row.out_attachment_id,
        message: 'Attachment metadata registered successfully in PENDING_SCAN state'
      });
    } catch (err: unknown) {
      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'ATTACHMENT_FORBIDDEN',
          title: 'Forbidden Attachment Action',
          detail: 'Only the primary inventor may upload attachments to this draft disclosure.'
        }));
      }

      if (errMsg.includes('INVALID_STATE')) {
        return next(new AppError({
          statusCode: 422,
          code: 'INVALID_WORKFLOW_STATE',
          title: 'Invalid State',
          detail: 'Attachments can only be uploaded to DRAFT disclosures.'
        }));
      }

      if (errMsg.includes('NOT_FOUND') || errRecord.code === 'P0002') {
        return next(new AppError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Resource Not Found',
          detail: 'Target disclosure does not exist.'
        }));
      }

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

export function createConsentRequestHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to request consent.'
        });
      }

      const parseResult = CreateConsentRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const {
        disclosureId,
        shareBasisPoints,
        userId,
        isExternal,
        externalName,
        externalEmail,
        externalOrganization
      } = parseResult.data;

      const result = await dbPool.query<{ consent_id: string }>(
        `SELECT public.create_inventor_consent_request_v1(
          $1::jsonb, $2::uuid, $3::integer, $4::uuid, $5::boolean, $6::text, $7::text, $8::text
        ) AS consent_id`,
        [
          JSON.stringify(req.assertion),
          disclosureId,
          shareBasisPoints,
          userId ?? null,
          isExternal,
          externalName ?? null,
          externalEmail ?? null,
          externalOrganization ?? null
        ]
      );

      const consentId = result.rows[0]?.consent_id;
      if (!consentId) {
        throw new Error('Database gateway did not return consent ID');
      }

      res.status(201).json({
        success: true,
        consentId,
        message: 'Inventor consent request registered successfully'
      });
    } catch (err: unknown) {
      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('CONFLICT')) {
        return next(new AppError({
          statusCode: 409,
          code: 'INVENTOR_ALREADY_EXISTS',
          title: 'Inventor Conflict',
          detail: 'An active consent record already exists for this inventor.'
        }));
      }

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'CONSENT_FORBIDDEN',
          title: 'Forbidden Consent Action',
          detail: 'Only the primary inventor may create consent requests for this draft.'
        }));
      }

      if (errMsg.includes('INVALID_STATE')) {
        return next(new AppError({
          statusCode: 422,
          code: 'INVALID_WORKFLOW_STATE',
          title: 'Invalid State',
          detail: 'Consents can only be requested on DRAFT disclosures.'
        }));
      }

      if (errMsg.includes('NOT_FOUND') || errRecord.code === 'P0002') {
        return next(new AppError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Resource Not Found',
          detail: 'Disclosure or institutional user does not exist.'
        }));
      }

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

export function revokeConsentHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to revoke consent.'
        });
      }

      const parseResult = RevokeConsentSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const { consentId } = parseResult.data;

      await dbPool.query(
        'SELECT public.revoke_inventor_consent_v1($1::jsonb, $2::uuid)',
        [JSON.stringify(req.assertion), consentId]
      );

      res.status(200).json({
        success: true,
        message: 'Inventor consent revoked successfully'
      });
    } catch (err: unknown) {
      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'CONSENT_REVOCATION_FORBIDDEN',
          title: 'Forbidden Revocation',
          detail: 'Only the consenting inventor may revoke their consent.'
        }));
      }

      if (errMsg.includes('INVALID_STATE')) {
        return next(new AppError({
          statusCode: 422,
          code: 'INVALID_WORKFLOW_STATE',
          title: 'Invalid State',
          detail: 'Only PENDING or VERIFIED consents may be revoked.'
        }));
      }

      if (errMsg.includes('NOT_FOUND') || errRecord.code === 'P0002') {
        return next(new AppError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Resource Not Found',
          detail: 'Consent record does not exist.'
        }));
      }

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

export function cancelConsentInvitationHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to cancel consent invitation.'
        });
      }

      const parseResult = CancelConsentInvitationSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const { consentId } = parseResult.data;

      await dbPool.query(
        'SELECT public.cancel_consent_invitation_v1($1::jsonb, $2::uuid)',
        [JSON.stringify(req.assertion), consentId]
      );

      res.status(200).json({
        success: true,
        consentId,
        message: 'Inventor consent invitation cancelled successfully'
      });
    } catch (err: unknown) {
      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'CONSENT_CANCELLATION_FORBIDDEN',
          title: 'Forbidden Invitation Cancellation',
          detail: 'Only the primary inventor may cancel pending consent invitations.'
        }));
      }

      if (errMsg.includes('INVALID_STATE')) {
        return next(new AppError({
          statusCode: 422,
          code: 'INVALID_WORKFLOW_STATE',
          title: 'Invalid State',
          detail: errMsg.includes('Verified consent cannot be cancelled')
            ? 'Verified consent cannot be cancelled.'
            : 'Only PENDING consent invitations may be cancelled.'
        }));
      }

      if (errMsg.includes('NOT_FOUND') || errRecord.code === 'P0002') {
        return next(new AppError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Resource Not Found',
          detail: 'Consent record does not exist.'
        }));
      }

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

export function verifyConsentHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to verify inventor consent.'
        });
      }

      const parseResult = VerifyConsentSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const { consentId, evidenceAttachmentId, verificationNotes } = parseResult.data;

      await dbPool.query(
        'SELECT public.verify_inventor_consent_v1($1::jsonb, $2::uuid, $3::text, $4::uuid)',
        [JSON.stringify(req.assertion), consentId, verificationNotes || 'Institutional consent verified', evidenceAttachmentId]
      );

      res.status(200).json({
        success: true,
        consentId,
        message: 'Inventor consent verified successfully'
      });
    } catch (err: unknown) {
      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'CONSENT_VERIFICATION_FORBIDDEN',
          title: 'Forbidden Verification',
          detail: 'Only institutional Administrators may verify inventor consent.'
        }));
      }

      if (errMsg.includes('INVALID_STATE')) {
        return next(new AppError({
          statusCode: 422,
          code: 'INVALID_WORKFLOW_STATE',
          title: 'Invalid State',
          detail: 'Only PENDING consents may be verified.'
        }));
      }

      if (errMsg.includes('SECURITY_VIOLATION')) {
        return next(new AppError({
          statusCode: 422,
          code: 'INVALID_EVIDENCE',
          title: 'Invalid Evidence Attachment',
          detail: errMsg.replace(/^[^:]*:\s*/, '') || 'Evidence attachment is invalid, not clean, or already bound.'
        }));
      }

      if (errMsg.includes('VALIDATION_FAILED')) {
        return next(new AppError({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: errMsg.replace(/^[^:]*:\s*/, '') || 'Verification requires a valid signature or consent evidence attachment.'
        }));
      }

      if (errMsg.includes('NOT_FOUND') || errRecord.code === 'P0002') {
        return next(new AppError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Resource Not Found',
          detail: errMsg.includes('Evidence attachment') ? 'Evidence attachment does not exist.' : 'Consent record does not exist.'
        }));
      }

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
