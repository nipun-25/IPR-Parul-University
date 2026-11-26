import crypto from 'node:crypto';
import { ALL_ROLES } from '../constants/roles.constants.js';

export interface CanonicalAssertionInput {
  readonly method: string;
  readonly canonicalPath: string;
  readonly queryParams?: Record<string, string | string[] | undefined> | string;
  readonly operationScope: string;
  readonly actorId: string;
  readonly roles: readonly string[];
  readonly timestamp: string;
  readonly nonce: string;
  readonly bodyHash: string;
}

/**
 * Normalizes HTTP path according to RFC 3986:
 * - Strips duplicate consecutive slashes
 * - Resolves relative segment traversals
 * - Strips trailing slash unless path is root '/'
 */
export function canonicalizePath(path: string): string {
  if (!path || path.trim() === '') return '/';

  // Extract path component if query or hash was accidentally included
  const pathOnly = path.split('?')[0].split('#')[0];

  // Replace multiple slashes with a single slash
  let normalized = pathOnly.replace(/\/+/g, '/');

  // Strip trailing slash if length > 1
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

/**
 * Normalizes query string:
 * - Deterministically sorts keys lexicographically
 * - Deterministically sorts multiple values for the same key
 * - Encodes keys and values using encodeURIComponent
 * - Formats as 'key1=val1&key2=val2' (or empty string if no params)
 */
export function canonicalizeQuery(
  rawQuery?: Record<string, string | string[] | undefined> | string
): string {
  if (!rawQuery) return '';

  const entries: Array<{ key: string; value: string }> = [];

  if (typeof rawQuery === 'string') {
    const trimmed = rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery;
    if (trimmed.trim() === '') return '';

    const params = new URLSearchParams(trimmed);
    params.forEach((value, key) => {
      entries.push({ key: encodeURIComponent(key), value: encodeURIComponent(value) });
    });
  } else {
    for (const [key, val] of Object.entries(rawQuery)) {
      if (val === undefined || val === null) continue;
      const encodedKey = encodeURIComponent(key);
      if (Array.isArray(val)) {
        val.forEach((item) => {
          entries.push({ key: encodedKey, value: encodeURIComponent(String(item)) });
        });
      } else {
        entries.push({ key: encodedKey, value: encodeURIComponent(String(val)) });
      }
    }
  }

  if (entries.length === 0) return '';

  // Sort lexicographically by key, then by value
  entries.sort((a, b) => {
    const keyCmp = a.key.localeCompare(b.key);
    if (keyCmp !== 0) return keyCmp;
    return a.value.localeCompare(b.value);
  });

  return entries.map((e) => `${e.key}=${e.value}`).join('&');
}

/**
 * Normalizes actor roles:
 * - Validates all roles against canonical ALL_ROLES
 * - Deduplicates
 * - Sorts lexicographically
 * - Joins with comma
 */
export function canonicalizeRoles(roles: readonly string[]): string {
  if (!roles || roles.length === 0) {
    throw new Error('Canonical roles cannot be empty');
  }

  const validRoles = new Set<string>();

  for (const role of roles) {
    if (!role || typeof role !== 'string' || role.trim() === '') {
      throw new Error(`Invalid role element: '${role}'`);
    }
    const trimmed = role.trim();
    if (!(ALL_ROLES as readonly string[]).includes(trimmed)) {
      throw new Error(`Unauthorized or unknown role: '${trimmed}'`);
    }
    validRoles.add(trimmed);
  }

  if (validRoles.size === 0) {
    throw new Error('No valid roles found after validation');
  }

  return Array.from(validRoles).sort().join(',');
}

/**
 * Normalizes ISO-8601 timestamp:
 * Strictly enforces YYYY-MM-DDTHH:MM:SSZ (no milliseconds).
 */
export function canonicalizeTimestamp(timestamp: string): string {
  const strictUtcIsoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  if (!strictUtcIsoRegex.test(timestamp)) {
    throw new Error(`Timestamp must strictly match canonical UTC ISO-8601 format (YYYY-MM-DDTHH:MM:SSZ). Received: '${timestamp}'`);
  }
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid calendar date in timestamp: '${timestamp}'`);
  }
  return timestamp;
}

/**
 * Decodes 64-hexadecimal character secret into 32 binary bytes.
 */
export function decodeBffSharedSecret(secretHex: string): Buffer {
  if (typeof secretHex !== 'string' || secretHex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(secretHex)) {
    throw new Error('BFF shared secret must be exactly 64 hexadecimal characters representing 32 bytes.');
  }
  return Buffer.from(secretHex, 'hex');
}

/**
 * Computes SHA-256 hash in lowercase hex format.
 */
export function computeSha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Builds the canonical 9-element newline-delimited assertion string:
 * 1. METHOD
 * 2. CANONICAL_PATH
 * 3. CANONICAL_QUERY
 * 4. OPERATION_SCOPE
 * 5. ACTOR_ID
 * 6. SORTED_ROLES
 * 7. TIMESTAMP
 * 8. NONCE
 * 9. BODY_HASH
 */
export function buildCanonicalAssertionString(input: CanonicalAssertionInput): string {
  const method = input.method.toUpperCase();
  const path = canonicalizePath(input.canonicalPath);
  const query = canonicalizeQuery(input.queryParams);
  const scope = input.operationScope.trim();
  const actorId = input.actorId.trim();
  const sortedRoles = canonicalizeRoles(input.roles);
  const timestamp = canonicalizeTimestamp(input.timestamp);
  const nonce = input.nonce.trim();
  const bodyHash = input.bodyHash.trim().toLowerCase();

  if (!actorId) throw new Error('actorId cannot be empty');
  if (!scope) throw new Error('operationScope cannot be empty');
  if (!nonce) throw new Error('nonce cannot be empty');
  if (!/^[0-9a-f]{64}$/.test(bodyHash)) {
    throw new Error(`bodyHash must be 64-character lowercase hexadecimal. Received: '${bodyHash}'`);
  }

  return [
    method,
    path,
    query,
    scope,
    actorId,
    sortedRoles,
    timestamp,
    nonce,
    bodyHash
  ].join('\n');
}

/**
 * Signs the canonical assertion string with HMAC-SHA256 using the decoded 32-byte binary key.
 */
export function signCanonicalAssertion(canonicalString: string, secretHex: string): string {
  const binaryKey = decodeBffSharedSecret(secretHex);
  return crypto.createHmac('sha256', binaryKey).update(canonicalString).digest('hex');
}

/**
 * Verifies the signature using constant-time comparison to prevent timing attacks.
 */
export function verifyCanonicalAssertion(
  canonicalString: string,
  providedSignatureHex: string,
  secretHex: string
): boolean {
  if (!providedSignatureHex || providedSignatureHex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(providedSignatureHex)) {
    return false;
  }

  try {
    const expectedSignatureHex = signCanonicalAssertion(canonicalString, secretHex);
    const expectedBuf = Buffer.from(expectedSignatureHex, 'hex');
    const providedBuf = Buffer.from(providedSignatureHex.toLowerCase(), 'hex');

    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}
