import { describe, it, expect } from 'vitest';
import { generateCsrfToken, verifyCsrfToken } from '../src/security/csrf.js';

describe('CSRF Synchronizer Token Protection (Gate A2)', () => {
  const testSecret = 'test_csrf_secret_string_with_sufficient_entropy_12345';
  const sessionId = 'session_user_abc123_uuid';

  it('generates a valid session-bound CSRF token', () => {
    const token = generateCsrfToken(sessionId, testSecret);
    expect(typeof token).toBe('string');
    expect(token).toContain('.');

    const [salt, hmac] = token.split('.');
    expect(salt.length).toBe(32); // 16 bytes hex
    expect(hmac.length).toBe(64); // SHA-256 hex
  });

  it('verifies a valid token matching session and secret', () => {
    const token = generateCsrfToken(sessionId, testSecret);
    const isValid = verifyCsrfToken(token, sessionId, testSecret);
    expect(isValid).toBe(true);
  });

  it('rejects missing or empty token', () => {
    expect(verifyCsrfToken('', sessionId, testSecret)).toBe(false);
    expect(verifyCsrfToken(undefined, sessionId, testSecret)).toBe(false);
    expect(verifyCsrfToken(null, sessionId, testSecret)).toBe(false);
  });

  it('rejects malformed token structure', () => {
    expect(verifyCsrfToken('not_a_valid_token', sessionId, testSecret)).toBe(false);
    expect(verifyCsrfToken('part1.part2.part3', sessionId, testSecret)).toBe(false);
    expect(verifyCsrfToken('part1.', sessionId, testSecret)).toBe(false);
  });

  it('rejects a token bound to a different session (session mismatch prevention)', () => {
    const token = generateCsrfToken(sessionId, testSecret);
    const otherSessionId = 'different_session_user_xyz987';

    const isValid = verifyCsrfToken(token, otherSessionId, testSecret);
    expect(isValid).toBe(false);
  });

  it('rejects a token with tampered HMAC bytes', () => {
    const token = generateCsrfToken(sessionId, testSecret);
    const [salt, hmac] = token.split('.');
    const tamperedHmac = hmac.slice(0, -2) + '00';
    const tamperedToken = `${salt}.${tamperedHmac}`;

    const isValid = verifyCsrfToken(tamperedToken, sessionId, testSecret);
    expect(isValid).toBe(false);
  });

  it('rejects a token verified with a different secret', () => {
    const token = generateCsrfToken(sessionId, testSecret);
    const differentSecret = 'completely_different_csrf_secret';

    const isValid = verifyCsrfToken(token, sessionId, differentSecret);
    expect(isValid).toBe(false);
  });
});
