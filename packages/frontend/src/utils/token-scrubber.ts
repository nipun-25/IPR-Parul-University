// Inline script executed synchronously in <head> before React hydration or third-party scripts
export const PRE_HYDRATION_TOKEN_SCRUBBER_SCRIPT = `
(function() {
  try {
    if (typeof window !== 'undefined' && window.location) {
      var hash = window.location.hash || '';
      if (hash.indexOf('token=') !== -1) {
        var rawFragment = hash.charAt(0) === '#' ? hash.slice(1) : hash;
        var params = new URLSearchParams(rawFragment);
        var token = params.get('token');
        if (token) {
          token = token.trim();
          if (/^[a-f0-9]{64}$/i.test(token)) {
            window.__PU_VERIFY_TOKEN__ = token;
          }
        }
        if (window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    }
  } catch (e) {}
})();
`;

declare global {
  interface Window {
    __PU_VERIFY_TOKEN__?: string;
  }
}

/**
 * Extracts verification token from URL fragment hash and immediately
 * scrubs the fragment from browser address bar and history using history.replaceState
 * to prevent token leakage in Referer headers, browser history, or telemetry.
 */
export function extractAndScrubVerificationToken(
  locationHash: string,
  historyReplace?: (data: unknown, unused: string, url?: string | URL | null) => void,
  pathname: string = '/verify-email'
): string | null {
  if (!locationHash || !locationHash.includes('token=')) {
    return null;
  }

  // Parse fragment parameters e.g. #token=abc123...
  const rawFragment = locationHash.startsWith('#') ? locationHash.slice(1) : locationHash;
  const params = new URLSearchParams(rawFragment);
  const token = params.get('token')?.trim() || null;

  // Immediate URL scrubbing: replace history state to purge token from address bar and history
  if (historyReplace) {
    try {
      historyReplace(null, '', pathname);
    } catch {
      // Gracefully handle in non-browser or mock environments
    }
  }

  // Enforce strict 64-hex character validation
  if (token && /^[a-f0-9]{64}$/i.test(token)) {
    return token;
  }

  return null;
}

/**
 * Consumes the verification token exactly once from in-memory pre-hydration storage.
 * If not present in memory, safely falls back to checking location hash and scrubbing it.
 * Preserves 64-character hexadecimal format validation.
 */
export function consumeVerificationToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // 1. Consume from synchronous in-memory pre-hydration cache
  if (window.__PU_VERIFY_TOKEN__) {
    const cachedToken = window.__PU_VERIFY_TOKEN__.trim();
    delete window.__PU_VERIFY_TOKEN__; // Enforce single-use consumption

    if (/^[a-f0-9]{64}$/i.test(cachedToken)) {
      return cachedToken;
    }
    return null;
  }

  // 2. Fallback: extract directly from location.hash and scrub URL
  if (window.location && window.location.hash && window.location.hash.includes('token=')) {
    return extractAndScrubVerificationToken(
      window.location.hash,
      window.history && typeof window.history.replaceState === 'function'
        ? window.history.replaceState.bind(window.history)
        : undefined,
      window.location.pathname || '/verify-email'
    );
  }

  return null;
}
