import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import LoginPage from '../src/app/login/page';

// Mark environment for React act support
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Stage 2F.3 — Frontend Login Component', () => {
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

  it('renders email input, password input, and login submit button', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<LoginPage />);
    });

    const emailInput = container.querySelector('[data-testid="email-input"]') as HTMLInputElement;
    const passwordInput = container.querySelector('[data-testid="password-input"]') as HTMLInputElement;
    const submitBtn = container.querySelector('[data-testid="submit-button"]') as HTMLButtonElement;

    expect(emailInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
    expect(submitBtn).not.toBeNull();
    expect(submitBtn.textContent).toBe('Log In');
  });

  it('shows client-side validation error when submitting non-institutional email', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<LoginPage />);
    });

    const emailInput = container.querySelector('[data-testid="email-input"]') as HTMLInputElement;
    const passwordInput = container.querySelector('[data-testid="password-input"]') as HTMLInputElement;
    const form = container.querySelector('[data-testid="login-form"]') as HTMLFormElement;

    await act(async () => {
      emailInput.value = 'user@gmail.com';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      (emailInput as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      passwordInput.value = 'Password123!';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      (passwordInput as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const errorEl = container.querySelector('[data-testid="status-error"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('@paruluniversity.ac.in');
  });

  it('successfully boots CSRF, logs in, and displays user profile and active roles', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ csrfToken: mockCsrfToken })
        };
      }
      if (url.includes('/api/v1/auth/login')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            user: {
              id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
              email: 'student.test@paruluniversity.ac.in',
              fullName: 'Jane Doe',
              activeRoles: ['Student']
            },
            csrfToken: 'session-bound-csrf-token-123'
          })
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<LoginPage />);
    });

    const emailInput = container.querySelector('[data-testid="email-input"]') as HTMLInputElement;
    const passwordInput = container.querySelector('[data-testid="password-input"]') as HTMLInputElement;
    const form = container.querySelector('[data-testid="login-form"]') as HTMLFormElement;

    await act(async () => {
      emailInput.value = 'student.test@paruluniversity.ac.in';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      (emailInput as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      passwordInput.value = 'ValidPass123!';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      (passwordInput as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    // CSRF bootstrap call
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/auth/csrf');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');

    // Login call
    expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/auth/login');
    expect(fetchMock.mock.calls[1][1].credentials).toBe('include');
    expect(fetchMock.mock.calls[1][1].headers['X-CSRF-Token']).toBe(mockCsrfToken);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      email: 'student.test@paruluniversity.ac.in',
      password: 'ValidPass123!'
    });

    const successEl = container.querySelector('[data-testid="login-success"]');
    expect(successEl).not.toBeNull();
    expect(successEl?.textContent).toContain('Welcome back, Jane Doe!');
    expect(successEl?.textContent).toContain('Active Roles: Student');
  });

  it('displays generic invalid credentials on 401 error', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ csrfToken: mockCsrfToken })
        };
      }
      if (url.includes('/api/v1/auth/login')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            code: 'INVALID_CREDENTIALS',
            detail: 'Invalid institutional email or password.'
          })
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<LoginPage />);
    });

    const emailInput = container.querySelector('[data-testid="email-input"]') as HTMLInputElement;
    const passwordInput = container.querySelector('[data-testid="password-input"]') as HTMLInputElement;
    const form = container.querySelector('[data-testid="login-form"]') as HTMLFormElement;

    await act(async () => {
      emailInput.value = 'student.test@paruluniversity.ac.in';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      (emailInput as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      passwordInput.value = 'WrongPassword!';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      (passwordInput as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const errorEl = container.querySelector('[data-testid="status-error"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('Invalid institutional email or password');
  });

  it('submits logout with CSRF token and restores idle state', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ csrfToken: mockCsrfToken })
        };
      }
      if (url.includes('/api/v1/auth/login')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            csrfToken: mockCsrfToken,
            user: {
              id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
              email: 'student.test@paruluniversity.ac.in',
              fullName: 'Jane Doe',
              activeRoles: ['Student']
            }
          })
        };
      }
      if (url.includes('/api/v1/auth/logout')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<LoginPage />);
    });

    const emailInput = container.querySelector('[data-testid="email-input"]') as HTMLInputElement;
    const passwordInput = container.querySelector('[data-testid="password-input"]') as HTMLInputElement;
    const form = container.querySelector('[data-testid="login-form"]') as HTMLFormElement;

    await act(async () => {
      emailInput.value = 'student.test@paruluniversity.ac.in';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      (emailInput as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      passwordInput.value = 'ValidPass123!';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      (passwordInput as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const logoutButton = container.querySelector('[data-testid="logout-button"]') as HTMLButtonElement;
    expect(logoutButton).not.toBeNull();

    await act(async () => {
      logoutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const logoutCall = fetchMock.mock.calls[2];
    expect(logoutCall[0]).toContain('/api/v1/auth/logout');
    expect(logoutCall[1].method).toBe('POST');
    expect(logoutCall[1].credentials).toBe('include');
    expect(logoutCall[1].headers['X-CSRF-Token']).toBe(mockCsrfToken);
    expect(logoutCall[1].headers['Content-Type']).toBe('application/json');

    // Idle state restored
    expect(container.querySelector('[data-testid="login-form"]')).not.toBeNull();
  });
});
