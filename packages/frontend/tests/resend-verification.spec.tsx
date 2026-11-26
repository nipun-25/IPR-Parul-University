import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ResendVerificationPage from '../src/app/resend-verification/page';

// Mark environment for React act support
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Stage 2F.2D — Resend Verification Frontend Component', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  const mockCsrfToken = 'mock-csrf-salt.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
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

  it('renders email input and submit button', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<ResendVerificationPage />);
    });

    const emailInput = container.querySelector('[data-testid="email-input"]') as HTMLInputElement;
    const submitBtn = container.querySelector('[data-testid="submit-button"]') as HTMLButtonElement;

    expect(emailInput).not.toBeNull();
    expect(submitBtn).not.toBeNull();
    expect(submitBtn.textContent).toBe('Resend Verification Email');
  });

  it('shows client-side validation error for non-institutional email', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<ResendVerificationPage />);
    });

    const emailInput = container.querySelector('[data-testid="email-input"]') as HTMLInputElement;
    const form = container.querySelector('[data-testid="resend-form"]') as HTMLFormElement;

    await act(async () => {
      // Set invalid email
      const event = new Event('input', { bubbles: true });
      emailInput.value = 'user@gmail.com';
      emailInput.dispatchEvent(event);
      // React controlled input helper
      (emailInput as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const errorEl = container.querySelector('[data-testid="status-error"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('@paruluniversity.ac.in');
  });

  it('successfully boots CSRF in memory, submits valid email, and displays neutral confirmation', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ csrfToken: mockCsrfToken })
        };
      }
      if (url.includes('/api/v1/auth/resend-verification')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            message: 'If an unverified account exists for this email, a verification link has been sent to your institutional inbox.'
          })
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<ResendVerificationPage />);
    });

    const emailInput = container.querySelector('[data-testid="email-input"]') as HTMLInputElement;
    const form = container.querySelector('[data-testid="resend-form"]') as HTMLFormElement;

    await act(async () => {
      emailInput.value = 'student.test@paruluniversity.ac.in';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      (emailInput as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    // CSRF bootstrap call
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/auth/csrf');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');

    // Resend submission call
    expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/auth/resend-verification');
    expect(fetchMock.mock.calls[1][1].credentials).toBe('include');
    expect(fetchMock.mock.calls[1][1].headers['X-CSRF-Token']).toBe(mockCsrfToken);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      email: 'student.test@paruluniversity.ac.in'
    });

    const successEl = container.querySelector('[data-testid="status-success"]');
    expect(successEl).not.toBeNull();
    expect(successEl?.textContent).toContain('verification link has been sent');

    // Never stored in browser storage
    expect(localStorage.getItem('csrfToken')).toBeNull();
    expect(sessionStorage.getItem('csrfToken')).toBeNull();
  });

  it('handles 429 rate limit error gracefully without exposing account existence', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ csrfToken: mockCsrfToken })
        };
      }
      if (url.includes('/api/v1/auth/resend-verification')) {
        return {
          ok: false,
          status: 429,
          json: async () => ({
            code: 'RESEND_COOLDOWN_ACTIVE',
            detail: 'Please wait before requesting another verification email.'
          })
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<ResendVerificationPage />);
    });

    const emailInput = container.querySelector('[data-testid="email-input"]') as HTMLInputElement;
    const form = container.querySelector('[data-testid="resend-form"]') as HTMLFormElement;

    await act(async () => {
      emailInput.value = 'student.cooldown@paruluniversity.ac.in';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      (emailInput as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const errorEl = container.querySelector('[data-testid="status-error"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('Please wait before requesting another verification email');
  });

  it('handles network failure gracefully', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<ResendVerificationPage />);
    });

    const emailInput = container.querySelector('[data-testid="email-input"]') as HTMLInputElement;
    const form = container.querySelector('[data-testid="resend-form"]') as HTMLFormElement;

    await act(async () => {
      emailInput.value = 'student.network@paruluniversity.ac.in';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      (emailInput as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const errorEl = container.querySelector('[data-testid="status-error"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('Network error');
  });
});
