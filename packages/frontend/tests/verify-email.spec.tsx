import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import VerifyEmailPage from '../src/app/verify-email/page';
import {
  extractAndScrubVerificationToken,
  consumeVerificationToken,
  PRE_HYDRATION_TOKEN_SCRUBBER_SCRIPT
} from '../src/utils/token-scrubber';

// Mark environment for React act support
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Stage 2F.2C — Pre-Auth CSRF & Component Verification', () => {
  const validHexToken = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0';
  const mockCsrfToken = 'mock-csrf-salt.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    delete window.__PU_VERIFY_TOKEN__;
    window.location.hash = '';
    window.location.pathname = '/verify-email';
    localStorage.clear();
    sessionStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    vi.restoreAllMocks();
  });

  describe('1. Fragment Extraction & URL Scrubbing Utility', () => {
    it('successfully extracts a 64-hex token from the URL fragment (#token=...) and scrubs the URL', () => {
      const mockReplaceState = vi.fn();
      const hash = `#token=${validHexToken}`;

      const extracted = extractAndScrubVerificationToken(
        hash,
        mockReplaceState,
        '/verify-email'
      );

      expect(extracted).toBe(validHexToken);
      expect(mockReplaceState).toHaveBeenCalledTimes(1);
      expect(mockReplaceState).toHaveBeenCalledWith(null, '', '/verify-email');
    });

    it('rejects query parameter URLs (?token=...) as fragment extractor target', () => {
      const mockReplaceState = vi.fn();
      const queryOnly = '';

      const extracted = extractAndScrubVerificationToken(
        queryOnly,
        mockReplaceState,
        '/verify-email'
      );

      expect(extracted).toBeNull();
      expect(mockReplaceState).not.toHaveBeenCalled();
    });

    it('scrubs the fragment even if the token format is invalid to prevent lingering malformed data', () => {
      const mockReplaceState = vi.fn();
      const invalidHash = '#token=not-a-valid-token';

      const extracted = extractAndScrubVerificationToken(
        invalidHash,
        mockReplaceState,
        '/verify-email'
      );

      expect(extracted).toBeNull();
      expect(mockReplaceState).toHaveBeenCalledTimes(1);
      expect(mockReplaceState).toHaveBeenCalledWith(null, '', '/verify-email');
    });

    it('rejects non-hex characters in tokens', () => {
      const mockReplaceState = vi.fn();
      const nonHexToken = 'z'.repeat(64);
      const hash = `#token=${nonHexToken}`;

      const extracted = extractAndScrubVerificationToken(
        hash,
        mockReplaceState,
        '/verify-email'
      );

      expect(extracted).toBeNull();
      expect(mockReplaceState).toHaveBeenCalledTimes(1);
    });

    it('rejects tokens with invalid length (< 64 or > 64 chars)', () => {
      const mockReplaceState = vi.fn();

      expect(
        extractAndScrubVerificationToken('#token=abc', mockReplaceState, '/verify-email')
      ).toBeNull();

      expect(
        extractAndScrubVerificationToken(`#token=${validHexToken}extra`, mockReplaceState, '/verify-email')
      ).toBeNull();
    });

    it('handles empty or missing fragment without errors', () => {
      const mockReplaceState = vi.fn();

      expect(extractAndScrubVerificationToken('', mockReplaceState, '/verify-email')).toBeNull();
      expect(extractAndScrubVerificationToken('#', mockReplaceState, '/verify-email')).toBeNull();
      expect(extractAndScrubVerificationToken('#other=val', mockReplaceState, '/verify-email')).toBeNull();
      expect(mockReplaceState).not.toHaveBeenCalled();
    });
  });

  describe('2. Synchronous Pre-Hydration Inline Script Execution', () => {
    it('executes in head synchronously, populates window.__PU_VERIFY_TOKEN__, and scrubs history state', () => {
      window.location.hash = `#token=${validHexToken}`;
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

      // Execute synchronous inline script before hydration
      // eslint-disable-next-line no-eval
      eval(PRE_HYDRATION_TOKEN_SCRUBBER_SCRIPT);

      expect(window.__PU_VERIFY_TOKEN__).toBe(validHexToken);
      expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/verify-email');
    });

    it('ignores non-token fragments and does not throw', () => {
      window.location.hash = '#section-2';
      // eslint-disable-next-line no-eval
      eval(PRE_HYDRATION_TOKEN_SCRUBBER_SCRIPT);

      expect(window.__PU_VERIFY_TOKEN__).toBeUndefined();
    });
  });

  describe('3. Exactly-Once In-Memory Token Consumption', () => {
    it('consumes token exactly once and deletes in-memory variable', () => {
      window.__PU_VERIFY_TOKEN__ = validHexToken;

      const firstConsumption = consumeVerificationToken();
      expect(firstConsumption).toBe(validHexToken);
      expect(window.__PU_VERIFY_TOKEN__).toBeUndefined();

      const secondConsumption = consumeVerificationToken();
      expect(secondConsumption).toBeNull();
    });

    it('rejects invalid hex characters stored in pre-hydration memory', () => {
      window.__PU_VERIFY_TOKEN__ = 'z'.repeat(64);

      const consumed = consumeVerificationToken();
      expect(consumed).toBeNull();
      expect(window.__PU_VERIFY_TOKEN__).toBeUndefined();
    });
  });

  describe('4. VerifyEmailPage Component Tests with CSRF Protection', () => {
    function setupMockFetch(verifyResponse: () => Promise<Response> | Response) {
      return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/v1/auth/csrf')) {
          expect(options?.credentials).toBe('include');
          return Promise.resolve(
            new Response(JSON.stringify({ csrfToken: mockCsrfToken }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          );
        }
        if (url.includes('/api/v1/auth/verify-email')) {
          expect(options?.credentials).toBe('include');
          const headers = options?.headers as Record<string, string>;
          expect(headers['X-CSRF-Token']).toBe(mockCsrfToken);
          expect(headers['Content-Type']).toBe('application/json');
          return Promise.resolve(verifyResponse());
        }
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      });
    }

    it('renders successful verification UI when backend returns 200 and never exposes tokens in DOM or storage', async () => {
      window.__PU_VERIFY_TOKEN__ = validHexToken;

      const mockFetch = setupMockFetch(() =>
        new Response(
          JSON.stringify({
            success: true,
            message: 'Email verified successfully. Your student account is now active.',
            userId: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      vi.stubGlobal('fetch', mockFetch);

      await act(async () => {
        root = createRoot(container);
        root.render(<VerifyEmailPage />);
      });

      // Flush microtasks
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2); // 1: GET /csrf, 2: POST /verify-email

      // Verify POST call details
      const [postUrl, postOptions] = mockFetch.mock.calls[1];
      expect(postUrl).toContain('/api/v1/auth/verify-email');
      expect(postOptions.method).toBe('POST');
      expect(JSON.parse(postOptions.body)).toEqual({ token: validHexToken });

      // UI assertions
      expect(container.textContent).toContain('Email verified successfully. Your student account is now active.');
      expect(container.textContent).toContain('You may now proceed to log in.');

      // Non-exposure assertions: raw token and CSRF token must NEVER appear in rendered DOM
      expect(container.innerHTML).not.toContain(validHexToken);
      expect(container.textContent).not.toContain(validHexToken);
      expect(container.innerHTML).not.toContain(mockCsrfToken);

      // Storage assertions: tokens must NEVER be stored in persistent browser storage
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('csrfToken')).toBeNull();
      expect(sessionStorage.getItem('token')).toBeNull();
      expect(sessionStorage.getItem('csrfToken')).toBeNull();
    });

    it('renders error UI when token is invalid or expired (HTTP 400)', async () => {
      window.__PU_VERIFY_TOKEN__ = validHexToken;

      const mockFetch = setupMockFetch(() =>
        new Response(
          JSON.stringify({
            code: 'INVALID_VERIFICATION_TOKEN',
            detail: 'The verification token is invalid, expired, or has already been used.'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );
      vi.stubGlobal('fetch', mockFetch);

      await act(async () => {
        root = createRoot(container);
        root.render(<VerifyEmailPage />);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(container.textContent).toContain('The verification token is invalid, expired, or has already been used.');
      expect(container.innerHTML).not.toContain(validHexToken);
    });

    it('renders error UI on network failure and never exposes token in DOM', async () => {
      window.__PU_VERIFY_TOKEN__ = validHexToken;

      const mockFetch = setupMockFetch(() => {
        throw new Error('Network offline');
      });
      vi.stubGlobal('fetch', mockFetch);

      await act(async () => {
        root = createRoot(container);
        root.render(<VerifyEmailPage />);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(container.textContent).toContain('Network error. Unable to verify token at this time. Please try again.');
      expect(container.innerHTML).not.toContain(validHexToken);
    });

    it('renders error UI when CSRF bootstrap fails', async () => {
      window.__PU_VERIFY_TOKEN__ = validHexToken;

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/auth/csrf')) {
          return Promise.resolve(new Response(JSON.stringify({ error: 'failed' }), { status: 500 }));
        }
        return Promise.reject(new Error('Should not reach here'));
      });
      vi.stubGlobal('fetch', mockFetch);

      await act(async () => {
        root = createRoot(container);
        root.render(<VerifyEmailPage />);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockFetch).toHaveBeenCalledTimes(1); // Only CSRF was attempted
      expect(container.textContent).toContain('Security initialization failed. Please reload and try again.');
    });

    it('renders error UI without calling backend when token is missing or malformed', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await act(async () => {
        root = createRoot(container);
        root.render(<VerifyEmailPage />);
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Invalid or missing verification token. Please check your institutional email link.');
    });

    it('prevents duplicate network submissions on repeated renders', async () => {
      window.__PU_VERIFY_TOKEN__ = validHexToken;

      const mockFetch = setupMockFetch(() =>
        new Response(
          JSON.stringify({ success: true, message: 'Verified' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      vi.stubGlobal('fetch', mockFetch);

      await act(async () => {
        root = createRoot(container);
        root.render(<VerifyEmailPage />);
      });

      // Subsequent re-render
      await act(async () => {
        root?.render(<VerifyEmailPage />);
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Total calls must still be exactly 2: 1 for /csrf, 1 for /verify-email
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
