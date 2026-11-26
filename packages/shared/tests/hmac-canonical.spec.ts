import { describe, it, expect } from 'vitest';
import {
  buildCanonicalAssertionString,
  signCanonicalAssertion,
  verifyCanonicalAssertion,
  decodeBffSharedSecret,
  computeSha256,
  canonicalizeQuery,
  canonicalizePath,
  canonicalizeRoles,
  canonicalizeTimestamp
} from '../src/security/hmac-canonical.js';

describe('Canonical HMAC-SHA256 Assertion (Gate A2 Revision 8 Vectors)', () => {
  const secretHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  describe('Key Decoding', () => {
    it('decodes a valid 64-character hex string into a 32-byte binary key', () => {
      const key = decodeBffSharedSecret(secretHex);
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('rejects secrets that are not exactly 64 hexadecimal characters', () => {
      expect(() => decodeBffSharedSecret('short_secret')).toThrow('exactly 64 hexadecimal characters');
      expect(() => decodeBffSharedSecret('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeZ')).toThrow('exactly 64 hexadecimal characters');
    });
  });

  describe('Revision 8 POST Test Vector (Submission Request)', () => {
    const postPayload = '{"clientChecksum":"f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2"}';
    const expectedBodyHash = 'ffed0e09ec0b1e3b43f840c702a9853735eff5c6dd0a3acec763e0723b486dfa';
    const expectedSignature = 'f1ff1881ee136c675e74891e7a4d3f10ef6c1fbeab783696928ca08fb26eac4f';

    it('computes exact SHA-256 body hash matching the test vector', () => {
      const computedHash = computeSha256(postPayload);
      expect(computedHash).toBe(expectedBodyHash);
    });

    it('builds the exact 9-element canonical assertion string', () => {
      const canonical = buildCanonicalAssertionString({
        method: 'POST',
        canonicalPath: '/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit',
        queryParams: '',
        operationScope: 'OP_SUBMIT_DISCLOSURE',
        actorId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        roles: ['Faculty'],
        timestamp: '2026-11-24T10:00:00Z',
        nonce: 'c8f13e7b9a5d4c2e8f1a3b5c7d9e1f3a',
        bodyHash: expectedBodyHash
      });

      const expectedCanonical = [
        'POST',
        '/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit',
        '',
        'OP_SUBMIT_DISCLOSURE',
        'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        'Faculty',
        '2026-11-24T10:00:00Z',
        'c8f13e7b9a5d4c2e8f1a3b5c7d9e1f3a',
        'ffed0e09ec0b1e3b43f840c702a9853735eff5c6dd0a3acec763e0723b486dfa'
      ].join('\n');

      expect(canonical).toBe(expectedCanonical);
    });

    it('computes exact HMAC-SHA256 signature matching Revision 8 approved vector', () => {
      const canonical = buildCanonicalAssertionString({
        method: 'POST',
        canonicalPath: '/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit',
        queryParams: '',
        operationScope: 'OP_SUBMIT_DISCLOSURE',
        actorId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        roles: ['Faculty'],
        timestamp: '2026-11-24T10:00:00Z',
        nonce: 'c8f13e7b9a5d4c2e8f1a3b5c7d9e1f3a',
        bodyHash: expectedBodyHash
      });

      const signature = signCanonicalAssertion(canonical, secretHex);
      expect(signature).toBe(expectedSignature);

      const isValid = verifyCanonicalAssertion(canonical, expectedSignature, secretHex);
      expect(isValid).toBe(true);
    });
  });

  describe('Revision 8 GET Test Vector (Disclosure Query with Parameters)', () => {
    const expectedEmptyBodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const expectedSignature = 'a2d530324fdac2a903a95060c95e8af4ba14187603a3ec9d6dff25f85f324927';

    it('computes exact empty string SHA-256 hash', () => {
      const hash = computeSha256('');
      expect(hash).toBe(expectedEmptyBodyHash);
    });

    it('deterministically sorts and canonicalizes query parameters', () => {
      // Input deliberately out of alphabetical order
      const rawQuery = {
        status: 'under_review',
        include: 'evaluations'
      };
      const canonicalQuery = canonicalizeQuery(rawQuery);
      expect(canonicalQuery).toBe('include=evaluations&status=under_review');
    });

    it('lexicographically sorts and canonicalizes actor roles', () => {
      // Input in reverse order: Reviewer, Administrator
      const sortedRoles = canonicalizeRoles(['Reviewer', 'Administrator']);
      expect(sortedRoles).toBe('Administrator,Reviewer');
    });

    it('builds the exact 9-element canonical GET assertion string', () => {
      const canonical = buildCanonicalAssertionString({
        method: 'GET',
        canonicalPath: '/api/v1/disclosures/ipr-202611001',
        queryParams: 'status=under_review&include=evaluations', // Will be canonicalized to include=evaluations&status=under_review
        operationScope: 'OP_VIEW_DISCLOSURE',
        actorId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e',
        roles: ['Reviewer', 'Administrator'], // Will be canonicalized to Administrator,Reviewer
        timestamp: '2026-11-24T10:05:00Z',
        nonce: '1234567890abcdef1234567890abcdef',
        bodyHash: expectedEmptyBodyHash
      });

      const expectedCanonical = [
        'GET',
        '/api/v1/disclosures/ipr-202611001',
        'include=evaluations&status=under_review',
        'OP_VIEW_DISCLOSURE',
        'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e',
        'Administrator,Reviewer',
        '2026-11-24T10:05:00Z',
        '1234567890abcdef1234567890abcdef',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      ].join('\n');

      expect(canonical).toBe(expectedCanonical);
    });

    it('computes exact HMAC-SHA256 signature matching Revision 8 approved GET vector', () => {
      const canonical = [
        'GET',
        '/api/v1/disclosures/ipr-202611001',
        'include=evaluations&status=under_review',
        'OP_VIEW_DISCLOSURE',
        'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e',
        'Administrator,Reviewer',
        '2026-11-24T10:05:00Z',
        '1234567890abcdef1234567890abcdef',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      ].join('\n');

      const signature = signCanonicalAssertion(canonical, secretHex);
      expect(signature).toBe(expectedSignature);

      const isValid = verifyCanonicalAssertion(canonical, expectedSignature, secretHex);
      expect(isValid).toBe(true);
    });
  });

  describe('Mutation Rejection Suite', () => {
    const baseInput = {
      method: 'POST',
      canonicalPath: '/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit',
      queryParams: '',
      operationScope: 'OP_SUBMIT_DISCLOSURE',
      actorId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      roles: ['Faculty'],
      timestamp: '2026-11-24T10:00:00Z',
      nonce: 'c8f13e7b9a5d4c2e8f1a3b5c7d9e1f3a',
      bodyHash: 'ffed0e09ec0b1e3b43f840c702a9853735eff5c6dd0a3acec763e0723b486dfa'
    };

    const originalCanonical = buildCanonicalAssertionString(baseInput);
    const validSignature = signCanonicalAssertion(originalCanonical, secretHex);

    it('rejects tampered body hash', () => {
      const tampered = buildCanonicalAssertionString({
        ...baseInput,
        bodyHash: '0000000000000000000000000000000000000000000000000000000000000000'
      });
      expect(verifyCanonicalAssertion(tampered, validSignature, secretHex)).toBe(false);
    });

    it('rejects tampered HTTP method', () => {
      const tampered = buildCanonicalAssertionString({ ...baseInput, method: 'PUT' });
      expect(verifyCanonicalAssertion(tampered, validSignature, secretHex)).toBe(false);
    });

    it('rejects tampered path', () => {
      const tampered = buildCanonicalAssertionString({ ...baseInput, canonicalPath: '/api/v1/drafts/other/submit' });
      expect(verifyCanonicalAssertion(tampered, validSignature, secretHex)).toBe(false);
    });

    it('rejects tampered query parameters', () => {
      const tampered = buildCanonicalAssertionString({ ...baseInput, queryParams: 'admin=true' });
      expect(verifyCanonicalAssertion(tampered, validSignature, secretHex)).toBe(false);
    });

    it('rejects tampered operation scope', () => {
      const tampered = buildCanonicalAssertionString({ ...baseInput, operationScope: 'OP_VIEW_DISCLOSURE' });
      expect(verifyCanonicalAssertion(tampered, validSignature, secretHex)).toBe(false);
    });

    it('rejects tampered actor ID', () => {
      const tampered = buildCanonicalAssertionString({ ...baseInput, actorId: '00000000-0000-0000-0000-000000000000' });
      expect(verifyCanonicalAssertion(tampered, validSignature, secretHex)).toBe(false);
    });

    it('rejects tampered roles', () => {
      const tampered = buildCanonicalAssertionString({ ...baseInput, roles: ['Administrator'] });
      expect(verifyCanonicalAssertion(tampered, validSignature, secretHex)).toBe(false);
    });

    it('rejects tampered timestamp', () => {
      const tampered = buildCanonicalAssertionString({ ...baseInput, timestamp: '2026-11-24T10:00:01Z' });
      expect(verifyCanonicalAssertion(tampered, validSignature, secretHex)).toBe(false);
    });

    it('rejects tampered nonce', () => {
      const tampered = buildCanonicalAssertionString({ ...baseInput, nonce: 'tampered_nonce_value' });
      expect(verifyCanonicalAssertion(tampered, validSignature, secretHex)).toBe(false);
    });

    it('rejects tampered signature', () => {
      const tamperedSig = validSignature.slice(0, -2) + '00';
      expect(verifyCanonicalAssertion(originalCanonical, tamperedSig, secretHex)).toBe(false);
    });

    it('rejects invalid timestamp format (with milliseconds or non-UTC)', () => {
      expect(() => canonicalizeTimestamp('2026-11-24T10:00:00.000Z')).toThrow('canonical UTC ISO-8601');
      expect(() => canonicalizeTimestamp('2026-11-24 10:00:00')).toThrow('canonical UTC ISO-8601');
    });

    it('rejects invalid, unknown, or empty role arrays', () => {
      expect(() => canonicalizeRoles([])).toThrow('cannot be empty');
      expect(() => canonicalizeRoles(['RogueRole'])).toThrow('unknown role');
      expect(() => canonicalizeRoles([''])).toThrow('Invalid role');
    });

    it('normalizes path with multiple slashes and resolves accurately', () => {
      expect(canonicalizePath('//api//v1///drafts/')).toBe('/api/v1/drafts');
      expect(canonicalizePath('/')).toBe('/');
    });
  });
});
