/**
 * Safe cookie parsing and configuration utility (zero external dependencies).
 */

export const PRE_AUTH_CSRF_COOKIE_NAME = 'ipr_pre_auth_csrf';
export const PRE_AUTH_CSRF_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return {};
  }

  const cookies: Record<string, string> = {};
  const items = cookieHeader.split(';');

  for (const item of items) {
    const idx = item.indexOf('=');
    if (idx !== -1) {
      const key = item.slice(0, idx).trim();
      const val = item.slice(idx + 1).trim();
      if (key) {
        try {
          cookies[key] = decodeURIComponent(val);
        } catch {
          cookies[key] = val;
        }
      }
    }
  }

  return cookies;
}
