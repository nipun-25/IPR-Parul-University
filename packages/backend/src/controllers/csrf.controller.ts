import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { generateCsrfToken } from '@ipr/shared';
import { PRE_AUTH_CSRF_COOKIE_NAME, PRE_AUTH_CSRF_MAX_AGE_MS } from '../utils/cookie.util.js';

export interface CsrfBootstrapOptions {
  readonly csrfSecret: string;
  readonly isProduction: boolean;
  readonly cookieName?: string;
  readonly maxAgeMs?: number;
}

/**
 * Controller for GET /api/v1/auth/csrf
 * Generates an ephemeral pre-auth session nonce bound to an HttpOnly cookie
 * and returns the corresponding synchronizer CSRF token in response JSON.
 */
export function createCsrfBootstrapHandler(options: CsrfBootstrapOptions) {
  const cookieName = options.cookieName ?? PRE_AUTH_CSRF_COOKIE_NAME;
  const maxAgeMs = options.maxAgeMs ?? PRE_AUTH_CSRF_MAX_AGE_MS;
  const csrfSecret = options.csrfSecret;
  const isProduction = options.isProduction;

  return (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const now = Date.now();
      const nonce = crypto.randomBytes(16).toString('hex'); // 32 hex chars
      const cookieValue = `${nonce}:${now}`;

      // Generate synchronizer token bound to this cookie value
      const csrfToken = generateCsrfToken(cookieValue, csrfSecret);

      // Set short-lived HttpOnly pre-auth cookie
      res.cookie(cookieName, cookieValue, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/api/v1/auth',
        maxAge: maxAgeMs
      });

      res.status(200).json({ csrfToken });
    } catch (err) {
      next(err);
    }
  };
}
