import { Request, Response, NextFunction } from 'express';
import { verifyCsrfToken } from '@ipr/shared';
import { AppError } from './error-handler.middleware.js';
import { parseCookies, PRE_AUTH_CSRF_COOKIE_NAME, PRE_AUTH_CSRF_MAX_AGE_MS } from '../utils/cookie.util.js';

export interface PreAuthCsrfOptions {
  readonly csrfSecret: string;
  readonly cookieName?: string;
  readonly maxAgeMs?: number;
}

/**
 * Pre-Authentication CSRF Protection Middleware
 *
 * Enforces:
 * 1. JSON Content-Type on state-changing methods (POST, PUT, PATCH, DELETE).
 * 2. Presence of signed, short-lived HttpOnly pre-auth cookie.
 * 3. Presence of matching X-CSRF-Token header.
 * 4. Token expiration check against cookie timestamp.
 * 5. Constant-time HMAC verification against csrfSecret.
 */
export function createPreAuthCsrfMiddleware(options: PreAuthCsrfOptions) {
  const cookieName = options.cookieName ?? PRE_AUTH_CSRF_COOKIE_NAME;
  const maxAgeMs = options.maxAgeMs ?? PRE_AUTH_CSRF_MAX_AGE_MS;
  const csrfSecret = options.csrfSecret;

  return (req: Request, _res: Response, next: NextFunction): void => {
    // Safe HTTP methods bypass CSRF verification
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      return next();
    }

    // 1. Enforce JSON Content-Type on state-changing requests
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.toLowerCase().includes('application/json')) {
      return next(new AppError({
        statusCode: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        title: 'Unsupported Media Type',
        detail: 'State-changing authentication requests must specify Content-Type: application/json.'
      }));
    }

    // 2. Extract and validate pre-auth cookie
    const cookies = parseCookies(req.headers.cookie);
    const cookieValue = cookies[cookieName];

    if (!cookieValue) {
      return next(new AppError({
        statusCode: 403,
        code: 'CSRF_COOKIE_MISSING',
        title: 'Forbidden',
        detail: 'Pre-authentication CSRF cookie is missing.'
      }));
    }

    // Validate cookie payload format: <32-hex-nonce>:<timestamp>
    const parts = cookieValue.split(':');
    if (parts.length !== 2) {
      return next(new AppError({
        statusCode: 403,
        code: 'CSRF_COOKIE_INVALID',
        title: 'Forbidden',
        detail: 'Pre-authentication CSRF cookie format is invalid.'
      }));
    }

    const [nonce, issuedAtStr] = parts;
    const issuedAt = parseInt(issuedAtStr, 10);

    if (!nonce || nonce.length !== 32 || isNaN(issuedAt)) {
      return next(new AppError({
        statusCode: 403,
        code: 'CSRF_COOKIE_INVALID',
        title: 'Forbidden',
        detail: 'Pre-authentication CSRF cookie structure is invalid.'
      }));
    }

    // 3. Check token expiration
    const now = Date.now();
    if (now - issuedAt > maxAgeMs) {
      return next(new AppError({
        statusCode: 403,
        code: 'CSRF_TOKEN_EXPIRED',
        title: 'Forbidden',
        detail: 'Pre-authentication CSRF token has expired. Please refresh the page.'
      }));
    }

    // Reject timestamps from the future beyond clock skew tolerance (60s)
    if (issuedAt > now + 60000) {
      return next(new AppError({
        statusCode: 403,
        code: 'CSRF_TOKEN_INVALID',
        title: 'Forbidden',
        detail: 'Pre-authentication CSRF cookie timestamp is invalid.'
      }));
    }

    // 4. Extract and validate X-CSRF-Token header
    const tokenHeader = req.headers['x-csrf-token'];
    if (!tokenHeader || typeof tokenHeader !== 'string' || tokenHeader.trim() === '') {
      return next(new AppError({
        statusCode: 403,
        code: 'CSRF_TOKEN_MISSING',
        title: 'Forbidden',
        detail: 'Pre-authentication CSRF token is missing in X-CSRF-Token header.'
      }));
    }

    const isValid = verifyCsrfToken(tokenHeader.trim(), cookieValue, csrfSecret);
    if (!isValid) {
      return next(new AppError({
        statusCode: 403,
        code: 'CSRF_TOKEN_INVALID',
        title: 'Forbidden',
        detail: 'Pre-authentication CSRF token is invalid or does not match cookie.'
      }));
    }

    next();
  };
}
