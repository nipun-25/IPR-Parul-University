import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import StudentDashboardPage from '../src/app/dashboard/page';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pushMock = vi.fn();
const mockRouter = {
  push: pushMock,
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn()
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('Stage 2G — Student Dashboard Component', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  const mockCsrfToken = 'mock-csrf-token-123456';

  beforeEach(() => {
    pushMock.mockClear();
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

  it('redirects to /login if actor session is unauthenticated', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ authenticated: false })
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<StudentDashboardPage />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  it('loads student session and renders disclosures list', async () => {
    const mockUser = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'student.ipr@paruluniversity.ac.in',
      fullName: 'Rahul Patel',
      activeRoles: ['Student']
    };

    const mockDisclosures = [
      {
        id: 'd1111111-2222-3333-4444-555555555555',
        trackingNumber: 'IPR-202611001-A1Z',
        title: 'Smart AgTech Sensor System',
        status: 'SUBMITTED',
        primaryInventorId: mockUser.id,
        assignedReviewerId: null,
        reviewStatus: 'NOT_ASSIGNED',
        legalClearanceStatus: 'NOT_CLEARED',
        createdAt: '2026-11-26T10:00:00.000Z',
        updatedAt: '2026-11-26T11:00:00.000Z'
      },
      {
        id: 'd2222222-2222-3333-4444-555555555555',
        trackingNumber: null,
        title: 'Solar Cell Efficiency Improvement',
        status: 'DRAFT',
        primaryInventorId: mockUser.id,
        assignedReviewerId: null,
        reviewStatus: 'NOT_ASSIGNED',
        legalClearanceStatus: 'NOT_CLEARED',
        createdAt: '2026-11-26T12:00:00.000Z',
        updatedAt: '2026-11-26T12:00:00.000Z'
      }
    ];

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/auth/session')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            authenticated: true,
            user: mockUser,
            csrfToken: mockCsrfToken
          })
        };
      }
      if (url.includes('/api/bff/disclosures')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            disclosures: mockDisclosures
          })
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<StudentDashboardPage />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(container.textContent).toContain('Rahul Patel');
    expect(container.textContent).toContain('student.ipr@paruluniversity.ac.in');
    expect(container.textContent).toContain('Smart AgTech Sensor System');
    expect(container.textContent).toContain('Solar Cell Efficiency Improvement');
    expect(container.textContent).toContain('IPR-202611001-A1Z');
    expect(container.textContent).toContain('SUBMITTED');
    expect(container.textContent).toContain('DRAFT');
  });

  it('creates new draft disclosure and redirects to disclosure workspace', async () => {
    const mockUser = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'student.ipr@paruluniversity.ac.in',
      fullName: 'Rahul Patel',
      activeRoles: ['Student']
    };

    const newDraftId = 'd3333333-3333-3333-3333-333333333333';

    const fetchMock = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/auth/session')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            authenticated: true,
            user: mockUser,
            csrfToken: mockCsrfToken
          })
        };
      }
      if (url.includes('/api/bff/disclosures')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ disclosures: [] })
        };
      }
      if (url.includes('/api/bff/drafts') && opts?.method === 'POST') {
        const body = JSON.parse(opts.body as string);
        expect(body.title).toBe('Autonomous Drone Navigation');
        expect(opts.headers).toHaveProperty('X-CSRF-Token', mockCsrfToken);
        return {
          ok: true,
          status: 201,
          json: async () => ({ success: true, draftId: newDraftId })
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<StudentDashboardPage />);
    });

    await act(async () => {
      await flushPromises();
    });

    // Open creation modal
    const createBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('New Disclosure Draft')
    );
    expect(createBtn).not.toBeUndefined();

    await act(async () => {
      createBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Fill title
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    await act(async () => {
      input.value = 'Autonomous Drone Navigation';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      (input as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Submit form
    const form = container.querySelector('form');
    expect(form).not.toBeNull();

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await act(async () => {
      await flushPromises();
    });

    expect(pushMock).toHaveBeenCalledWith(`/disclosures/${newDraftId}`);
  });
});
