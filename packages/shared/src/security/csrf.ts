import crypto from 'node:crypto';

/**
 * Synchronizer CSRF Token Security Utility
 * Generates and verifies session-bound CSRF tokens using HMAC-SHA256.
 */
export function generateCsrfToken(sessionId: string, csrfSecret: string): string {
  if (!sessionId || !csrfSecret) {
    throw new Error('sessionId and csrfSecret are required to generate CSRF token');
  }

  const randomSalt = crypto.randomBytes(16).toString('hex');
  const payload = `${sessionId}:${randomSalt}`;
  const hmac = crypto.createHmac('sha256', csrfSecret).update(payload).digest('hex');

  // Token structure: salt.hmac
  return `${randomSalt}.${hmac}`;
}

export function verifyCsrfToken(
  token: string | undefined | null,
  sessionId: string,
  csrfSecret: string
): boolean {
  if (!token || typeof token !== 'string' || !sessionId || !csrfSecret) {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [salt, providedHmac] = parts;
  if (!salt || !providedHmac || providedHmac.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(providedHmac)) {
    return false;
  }

  try {
    const payload = `${sessionId}:${salt}`;
    const expectedHmac = crypto.createHmac('sha256', csrfSecret).update(payload).digest('hex');

    const expectedBuf = Buffer.from(expectedHmac, 'hex');
    const providedBuf = Buffer.from(providedHmac.toLowerCase(), 'hex');

    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}
