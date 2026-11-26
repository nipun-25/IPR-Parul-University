/**
 * Safe cookie parsing utility (zero external dependencies).
 */
export function parseCookies(cookieHeader?: string | null): Record<string, string> {
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
