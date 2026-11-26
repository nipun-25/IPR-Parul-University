import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { generateCsrfToken } from '@ipr/shared';
import { BffForwarder } from '../src/server/bff-client/bff-forwarder';
import { MockTestSessionProvider } from '../src/server/session/mock-session-provider';

describe('Next.js BFF Security Boundary & Forwarder (Gate A2)', () => {
  const secretHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const csrfSecret = 'test_csrf_secret_for_frontend_unit_tests_123456';
  const mockSession = {
    actorId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    roles: ['Faculty' as const],
    sessionId: 'sess_123456789_faculty',
    expiresAt: new Date(Date.now() + 3600 * 1000)
  };

  let sessionProvider: MockTestSessionProvider;
  let forwarder: BffForwarder;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionProvider = new MockTestSessionProvider(mockSession);
    forwarder = new BffForwarder({
      backendOrigin: 'http://localhost:4000',
      sharedSecretHex: secretHex,
      csrfSecret,
      sessionProvider
    });

    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, backendReceived: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests (401 Unauthorized)', async () => {
    sessionProvider.setMockSession(null); // No active session

    const req = new Request('http://localhost:3000/api/bff/disclosures/ipr-001', {
      method: 'GET'
    });

    const res = await forwarder.forwardRequest(req, '/disclosures/ipr-001');
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.code).toBe('UNAUTHENTICATED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts authenticated GET request without requiring CSRF token', async () => {
    const req = new Request('http://localhost:3000/api/bff/disclosures/ipr-001?status=under_review', {
      method: 'GET'
    });

    const res = await forwarder.forwardRequest(req, '/disclosures/ipr-001');
    expect(res.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('http://localhost:4000/api/v1/disclosures/ipr-001?status=under_review');
    expect(calledInit.headers['X-BFF-Operation-Scope']).toBe('OP_VIEW_DISCLOSURE');
    expect(calledInit.headers['X-BFF-Actor-ID']).toBe(mockSession.actorId);
    expect(calledInit.headers['X-BFF-Signature']).toBeDefined();
  });

  it('rejects state-changing POST request when CSRF token is missing (403 Forbidden)', async () => {
    const req = new Request('http://localhost:3000/api/bff/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'submission' })
    });

    const res = await forwarder.forwardRequest(req, '/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit');
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe('CSRF_TOKEN_INVALID');
    expect(body.detail).toContain('CSRF token missing');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects state-changing POST request with invalid CSRF token (403 Forbidden)', async () => {
    const req = new Request('http://localhost:3000/api/bff/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'invalid.csrf_token_string'
      },
      body: JSON.stringify({ note: 'submission' })
    });

    const res = await forwarder.forwardRequest(req, '/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit');
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe('CSRF_TOKEN_INVALID');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects CSRF token issued for a different session (session mismatch prevention)', async () => {
    const differentSessionId = 'other_user_session_456';
    const foreignCsrfToken = generateCsrfToken(differentSessionId, csrfSecret);

    const req = new Request('http://localhost:3000/api/bff/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': foreignCsrfToken
      },
      body: JSON.stringify({ note: 'submission' })
    });

    const res = await forwarder.forwardRequest(req, '/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit');
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts valid state-changing POST request with valid session-bound CSRF token', async () => {
    const validCsrfToken = generateCsrfToken(mockSession.sessionId, csrfSecret);

    const req = new Request('http://localhost:3000/api/bff/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': validCsrfToken
      },
      body: JSON.stringify({ clientChecksum: 'test_checksum_123' })
    });

    const res = await forwarder.forwardRequest(req, '/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit');
    expect(res.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('http://localhost:4000/api/v1/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit');
    expect(calledInit.headers['X-BFF-Operation-Scope']).toBe('OP_SUBMIT_DISCLOSURE');
    expect(calledInit.headers['X-BFF-Actor-ID']).toBe(mockSession.actorId);
  });

  it('strips client-supplied internal security headers and prevents privilege spoofing', async () => {
    const validCsrfToken = generateCsrfToken(mockSession.sessionId, csrfSecret);

    const req = new Request('http://localhost:3000/api/bff/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': validCsrfToken,
        // Browser client maliciously supplies internal headers attempting privilege escalation
        'X-BFF-Actor-ID': 'malicious_impersonated_admin_uuid',
        'X-BFF-Roles': 'Administrator',
        'X-BFF-Signature': 'fake_signature_attempt'
      },
      body: JSON.stringify({ note: 'spoof attempt' })
    });

    const res = await forwarder.forwardRequest(req, '/drafts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/submit');
    expect(res.status).toBe(200);

    const [, calledInit] = fetchMock.mock.calls[0];
    // Must contain authentic session values, NOT the browser-supplied values!
    expect(calledInit.headers['X-BFF-Actor-ID']).toBe(mockSession.actorId);
    expect(calledInit.headers['X-BFF-Roles']).toBe('Faculty');
    expect(calledInit.headers['X-BFF-Signature']).not.toBe('fake_signature_attempt');
  });

  it('rejects path traversal attempts (400 Bad Request)', async () => {
    const req = new Request('http://localhost:3000/api/bff/../../admin', {
      method: 'GET'
    });

    const res = await forwarder.forwardRequest(req, '../../admin');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('BFF_INVALID_PATH');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects arbitrary unwhitelisted routes (anti-open-proxy behavior)', async () => {
    const req = new Request('http://localhost:3000/api/bff/internal/debug-console', {
      method: 'GET'
    });

    const res = await forwarder.forwardRequest(req, '/internal/debug-console');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe('BFF_ROUTE_UNAUTHORIZED');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
