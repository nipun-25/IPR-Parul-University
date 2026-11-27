import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import type { DisclosureListItemDto, ReportingSummaryDto } from '@ipr/shared';
import { AppError } from '../middleware/error-handler.middleware.js';
import { isDatabaseUnavailable } from '../utils/db-error.util.js';

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function getReportingSummaryHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to generate reports.'
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
        FROM public.list_disclosures_v1($1::jsonb)
        ORDER BY out_created_at DESC`,
        [JSON.stringify(req.assertion)]
      );

      const rows = result.rows;
      const byStatus: Record<string, number> = { DRAFT: 0, SUBMITTED: 0, APPROVED: 0 };
      const byReviewStatus: Record<string, number> = { UNASSIGNED: 0, ASSIGNED: 0, IN_PROGRESS: 0, COMPLETED: 0 };
      const byLegalClearanceStatus: Record<string, number> = { NOT_STARTED: 0, PENDING: 0, CLEARED: 0, REJECTED: 0 };

      for (const row of rows) {
        byStatus[row.status] = (byStatus[row.status] || 0) + 1;
        byReviewStatus[row.reviewStatus] = (byReviewStatus[row.reviewStatus] || 0) + 1;
        byLegalClearanceStatus[row.legalClearanceStatus] = (byLegalClearanceStatus[row.legalClearanceStatus] || 0) + 1;
      }

      const summary: ReportingSummaryDto = {
        totalDisclosures: rows.length,
        byStatus,
        byReviewStatus,
        byLegalClearanceStatus,
        recentActivity: rows.slice(0, 5).map((r) => ({
          id: r.id,
          trackingNumber: r.trackingNumber,
          title: r.title,
          status: r.status,
          reviewStatus: r.reviewStatus,
          legalClearanceStatus: r.legalClearanceStatus,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        }))
      };

      res.status(200).json({
        success: true,
        summary
      });
    } catch (err: unknown) {
      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'REPORT_ACCESS_DENIED',
          title: 'Forbidden Report Access',
          detail: 'Actor is not authorized to generate institutional reports.'
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

export function exportDisclosuresCsvHandler(dbPool?: Pool) {
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
          detail: 'Verified request assertion is required to export disclosures.'
        });
      }

      const { q, search, status, reviewStatus, legalClearanceStatus } = req.query;
      const searchTerm = (typeof q === 'string' && q.trim()) || (typeof search === 'string' && search.trim()) || null;
      const statusFilter = (typeof status === 'string' && status.trim()) || null;
      const reviewFilter = (typeof reviewStatus === 'string' && reviewStatus.trim()) || null;
      const legalFilter = (typeof legalClearanceStatus === 'string' && legalClearanceStatus.trim()) || null;

      let result;
      if (!searchTerm && !statusFilter && !reviewFilter && !legalFilter) {
        result = await dbPool.query<DisclosureListItemDto>(
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
          FROM public.list_disclosures_v1($1::jsonb)
          ORDER BY out_created_at DESC`,
          [JSON.stringify(req.assertion)]
        );
      } else {
        result = await dbPool.query<DisclosureListItemDto>(
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
          FROM public.list_disclosures_v1($1::jsonb)
          WHERE ($2::text IS NULL OR out_title ILIKE '%' || $2 || '%' OR out_tracking_number ILIKE '%' || $2 || '%')
            AND ($3::text IS NULL OR out_status = $3)
            AND ($4::text IS NULL OR out_review_status = $4)
            AND ($5::text IS NULL OR out_legal_clearance_status = $5)
          ORDER BY out_created_at DESC`,
          [
            JSON.stringify(req.assertion),
            searchTerm,
            statusFilter,
            reviewFilter,
            legalFilter
          ]
        );
      }

      const headers = [
        'ID',
        'Tracking Number',
        'Title',
        'Status',
        'Review Status',
        'Legal Clearance Status',
        'Primary Inventor ID',
        'Created At',
        'Updated At'
      ];

      const csvRows = [headers.join(',')];
      for (const row of result.rows) {
        csvRows.push([
          escapeCsvField(row.id),
          escapeCsvField(row.trackingNumber || 'DRAFT'),
          escapeCsvField(row.title),
          escapeCsvField(row.status),
          escapeCsvField(row.reviewStatus),
          escapeCsvField(row.legalClearanceStatus),
          escapeCsvField(row.primaryInventorId),
          escapeCsvField(row.createdAt),
          escapeCsvField(row.updatedAt)
        ].join(','));
      }

      const csvContent = csvRows.join('\r\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="parul-ipr-disclosures.csv"');
      res.status(200).send(csvContent);
    } catch (err: unknown) {
      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('FORBIDDEN') || errRecord.code === '42501' || errMsg.includes('insufficient_privilege')) {
        return next(new AppError({
          statusCode: 403,
          code: 'EXPORT_ACCESS_DENIED',
          title: 'Forbidden Export Access',
          detail: 'Actor is not authorized to export institutional disclosures.'
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
