/**
 * Safely parses the TRUST_PROXY environment variable or option for Express app.set('trust proxy', ...).
 *
 * Express trust proxy supports:
 * - boolean: false (no proxy trust) or true (trust all hops - not recommended for production)
 * - number: hop count (e.g. 1)
 * - string: predefined subnet ('loopback', 'linklocal', 'uniquelocal') or single IP/CIDR
 * - string[]: array of trusted IPs/CIDRs
 */
export function parseTrustProxy(
  value: string | boolean | number | string[] | undefined
): boolean | string | number | string[] {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'boolean' || typeof value === 'number' || Array.isArray(value)) {
    return value;
  }

  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'false' || lower === '0' || lower === '') {
    return false;
  }

  if (lower === 'true') {
    return true;
  }

  // Integer hop count, e.g. "1" or "2"
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // Comma-separated list of trusted IPs/subnets, e.g. "loopback, 10.0.0.0/8"
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return trimmed;
}
