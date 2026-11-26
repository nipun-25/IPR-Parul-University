import { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { CreateDraftDisclosureSchema, UpdateDraftDisclosureSchema, SubmitDisclosureSchema } from '@ipr/shared';
import { AppError } from '../middleware/error-handler.middleware.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isDatabaseUnavailable(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const errRecord = err as Record<string, unknown>;
  const code = typeof errRecord.code === 'string' ? errRecord.code : '';
  const msg = typeof errRecord.message === 'string' ? errRecord.message : '';

  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'EPIPE'].includes(code)) {
    return true;
  }
  if (code.startsWith('08') || code.startsWith('57P')) {
    return true;
  }
  if (/Connection terminated|timeout exceeded when trying to connect|client has already been released|could not connect to server/i.test(msg)) {
    return true;
  }
  return false;
}

export function createDraftHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to invoke database gateway.'
        });
      }

      const parseResult = CreateDraftDisclosureSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const { title, pidcsData } = parseResult.data;

      const result = await dbPool.query<{ draft_id: string }>(
        'SELECT public.create_draft_disclosure_v1($1::jsonb, $2::varchar, $3::jsonb) AS draft_id',
        [
          JSON.stringify(req.assertion),
          title,
          JSON.stringify(pidcsData ?? {})
        ]
      );

      const draftId = result.rows[0]?.draft_id;
      if (!draftId) {
        throw new Error('Database gateway did not return a draft ID');
      }

      res.status(201).json({
        success: true,
        draftId,
        message: 'Draft disclosure created successfully'
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

export function updateDraftHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to invoke database gateway.'
        });
      }

      const draftId = req.params.id;
      if (!draftId || !UUID_REGEX.test(draftId)) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: 'Disclosure identifier must be a valid UUID.'
        });
      }

      const parseResult = UpdateDraftDisclosureSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const { title, pidcsData } = parseResult.data;

      await dbPool.query(
        'SELECT public.update_draft_disclosure_v1($1::jsonb, $2::uuid, $3::varchar, $4::jsonb)',
        [
          JSON.stringify(req.assertion),
          draftId,
          title ?? null,
          pidcsData !== undefined ? JSON.stringify(pidcsData) : null
        ]
      );

      res.status(200).json({
        success: true,
        message: 'Draft disclosure updated successfully',
        draftId
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

      if (errMsg.includes('INVALID_STATE') || errRecord.code === 'IPR05') {
        return next(new AppError({
          statusCode: 422,
          code: 'INVALID_WORKFLOW_STATE',
          title: 'Invalid Workflow State',
          detail: errMsg || 'Only DRAFT disclosures can be updated.'
        }));
      }

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'FORBIDDEN',
          title: 'Forbidden Access',
          detail: 'Only primary inventor may update draft disclosure.'
        }));
      }

      next(err);
    }
  };
}

export function submitDraftHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to invoke database gateway.'
        });
      }

      const draftId = req.params.id;
      if (!draftId || !UUID_REGEX.test(draftId)) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: 'Disclosure identifier must be a valid UUID.'
        });
      }

      const parseResult = SubmitDisclosureSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const result = await dbPool.query<{ tracking_number: string }>(
        'SELECT public.submit_initial_disclosure_v3($1::jsonb, $2::uuid) AS tracking_number',
        [
          JSON.stringify(req.assertion),
          draftId
        ]
      );

      const trackingNumber = result.rows[0]?.tracking_number;
      if (!trackingNumber) {
        throw new Error('Database gateway did not return a tracking number');
      }

      res.status(200).json({
        success: true,
        message: 'Draft disclosure submitted successfully',
        trackingNumber,
        draftId,
        actor: req.actor
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

      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('BFF_SIGNATURE_INVALID')) {
        return next(new AppError({
          statusCode: 401,
          code: 'BFF_SIGNATURE_INVALID',
          title: 'Invalid BFF Signature',
          detail: 'Cryptographic request signature verification failed.'
        }));
      }

      if (errMsg.includes('BFF_ASSERTION_TIMESTAMP_EXPIRED')) {
        return next(new AppError({
          statusCode: 401,
          code: 'BFF_ASSERTION_TIMESTAMP_EXPIRED',
          title: 'Assertion Timestamp Expired',
          detail: 'Assertion timestamp is outside the permitted validity window.'
        }));
      }

      if (errMsg.includes('BFF_SCOPE_AUTHORIZATION_DENIED')) {
        return next(new AppError({
          statusCode: 403,
          code: 'BFF_SCOPE_AUTHORIZATION_DENIED',
          title: 'Scope Authorization Denied',
          detail: 'Assertion operation scope is not authorized for this gateway.'
        }));
      }

      if (errMsg.includes('ASSERTION_REPLAY_DETECTED') || errRecord.code === '23505') {
        return next(new AppError({
          statusCode: 409,
          code: 'ASSERTION_REPLAY_DETECTED',
          title: 'Assertion Replay Detected',
          detail: 'The single-use assertion nonce has already been consumed.'
        }));
      }

      if (errMsg.includes('NOT_FOUND') || errRecord.code === 'P0002') {
        return next(new AppError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Resource Not Found',
          detail: `Disclosure "${req.params.id}" does not exist.`
        }));
      }

      if (errMsg.includes('INVALID_STATE') || errRecord.code === 'IPR05') {
        return next(new AppError({
          statusCode: 422,
          code: 'INVALID_WORKFLOW_STATE',
          title: 'Invalid Workflow State',
          detail: errMsg || 'Only DRAFT disclosures can be submitted.'
        }));
      }

      if (errMsg.includes('SECURITY_VIOLATION')) {
        return next(new AppError({
          statusCode: 422,
          code: 'SECURITY_VIOLATION',
          title: 'Security Violation',
          detail: errMsg || 'Cannot submit disclosure with pending, infected, or unscanned attachments.'
        }));
      }

      if (errMsg.includes('VALIDATION_FAILED')) {
        return next(new AppError({
          statusCode: 422,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: errMsg || 'Submission validation requirements were not met.'
        }));
      }

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'FORBIDDEN',
          title: 'Forbidden Access',
          detail: errMsg || 'Only the primary inventor may submit this disclosure.'
        }));
      }

      next(err);
    }
  };
}
