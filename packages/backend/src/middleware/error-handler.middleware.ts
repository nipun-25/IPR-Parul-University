import { Request, Response, NextFunction } from 'express';
import { ProblemDetails } from '@ipr/shared';
import { logger } from '../config/logger.config.js';

export const KNOWN_SQLSTATE_MAP: Record<string, { status: number; code: string; title: string; detail: string }> = {
  IPR01: { status: 400, code: 'AUTH_INVALID_PARAMETERS', title: 'Invalid Authorization', detail: 'Mandatory authorization parameters were missing or malformed.' },
  IPR02: { status: 403, code: 'CONSENT_CREATION_DENIED', title: 'Consent Creation Denied', detail: 'Actor is not authorized as primary inventor for this draft.' },
  IPR03: { status: 422, code: 'CONSENT_REVOKED_TERMINAL', title: 'Consent Revoked', detail: 'Revoked consent is terminal and cannot be re-verified.' },
  IPR04: { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Resource Not Found', detail: 'The requested resource was not found.' },
  IPR05: { status: 422, code: 'INVALID_WORKFLOW_STATE', title: 'Invalid Workflow State', detail: 'The resource is not in the required workflow status.' },
  IPR09: { status: 422, code: 'SUBMIT_SHARE_INVALID', title: 'Invalid Shares', detail: 'Inventor shares must total exactly 10,000 basis points.' },
  IPR11: { status: 403, code: 'REVIEWER_CONFLICT_OF_INTEREST', title: 'Conflict of Interest', detail: 'Reviewer is a named inventor on this disclosure.' },
  IPR12: { status: 403, code: 'WORKER_AUTH_DENIED', title: 'Worker Authorization Denied', detail: 'Caller lacks required worker credentials.' },
  IPR13: { status: 404, code: 'TASK_NOT_FOUND', title: 'Task Not Found', detail: 'Specified outbox task does not exist.' },
  IPR14: { status: 409, code: 'TASK_NOT_RUNNING', title: 'Task Conflict', detail: 'Outbox task is not currently in running state.' },
  IPR15: { status: 403, code: 'LEASE_TOKEN_MISMATCH', title: 'Lease Mismatch', detail: 'Supplied worker lease token is invalid.' },
  IPR16: { status: 409, code: 'TASK_LEASE_EXPIRED', title: 'Lease Expired', detail: 'Worker task lease has expired and must be reclaimed.' },
  IPR19: { status: 400, code: 'INVALID_SUCCESS_CODE', title: 'Invalid Response Code', detail: 'Response code does not indicate successful delivery.' },
  IPR20: { status: 422, code: 'INVALID_PROMOTION_STATE', title: 'Invalid Promotion State', detail: 'Attachment is not in promotion pending state.' },
  IPR21: { status: 422, code: 'CHECKSUM_MUTATION', title: 'Checksum Mismatch', detail: 'Verified checksum does not match attachment record.' },
  '23505': { status: 409, code: 'CONFLICT_UNIQUE_VIOLATION', title: 'Resource Conflict', detail: 'A record with this identifier already exists.' },
  '42501': { status: 403, code: 'DATABASE_PERMISSION_DENIED', title: 'Permission Denied', detail: 'Database privilege boundary rejected operation.' }
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly title: string;
  public readonly detail: string;

  constructor(options: { statusCode: number; code: string; title: string; detail: string }) {
    super(options.detail);
    this.name = 'AppError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.title = options.title;
    this.detail = options.detail;
  }
}

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Strip query string from instance URL to prevent sensitive query parameter leakage
  const sanitizedInstance = (req.originalUrl || req.url || '').split('?')[0] || '/';
  const routeTemplate = req.baseUrl + (req.route?.path || req.path || '');

  let status = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let title = 'Internal Server Error';
  let detail = 'An unexpected internal error occurred.';

  const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};

  if (err instanceof AppError) {
    status = err.statusCode;
    code = err.code;
    title = err.title;
    detail = err.detail;
  } else if (typeof errRecord.code === 'string' && KNOWN_SQLSTATE_MAP[errRecord.code]) {
    const mapped = KNOWN_SQLSTATE_MAP[errRecord.code];
    status = mapped.status;
    code = mapped.code;
    title = mapped.title;
    detail = mapped.detail;
  } else if (errRecord.name === 'ZodError') {
    status = 400;
    code = 'SCHEMA_VALIDATION_FAILED';
    title = 'Validation Error';
    detail = 'One or more request parameters failed schema validation.';
  } else if (typeof errRecord.status === 'number') {
    status = errRecord.status;
    code = 'HTTP_' + errRecord.status;
    title = typeof errRecord.message === 'string' ? errRecord.message : 'HTTP Error';
    detail = 'The request could not be processed.';
  }

  // Safe structured diagnostic logging - never dumps raw err.message or sensitive SQL strings
  logger.error({
    event: 'api_error',
    code,
    status,
    route: routeTemplate,
    method: req.method,
    durationMs: req.headers['x-request-start'] ? Date.now() - Number(req.headers['x-request-start']) : undefined
  });

  const zodIssues = Array.isArray(errRecord.issues) ? (errRecord.issues as Array<{ path: (string | number)[]; message: string }>) : undefined;

  const problem: ProblemDetails = {
    type: `https://ipr.paruluniversity.ac.in/errors/${code}`,
    title,
    status,
    detail,
    instance: sanitizedInstance,
    code,
    invalidParams: zodIssues?.map((issue) => ({
      name: issue.path.join('.'),
      reason: issue.message
    }))
  };

  res.status(status).contentType('application/problem+json').json(problem);
}
