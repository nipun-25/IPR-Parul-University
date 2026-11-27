import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import FacultyDashboard from '../src/app/faculty/dashboard/page';
import FacultyDisclosuresPage from '../src/app/faculty/disclosures/page';
import FacultyCreateDisclosurePage from '../src/app/faculty/create/page';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pushMock = vi.fn();
const mockRouter = {
  push: pushMock,
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn()
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: 'mock-disclosure-id' })
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('Faculty Portal Integration Tests', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

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

  it('Faculty Dashboard renders in UI Preview Mode when unauthenticated', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error / unauthenticated'));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<FacultyDashboard />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(container.textContent).toContain('Faculty Research & Innovation Portal');
    expect(container.textContent).toContain('UI Preview');
    expect(container.textContent).toContain('Dr. Ramesh Patel');
  });

  it('Faculty Dashboard renders live disclosures when authenticated session exists', async () => {
    const mockFacultyUser = {
      id: 'fac-1111-2222-3333-4444',
      email: 'dr.ramesh.patel@paruluniversity.ac.in',
      fullName: 'Dr. Ramesh Patel',
      activeRoles: ['Faculty'],
      isActive: true
    };

    const mockLiveDisclosures = [
      {
        id: 'disc-fac-001',
        trackingNumber: 'PU-IPR-2026-0088',
        title: 'Nanomaterial Solid-State Battery Electrolyte',
        status: 'SUBMITTED',
        primaryInventorId: mockFacultyUser.id,
        assignedReviewerId: null,
        reviewStatus: 'UNASSIGNED',
        legalClearanceStatus: 'PENDING',
        createdAt: '2026-11-27T10:00:00.000Z',
        updatedAt: '2026-11-27T10:00:00.000Z'
      }
    ];

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/auth/session')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            authenticated: true,
            user: mockFacultyUser,
            csrfToken: 'faculty-csrf-test-token'
          })
        };
      }
      if (url.includes('/api/bff/disclosures')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            disclosures: mockLiveDisclosures
          })
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<FacultyDashboard />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(container.textContent).toContain('Faculty Research & Innovation Portal');
    expect(container.textContent).toContain('Dr. Ramesh Patel');
    expect(container.textContent).toContain('Nanomaterial Solid-State Battery Electrolyte');
    expect(container.textContent).toContain('PU-IPR-2026-0088');
    expect(container.textContent).toContain('SUBMITTED');
  });

  it('Faculty Disclosures Page renders and filters disclosures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('unauthenticated'));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<FacultyDisclosuresPage />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(container.textContent).toContain('My Research Disclosures');
    expect(container.textContent).toContain('Tracking No.');
    expect(container.textContent).toContain('Research Invention Title');
  });

  it('Faculty Create Disclosure Page handles form submission to /api/bff/drafts', async () => {
    let draftRequestBody: string | null = null;
    const fetchMock = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/auth/session')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            authenticated: true,
            user: { fullName: 'Dr. Ramesh Patel', email: 'dr.ramesh.patel@paruluniversity.ac.in', activeRoles: ['Faculty'] },
            csrfToken: 'test-csrf-123'
          })
        };
      }
      if (url.includes('/api/bff/drafts')) {
        draftRequestBody = opts?.body as string;
        return {
          ok: true,
          status: 201,
          json: async () => ({ success: true, id: 'new-draft-id-123' })
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<FacultyCreateDisclosurePage />);
    });

    await act(async () => {
      await flushPromises();
    });

    // Fill in required form inputs
    const inputs = container.querySelectorAll('input');
    const textareas = container.querySelectorAll('textarea');
    const form = container.querySelector('form');

    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect(textareas.length).toBeGreaterThanOrEqual(2);
    expect(form).not.toBeNull();

    function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      (element as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    await act(async () => {
      // Title
      setNativeValue(inputs[0], 'Advanced Perovskite Tandem Solar Cell Architecture');
      // Field
      setNativeValue(inputs[1], 'Photovoltaics & Materials Science');
      // Abstract
      setNativeValue(textareas[0], 'High efficiency 32% tandem solar cell using graded bandgap.');
      // Detailed Description
      setNativeValue(textareas[1], 'Fabrication steps including atomic layer deposition of passivating oxide layers.');
    });

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(draftRequestBody).not.toBeNull();
    const parsed = JSON.parse(draftRequestBody || '{}');
    expect(parsed.title).toBe('Advanced Perovskite Tandem Solar Cell Architecture');
    expect(parsed.pidcsData.fieldOfInvention).toBe('Photovoltaics & Materials Science');
    expect(parsed.pidcsData.abstract).toBe('High efficiency 32% tandem solar cell using graded bandgap.');
  });
});
