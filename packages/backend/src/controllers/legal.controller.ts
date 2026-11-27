import { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import {
  RecordLegalClearanceSchema,
  CreatePatentApplicationSchema,
  RecordPatentStageTransitionSchema
} from '@ipr/shared';
import { AppError } from '../middleware/error-handler.middleware.js';
import { isDatabaseUnavailable } from '../utils/db-error.util.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function recordLegalClearanceHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to record legal clearance.'
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

      const parsed = RecordLegalClearanceSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: parsed.error.issues.map((i) => i.message).join('; ')
        });
      }

      await dbPool.query(
        `SELECT public.record_legal_clearance_v1($1::jsonb, $2::uuid, $3::varchar, $4::text)`,
        [
          JSON.stringify(req.assertion),
          disclosureId,
          parsed.data.clearanceStatus,
          parsed.data.clearanceNotes
        ]
      );

      res.status(200).json({
        success: true,
        message: 'Legal clearance recorded successfully.',
        data: {
          disclosureId,
          clearanceStatus: parsed.data.clearanceStatus,
          recordedAt: new Date().toISOString()
        }
      });
    } catch (err: unknown) {
      const errRecord = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('NOT_FOUND') || errMsg.includes('does not exist')) {
        return next(
          new AppError({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
            title: 'Disclosure Not Found',
            detail: `Disclosure "${req.params.id}" does not exist.`
          })
        );
      }

      if (errMsg.includes('INVALID_STATE')) {
        return next(
          new AppError({
            statusCode: 422,
            code: 'INVALID_WORKFLOW_STATE',
            title: 'Invalid Workflow State',
            detail: errMsg
          })
        );
      }

      if (errMsg.includes('INVALID_ARGUMENT')) {
        return next(
          new AppError({
            statusCode: 400,
            code: 'VALIDATION_FAILED',
            title: 'Invalid Argument',
            detail: errMsg
          })
        );
      }

      if (
        errMsg.includes('FORBIDDEN') ||
        errRecord.code === '42501' ||
        errMsg.includes('insufficient_privilege')
      ) {
        return next(
          new AppError({
            statusCode: 403,
            code: 'LEGAL_FORBIDDEN',
            title: 'Forbidden Legal Action',
            detail: errMsg.includes('Legal')
              ? 'Only authorized Legal Officers may record legal clearance.'
              : 'Insufficient privileges to record legal clearance.'
          })
        );
      }

      if (isDatabaseUnavailable(err)) {
        return next(
          new AppError({
            statusCode: 503,
            code: 'DATABASE_UNAVAILABLE',
            title: 'Database Unavailable',
            detail: 'Database connection failed or service is temporarily unavailable.'
          })
        );
      }

      next(err);
    }
  };
}

export function createPatentApplicationHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to create a patent application.'
        });
      }

      const parsed = CreatePatentApplicationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: parsed.error.issues.map((i) => i.message).join('; ')
        });
      }

      const result = await dbPool.query<{ application_id: string }>(
        `SELECT public.create_patent_application_v1($1::jsonb, $2::uuid, $3::uuid) AS application_id`,
        [
          JSON.stringify(req.assertion),
          parsed.data.disclosureId,
          parsed.data.assignedLegalOfficerId || null
        ]
      );

      const applicationId = result.rows[0]?.application_id;

      res.status(201).json({
        success: true,
        message: 'Patent application created successfully.',
        application: {
          id: applicationId,
          disclosureId: parsed.data.disclosureId,
          assignedLegalOfficerId: parsed.data.assignedLegalOfficerId || null,
          currentStage: 'FILING_PREPARATION'
        }
      });
    } catch (err: unknown) {
      const errRecord = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('NOT_FOUND') || errMsg.includes('does not exist')) {
        return next(
          new AppError({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
            title: 'Disclosure Not Found',
            detail: 'Target invention disclosure does not exist.'
          })
        );
      }

      if (errMsg.includes('DUPLICATE_APPLICATION')) {
        return next(
          new AppError({
            statusCode: 409,
            code: 'DUPLICATE_APPLICATION',
            title: 'Duplicate Patent Application',
            detail: errMsg
          })
        );
      }

      if (errMsg.includes('INVALID_STATE')) {
        return next(
          new AppError({
            statusCode: 422,
            code: 'INVALID_WORKFLOW_STATE',
            title: 'Invalid Workflow State',
            detail: errMsg
          })
        );
      }

      if (
        errMsg.includes('FORBIDDEN') ||
        errRecord.code === '42501' ||
        errMsg.includes('insufficient_privilege')
      ) {
        return next(
          new AppError({
            statusCode: 403,
            code: 'PATENT_FORBIDDEN',
            title: 'Forbidden Patent Operation',
            detail: errMsg
          })
        );
      }

      if (isDatabaseUnavailable(err)) {
        return next(
          new AppError({
            statusCode: 503,
            code: 'DATABASE_UNAVAILABLE',
            title: 'Database Unavailable',
            detail: 'Database connection failed or service is temporarily unavailable.'
          })
        );
      }

      next(err);
    }
  };
}

export function recordPatentStageTransitionHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to record patent stage transition.'
        });
      }

      const applicationId = req.params.id;
      if (!applicationId || !UUID_REGEX.test(applicationId)) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: 'Patent application identifier must be a valid UUID.'
        });
      }

      const parsed = RecordPatentStageTransitionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: parsed.error.issues.map((i) => i.message).join('; ')
        });
      }

      const result = await dbPool.query<{ history_id: string }>(
        `SELECT public.record_patent_stage_transition_v2($1::jsonb, $2::uuid, $3::varchar, $4::text) AS history_id`,
        [
          JSON.stringify(req.assertion),
          applicationId,
          parsed.data.toStage,
          parsed.data.transitionReason
        ]
      );

      res.status(200).json({
        success: true,
        message: 'Patent stage transitioned successfully.',
        data: {
          patentApplicationId: applicationId,
          toStage: parsed.data.toStage,
          historyId: result.rows[0]?.history_id,
          transitionedAt: new Date().toISOString()
        }
      });
    } catch (err: unknown) {
      const errRecord = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('NOT_FOUND') || errMsg.includes('does not exist')) {
        return next(
          new AppError({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
            title: 'Patent Application Not Found',
            detail: `Patent application "${req.params.id}" does not exist.`
          })
        );
      }

      if (errMsg.includes('INVALID_OPERATION')) {
        return next(
          new AppError({
            statusCode: 422,
            code: 'INVALID_OPERATION',
            title: 'Invalid Stage Transition Operation',
            detail: errMsg
          })
        );
      }

      if (errMsg.includes('INVALID_TRANSITION')) {
        return next(
          new AppError({
            statusCode: 422,
            code: 'INVALID_TRANSITION',
            title: 'Invalid Stage Transition',
            detail: errMsg
          })
        );
      }

      if (
        errMsg.includes('FORBIDDEN') ||
        errRecord.code === '42501' ||
        errMsg.includes('insufficient_privilege')
      ) {
        return next(
          new AppError({
            statusCode: 403,
            code: 'STAGE_TRANSITION_FORBIDDEN',
            title: 'Forbidden Stage Transition',
            detail: errMsg
          })
        );
      }

      if (isDatabaseUnavailable(err)) {
        return next(
          new AppError({
            statusCode: 503,
            code: 'DATABASE_UNAVAILABLE',
            title: 'Database Unavailable',
            detail: 'Database connection failed or service is temporarily unavailable.'
          })
        );
      }

      next(err);
    }
  };
}

export function getPatentApplicationHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to get patent application details.'
        });
      }

      const applicationId = req.params.id;
      if (!applicationId || !UUID_REGEX.test(applicationId)) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          title: 'Validation Failed',
          detail: 'Patent application identifier must be a valid UUID.'
        });
      }

      const result = await dbPool.query(
        `SELECT
          out_id AS id,
          out_disclosure_id AS "disclosureId",
          out_current_stage AS "currentStage",
          out_assigned_legal_officer_id AS "assignedLegalOfficerId",
          out_current_history_id AS "currentHistoryId",
          out_filing_date AS "filingDate",
          out_application_number AS "applicationNumber",
          out_created_at AS "createdAt",
          out_updated_at AS "updatedAt"
        FROM public.get_patent_application_v1($1::jsonb, $2::uuid)`,
        [JSON.stringify(req.assertion), applicationId]
      );

      if (!result.rows[0]) {
        throw new AppError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          title: 'Patent Application Not Found',
          detail: `Patent application "${applicationId}" was not found.`
        });
      }

      res.status(200).json({
        success: true,
        application: result.rows[0]
      });
    } catch (err: unknown) {
      const errRecord = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('NOT_FOUND') || errMsg.includes('does not exist')) {
        return next(
          new AppError({
            statusCode: 404,
            code: 'RESOURCE_NOT_FOUND',
            title: 'Patent Application Not Found',
            detail: `Patent application "${req.params.id}" does not exist.`
          })
        );
      }

      if (
        errMsg.includes('FORBIDDEN') ||
        errRecord.code === '42501' ||
        errMsg.includes('insufficient_privilege')
      ) {
        return next(
          new AppError({
            statusCode: 403,
            code: 'PATENT_ACCESS_DENIED',
            title: 'Forbidden Resource Access',
            detail: 'Actor is not authorized to read this patent application.'
          })
        );
      }

      if (isDatabaseUnavailable(err)) {
        return next(
          new AppError({
            statusCode: 503,
            code: 'DATABASE_UNAVAILABLE',
            title: 'Database Unavailable',
            detail: 'Database connection failed or service is temporarily unavailable.'
          })
        );
      }

      next(err);
    }
  };
}
