import { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { AppError } from '../middleware/error-handler.middleware.js';

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

      next(err);
    }
  };
}
