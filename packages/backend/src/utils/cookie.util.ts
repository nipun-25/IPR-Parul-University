import type { Response } from 'express';
export { parseCookies } from '@ipr/shared';

export const PRE_AUTH_CSRF_COOKIE_NAME = 'ipr_pre_auth_csrf';
export const PRE_AUTH_CSRF_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

export const SESSION_COOKIE_NAME = 'ipr_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Appends a Set-Cookie header string without overwriting existing cookies.
 */
export function appendCookieHeader(res: Response, cookieStr: string): void {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', [cookieStr]);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieStr]);
  }
}

/**
 * Sets the secure, HttpOnly, SameSite=Lax session cookie.
 */
export function setSessionCookie(
  res: Response,
  token: string,
  isProduction: boolean,
  expiresAt: Date
): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`
  ];
  if (isProduction) {
    parts.push('Secure');
  }
  appendCookieHeader(res, parts.join('; '));
}

/**
 * Clears the session cookie on logout or invalid session.
 */
export function clearSessionCookie(res: Response, isProduction: boolean): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ];
  if (isProduction) {
    parts.push('Secure');
  }
  appendCookieHeader(res, parts.join('; '));
}
