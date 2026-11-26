import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DisclosureWorkspacePage from '../src/app/disclosures/[id]/page';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pushMock = vi.fn();
const mockDisclosureId = 'd1111111-2222-3333-4444-555555555555';

const mockRouter = {
  push: pushMock,
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn()
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: mockDisclosureId })
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 25));

describe('Stage 2G — Student Disclosure Workspace Component', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  const mockCsrfToken = 'mock-csrf-token-disclosure-workspace-999';

  const mockUser = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'student.ipr@paruluniversity.ac.in',
    fullName: 'Rahul Patel',
    activeRoles: ['Student']
  };

  const draftDisclosure = {
    id: mockDisclosureId,
    trackingNumber: null,
    title: 'Smart AgTech Sensor System',
    status: 'DRAFT',
    primaryInventorId: mockUser.id,
    assignedReviewerId: null,
    reviewStatus: 'NOT_ASSIGNED',
    legalClearanceStatus: 'NOT_CLEARED',
    pidcsData: {
      fieldOfInvention: 'Agricultural IoT',
      abstract: 'Autonomous soil moisture optimization system',
      detailedDescription: 'Full sensor array schematics and microcontroller code',
      commercialPotential: 'Precision agriculture market',
      priorArtDetails: 'Existing manual soil probe systems'
    },
    submissionTimestamp: null,
    createdAt: '2026-11-26T10:00:00.000Z',
    updatedAt: '2026-11-26T10:00:00.000Z'
  };

  const sampleConsents = [
    {
      id: 'c1111111-1111-1111-1111-111111111111',
      disclosureId: mockDisclosureId,
      userId: mockUser.id,
      isExternal: false,
      externalName: null,
      externalEmail: null,
      externalOrganization: null,
      shareBasisPoints: 5000,
      status: 'VERIFIED',
      signatureEvidenceId: null,
      createdAt: '2026-11-26T10:00:00.000Z'
    },
    {
      id: 'c2222222-2222-2222-2222-222222222222',
      disclosureId: mockDisclosureId,
      userId: null,
      isExternal: true,
      externalName: 'Dr. Jane Smith',
      externalEmail: 'jane.smith@external-lab.org',
      externalOrganization: 'National Lab',
      shareBasisPoints: 5000,
      status: 'VERIFIED',
      signatureEvidenceId: null,
      createdAt: '2026-11-26T10:00:00.000Z'
    }
  ];

  const sampleAttachments = [
    {
      id: 'a1111111-1111-1111-1111-111111111111',
      disclosureId: mockDisclosureId,
      fileName: 'specifications.pdf',
      fileSizeBytes: 204800,
      mimeType: 'application/pdf',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      scanStatus: 'CLEAN',
      createdAt: '2026-11-26T10:00:00.000Z'
    }
  ];

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

  it('renders workspace with loaded disclosure details and PIDCS fields', async () => {
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
      if (url.includes(`/api/bff/disclosures/${mockDisclosureId}/consents`)) {
        return { ok: true, status: 200, json: async () => ({ consents: sampleConsents }) };
      }
      if (url.includes(`/api/bff/disclosures/${mockDisclosureId}/attachments`)) {
        return { ok: true, status: 200, json: async () => ({ attachments: sampleAttachments }) };
      }
      if (url.includes(`/api/bff/disclosures/${mockDisclosureId}`)) {
        return { ok: true, status: 200, json: async () => ({ disclosure: draftDisclosure }) };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<DisclosureWorkspacePage />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(container.textContent).toContain('Smart AgTech Sensor System');
    expect(container.textContent).toContain('DRAFT (UNSUBMITTED)');

    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(titleInput).not.toBeNull();
    expect(titleInput.value).toBe('Smart AgTech Sensor System');

    const textareas = container.querySelectorAll('textarea');
    expect(textareas.length).toBeGreaterThanOrEqual(3);
  });

  it('saves draft changes to PIDCS data with CSRF protection', async () => {
    let patchedBody: unknown = null;
    let csrfSent: string | null = null;

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
      if (url.includes(`/api/bff/disclosures/${mockDisclosureId}/consents`)) {
        return { ok: true, status: 200, json: async () => ({ consents: sampleConsents }) };
      }
      if (url.includes(`/api/bff/disclosures/${mockDisclosureId}/attachments`)) {
        return { ok: true, status: 200, json: async () => ({ attachments: sampleAttachments }) };
      }
      if (url.includes(`/api/bff/drafts/${mockDisclosureId}`) && opts?.method === 'PATCH') {
        patchedBody = JSON.parse(opts.body as string);
        csrfSent = (opts.headers as Record<string, string>)['X-CSRF-Token'];
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, message: 'Draft disclosure updated successfully' })
        };
      }
      if (url.includes(`/api/bff/disclosures/${mockDisclosureId}`)) {
        return { ok: true, status: 200, json: async () => ({ disclosure: draftDisclosure }) };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<DisclosureWorkspacePage />);
    });

    await act(async () => {
      await flushPromises();
    });

    const form = container.querySelector('form');
    expect(form).not.toBeNull();

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await act(async () => {
      await flushPromises();
    });

    expect(csrfSent).toBe(mockCsrfToken);
    expect((patchedBody as { title: string })?.title).toBe('Smart AgTech Sensor System');
    expect(container.textContent).toContain('Invention details and PIDCS data updated successfully.');
  });

  it('submits disclosure when checklist is met and displays generated tracking number', async () => {
    const generatedTrackingNumber = 'IPR-202611001-A9Z';
    let submitCalled = false;

    // Mock confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);

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
      if (url.includes(`/api/bff/disclosures/${mockDisclosureId}/consents`)) {
        return { ok: true, status: 200, json: async () => ({ consents: sampleConsents }) };
      }
      if (url.includes(`/api/bff/disclosures/${mockDisclosureId}/attachments`)) {
        return { ok: true, status: 200, json: async () => ({ attachments: sampleAttachments }) };
      }
      if (url.includes(`/api/bff/drafts/${mockDisclosureId}/submit`) && opts?.method === 'POST') {
        submitCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            trackingNumber: generatedTrackingNumber
          })
        };
      }
      if (url.includes(`/api/bff/disclosures/${mockDisclosureId}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            disclosure: submitCalled
              ? { ...draftDisclosure, status: 'SUBMITTED', trackingNumber: generatedTrackingNumber }
              : draftDisclosure
          })
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<DisclosureWorkspacePage />);
    });

    await act(async () => {
      await flushPromises();
    });

    // Switch to Submission tab
    const submitTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('4. Submission & Tracking')
    );
    expect(submitTabBtn).not.toBeUndefined();

    await act(async () => {
      submitTabBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Check checklist items satisfied (10,000 bps, consents verified, spec attachment clean)
    expect(container.textContent).toContain('Final Pre-Submission Checklist');
    expect(container.textContent).toContain('Satisfied');

    // Click submit button
    const submitButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Submit Invention Disclosure')
    );
    expect(submitButton).not.toBeUndefined();
    expect(submitButton?.disabled).toBe(false);

    await act(async () => {
      submitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      await flushPromises();
    });

    expect(submitCalled).toBe(true);
    expect(container.textContent).toContain(generatedTrackingNumber);
    expect(container.textContent).toContain('Invention Disclosure Successfully Submitted');
  });

  it('renders locked read-only state for SUBMITTED disclosure', async () => {
    const submittedDisclosure = {
      ...draftDisclosure,
      status: 'SUBMITTED',
      trackingNumber: 'IPR-202611001-A9Z'
    };

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
      if (url.includes(`/api/bff/disclosures/${mockDisclosureId}/consents`)) {
        return { ok: true, status: 200, json: async () => ({ consents: sampleConsents }) };
      }
      if (url.includes(`/api/bff/disclosures/${mockDisclosureId}/attachments`)) {
        return { ok: true, status: 200, json: async () => ({ attachments: sampleAttachments }) };
      }
      if (url.includes(`/api/bff/disclosures/${mockDisclosureId}`)) {
        return { ok: true, status: 200, json: async () => ({ disclosure: submittedDisclosure }) };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root = createRoot(container);
      root.render(<DisclosureWorkspacePage />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(container.textContent).toContain('SUBMITTED');
    expect(container.textContent).toContain('IPR-202611001-A9Z');
    expect(container.textContent).toContain('Disclosure Locked');

    // Input fields should be disabled
    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(titleInput?.disabled).toBe(true);
  });
});
