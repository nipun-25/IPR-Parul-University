import { verifyCsrfToken } from '@ipr/shared';
import { BffSession } from '../session/session.interface.js';

export interface CsrfValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Validates CSRF token for incoming browser requests:
 * - Safe methods (GET, HEAD, OPTIONS) bypass CSRF checks
 * - State-changing methods (POST, PUT, PATCH, DELETE) require a valid synchronizer token
 * - The token must match the authenticated session and server secret using constant-time comparison
 */
export function validateCsrfForRequest(
  request: Request,
  session: BffSession,
  csrfSecret: string
): CsrfValidationResult {
  const method = request.method.toUpperCase();

  if (!STATE_CHANGING_METHODS.has(method)) {
    return { valid: true };
  }

  const token = request.headers.get('x-csrf-token');
  if (!token || token.trim() === '') {
    return {
      valid: false,
      reason: `CSRF token missing in 'X-CSRF-Token' header for state-changing ${method} request.`
    };
  }

  const isValid = verifyCsrfToken(token.trim(), session.sessionId, csrfSecret);
  if (!isValid) {
    return {
      valid: false,
      reason: 'CSRF token is invalid, expired, or bound to a different session.'
    };
  }

  return { valid: true };
}
