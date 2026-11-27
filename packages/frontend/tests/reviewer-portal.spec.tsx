import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ReviewerDashboard from '../src/app/reviewer/dashboard/page';
import ReviewerDisclosureDetailPage from '../src/app/reviewer/disclosures/[id]/page';
import ReviewerAssignedPage from '../src/app/reviewer/assigned/page';
import ReviewerClarificationsPage from '../src/app/reviewer/clarifications/page';
import ReviewerEvaluationPage from '../src/app/reviewer/evaluation/page';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pushMock = vi.fn();
const mockRouter = {
  push: pushMock,
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn()
};

let currentRouteId = 'disc-rev-001';

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: currentRouteId }),
  useSearchParams: () => new URLSearchParams()
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 30));

describe('Reviewer Portal Integration Tests', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    pushMock.mockClear();
    currentRouteId = 'disc-rev-001';
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

  describe('Reviewer Dashboard (/reviewer/dashboard)', () => {
    it('renders in UI Preview Mode when unauthenticated', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Unauthenticated'));
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<ReviewerDashboard />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('IPR Technical Reviewer Workspace');
      expect(container.textContent).toContain('UI Preview Mode');
      expect(container.textContent).toContain('PREVIEW');
    });

    it('renders live assigned disclosures when Reviewer session is active', async () => {
      const mockReviewerUser = {
        id: 'rev-1111-2222-3333-4444',
        email: 'reviewer@paruluniversity.ac.in',
        fullName: 'Prof. Vikramaditya Joshi',
        activeRoles: ['Reviewer'],
        isActive: true
      };

      const mockLiveDisclosures = [
        {
          id: 'disc-rev-001',
          trackingNumber: 'PU-IPR-2026-0042',
          title: 'Autonomous Drone Navigation for Precision Agriculture',
          status: 'SUBMITTED',
          primaryInventorId: 'inv-9999-8888-7777-6666',
          assignedReviewerId: mockReviewerUser.id,
          reviewStatus: 'ASSIGNED',
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
              user: mockReviewerUser,
              csrfToken: 'rev-csrf-token'
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
        root.render(<ReviewerDashboard />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Live Reviewer Queue Connected');
      expect(container.textContent).toContain('LIVE DATA');
      expect(container.textContent).toContain('Autonomous Drone Navigation');
      expect(container.textContent).toContain('PU-IPR-2026-0042');
      expect(container.textContent).toContain('Review: ASSIGNED');
    });

    it('displays empty state when reviewer has zero assigned disclosures', async () => {
      const mockReviewerUser = {
        id: 'rev-1111-2222-3333-4444',
        email: 'reviewer@paruluniversity.ac.in',
        fullName: 'Prof. Vikramaditya Joshi',
        activeRoles: ['Reviewer'],
        isActive: true
      };

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              authenticated: true,
              user: mockReviewerUser,
              csrfToken: 'rev-csrf-token'
            })
          };
        }
        if (url.includes('/api/bff/disclosures')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              disclosures: []
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<ReviewerDashboard />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('No Disclosures Assigned');
      expect(container.textContent).toContain('currently have no invention disclosures assigned');
    });
  });

  describe('Reviewer Disclosure Detail & Evaluation (/reviewer/disclosures/[id])', () => {
    it('renders live disclosure details with read-only specification for assigned reviewer', async () => {
      const mockReviewerUser = {
        id: 'rev-1111-2222-3333-4444',
        email: 'reviewer@paruluniversity.ac.in',
        fullName: 'Prof. Vikramaditya Joshi',
        activeRoles: ['Reviewer'],
        isActive: true
      };

      const mockDetail = {
        id: 'disc-rev-001',
        trackingNumber: 'PU-IPR-2026-0042',
        title: 'Autonomous Drone Navigation for Precision Agriculture',
        status: 'SUBMITTED',
        primaryInventorId: 'inv-9999-8888-7777-6666',
        assignedReviewerId: mockReviewerUser.id,
        reviewStatus: 'ASSIGNED',
        legalClearanceStatus: 'PENDING',
        pidcsData: {
          abstract: 'Detailed abstract on drone sensory array and computer vision algorithm.',
          detailedDescription: 'Full architecture specification of the quadcopter flight controller.',
          priorArtDetails: 'Differs from DJI patent US9876543 by utilizing edge AI processing.'
        },
        submissionTimestamp: '2026-11-27T10:00:00.000Z',
        createdAt: '2026-11-27T10:00:00.000Z',
        updatedAt: '2026-11-27T10:00:00.000Z'
      };

      const mockConsents = [
        {
          id: 'con-1',
          disclosureId: 'disc-rev-001',
          userId: 'inv-9999-8888-7777-6666',
          isExternal: false,
          externalName: null,
          externalEmail: null,
          externalOrganization: null,
          shareBasisPoints: 10000,
          status: 'VERIFIED'
        }
      ];

      const mockAttachments = [
        {
          id: 'att-1',
          fileName: 'quadcopter-schematic.pdf',
          fileSizeBytes: 102400,
          mimeType: 'application/pdf',
          sha256Hash: 'a'.repeat(64),
          scanStatus: 'CLEAN',
          createdAt: '2026-11-27T10:00:00.000Z'
        }
      ];

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              authenticated: true,
              user: mockReviewerUser,
              csrfToken: 'rev-csrf-token'
            })
          };
        }
        if (url.includes('/api/bff/disclosures/disc-rev-001/consents')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, consents: mockConsents })
          };
        }
        if (url.includes('/api/bff/disclosures/disc-rev-001/attachments')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, attachments: mockAttachments })
          };
        }
        if (url.includes('/api/bff/disclosures/disc-rev-001')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, disclosure: mockDetail })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<ReviewerDisclosureDetailPage />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Live Database Record');
      expect(container.textContent).toContain('AUTHORIZED');
      expect(container.textContent).toContain('Autonomous Drone Navigation');
      expect(container.textContent).toContain('Detailed abstract on drone sensory array');
      expect(container.textContent).toContain('Full architecture specification');
      expect(container.textContent).toContain('Differs from DJI patent');
      expect(container.textContent).toContain('quadcopter-schematic.pdf');
      expect(container.textContent).toContain('CLEAN');
    });

    it('renders Access Denied screen when Reviewer is not assigned to disclosure (403)', async () => {
      currentRouteId = 'unassigned-disc-999';

      const mockReviewerUser = {
        id: 'rev-1111-2222-3333-4444',
        email: 'reviewer@paruluniversity.ac.in',
        fullName: 'Prof. Vikramaditya Joshi',
        activeRoles: ['Reviewer'],
        isActive: true
      };

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              authenticated: true,
              user: mockReviewerUser,
              csrfToken: 'rev-csrf-token'
            })
          };
        }
        if (url.includes('/api/bff/disclosures/unassigned-disc-999')) {
          return {
            ok: false,
            status: 403,
            json: async () => ({
              error: {
                code: 'DISCLOSURE_ACCESS_DENIED',
                message: 'Actor not authorized to read disclosure'
              }
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<ReviewerDisclosureDetailPage />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Access Denied');
      expect(container.textContent).toContain('Disclosure Not Assigned');
      expect(container.textContent).toContain('You are not authorized to inspect this disclosure');
    });

    it('validates evaluation rubric and clearly notes pending database gateway', async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<ReviewerDisclosureDetailPage />);
      });

      await act(async () => {
        await flushPromises();
      });

      // Verify pending gateway notice exists on the form
      expect(container.textContent).toContain('Pending Gateway');
      expect(container.textContent).toContain('record_reviewer_evaluation_v1');

      // Fill in remarks and submit
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea).toBeDefined();

      await act(async () => {
        if (textarea) {
          textarea.value = 'Clear inventive step over cited prior art US88888.';
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          (textarea as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      const form = container.querySelector('form');
      expect(form).toBeDefined();

      await act(async () => {
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Rubric validated');
      expect(container.textContent).toContain('Simulation Mode');
    });
  });

  describe('Pending Gateways Transparency', () => {
    it('Reviewer Clarifications page displays pending gateway notice', async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<ReviewerClarificationsPage />);
      });

      expect(container.textContent).toContain('Gateway Status (Pending Migration)');
      expect(container.textContent).toContain('create_clarification_query_v1');
    });

    it('Reviewer Evaluation ledger displays pending gateway notice', async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<ReviewerEvaluationPage />);
      });

      expect(container.textContent).toContain('Gateway Status (Pending Migration)');
      expect(container.textContent).toContain('record_reviewer_evaluation_v1');
    });
  });
});
