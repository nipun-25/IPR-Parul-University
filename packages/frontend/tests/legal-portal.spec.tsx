import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import LegalDashboard from '../src/app/legal/dashboard/page';
import LegalReviewedPage from '../src/app/legal/reviewed/page';
import LegalFilingPage from '../src/app/legal/filing/page';
import LegalPatentsPage from '../src/app/legal/patents/page';
import LegalPatentDetailPage from '../src/app/legal/patents/[id]/page';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pushMock = vi.fn();
const mockRouter = {
  push: pushMock,
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn()
};

let currentRouteId = 'pat-app-001';

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: currentRouteId }),
  useSearchParams: () => new URLSearchParams()
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 50));

function setElementValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  (element as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker?.setValue('');
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Legal Portal Integration Tests', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    pushMock.mockClear();
    currentRouteId = 'pat-app-001';
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

  describe('Legal Dashboard (/legal/dashboard)', () => {
    it('renders in UI Preview Mode when unauthenticated', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Unauthenticated'));
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<LegalDashboard />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Legal & Patent Directorate Workspace');
      expect(container.textContent).toContain('UI Preview Mode');
      expect(container.textContent).toContain('PREVIEW');
    });

    it('renders live approved disclosures when Legal session is active', async () => {
      const mockLegalUser = {
        id: 'usr-legal-1111-2222-3333',
        email: 'legal.officer@paruluniversity.ac.in',
        fullName: 'Adv. Rajesh Mehta',
        activeRoles: ['Legal'],
        isActive: true
      };

      const mockLiveDisclosures = [
        {
          id: 'disc-legal-001',
          trackingNumber: 'PU-IPR-2026-0099',
          title: 'Quantum Key Distribution for High-Speed Optical Fiber Networks',
          status: 'APPROVED',
          primaryInventorId: 'inv-1234',
          assignedReviewerId: 'rev-5678',
          reviewStatus: 'COMPLETED',
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
              user: mockLegalUser,
              csrfToken: 'mock-csrf-token'
            })
          };
        }
        if (url.includes('/api/bff/disclosures')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              disclosures: mockLiveDisclosures
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<LegalDashboard />);
      });

      await act(async () => {
        await flushPromises();
        await flushPromises();
      });

      expect(container.textContent).toContain('Live Legal Clearance Queue Connected');
      expect(container.textContent).toContain('LIVE DATA');
      expect(container.textContent).toContain('PU-IPR-2026-0099');
      expect(container.textContent).toContain('Quantum Key Distribution');
      expect(container.textContent).toContain('Clearance Pending');
    });

    it('renders empty queue state when no disclosures are awaiting legal processing', async () => {
      const mockLegalUser = {
        id: 'usr-legal-1111',
        email: 'legal@paruluniversity.ac.in',
        fullName: 'Adv. Rajesh Mehta',
        activeRoles: ['Legal'],
        isActive: true
      };

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              authenticated: true,
              user: mockLegalUser
            })
          };
        }
        if (url.includes('/api/bff/disclosures')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              disclosures: [
                {
                  id: 'disc-001',
                  trackingNumber: 'PU-DRAFT',
                  title: 'Draft Project',
                  status: 'DRAFT',
                  primaryInventorId: 'inv-1',
                  assignedReviewerId: null,
                  reviewStatus: 'UNASSIGNED',
                  legalClearanceStatus: 'NOT_STARTED',
                  createdAt: '2026-11-27T10:00:00.000Z',
                  updatedAt: '2026-11-27T10:00:00.000Z'
                }
              ]
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<LegalDashboard />);
      });

      await act(async () => {
        await flushPromises();
        await flushPromises();
      });

      expect(container.textContent).toContain('No Disclosures Pending Legal Review');
    });
  });

  describe('Legal Reviewed & Clearance Page (/legal/reviewed)', () => {
    it('submits legal clearance determination with CSRF token and updates status', async () => {
      const mockLegalUser = {
        id: 'usr-legal-1111',
        email: 'legal@paruluniversity.ac.in',
        fullName: 'Adv. Rajesh Mehta',
        activeRoles: ['Legal'],
        isActive: true
      };

      const mockDisclosures = [
        {
          id: 'disc-clearance-001',
          trackingNumber: 'PU-IPR-2026-0101',
          title: 'Biodegradable Polymers from Agro-Waste',
          status: 'APPROVED',
          primaryInventorId: 'inv-001',
          assignedReviewerId: 'rev-001',
          reviewStatus: 'COMPLETED',
          legalClearanceStatus: 'PENDING',
          createdAt: '2026-11-27T10:00:00.000Z',
          updatedAt: '2026-11-27T10:00:00.000Z'
        }
      ];

      let postedClearanceBody: any = null;
      let postedHeaders: any = null;

      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/v1/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              authenticated: true,
              user: mockLegalUser,
              csrfToken: 'csrf-legal-clearance-token'
            })
          };
        }
        if (url.includes('/api/bff/disclosures') && !url.includes('legal-clearance')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              disclosures: mockDisclosures
            })
          };
        }
        if (url.includes('/legal-clearance')) {
          postedClearanceBody = JSON.parse(init?.body as string);
          postedHeaders = init?.headers;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 200,
              data: {
                disclosureId: 'disc-clearance-001',
                clearanceStatus: 'CLEARED'
              }
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<LegalReviewedPage />);
      });

      await act(async () => {
        await flushPromises();
        await flushPromises();
      });

      expect(container.textContent).toContain('PU-IPR-2026-0101');
      expect(container.textContent).toContain('Biodegradable Polymers');

      // Click "Clearance Assessment" button
      const openModalBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Clearance Assessment')
      );
      expect(openModalBtn).toBeDefined();

      await act(async () => {
        openModalBtn?.click();
        await flushPromises();
      });

      // Type assessment notes
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea).toBeDefined();

      await act(async () => {
        if (textarea) {
          setElementValue(textarea, 'Patentability search confirms high novelty and non-obviousness. Cleared for filing.');
        }
      });

      // Click "Submit Clearance Determination" button
      const confirmBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Submit Clearance Determination')
      );
      expect(confirmBtn).toBeDefined();

      await act(async () => {
        confirmBtn?.click();
        await flushPromises();
      });

      expect(postedHeaders['X-CSRF-Token']).toBe('csrf-legal-clearance-token');
      expect(postedClearanceBody.clearanceStatus).toBe('CLEARED');
      expect(postedClearanceBody.clearanceNotes).toContain('Patentability search confirms');
      expect(container.textContent).toContain('Legal clearance successfully recorded as CLEARED!');
    });
  });

  describe('Legal Filing Page (/legal/filing)', () => {
    it('creates a live patent application docket via POST /api/bff/patents', async () => {
      const mockLegalUser = {
        id: 'usr-legal-1111',
        email: 'legal@paruluniversity.ac.in',
        fullName: 'Adv. Rajesh Mehta',
        activeRoles: ['Legal'],
        isActive: true
      };

      const mockEligibleDisclosures = [
        {
          id: 'disc-filing-001',
          trackingNumber: 'PU-IPR-2026-0088',
          title: 'High-Efficiency Perovskite Solar Cells',
          status: 'APPROVED',
          primaryInventorId: 'inv-001',
          assignedReviewerId: 'rev-001',
          reviewStatus: 'COMPLETED',
          legalClearanceStatus: 'CLEARED',
          createdAt: '2026-11-27T10:00:00.000Z',
          updatedAt: '2026-11-27T10:00:00.000Z'
        }
      ];

      let postedFilingBody: any = null;
      let postedHeaders: any = null;

      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/v1/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              authenticated: true,
              user: mockLegalUser,
              csrfToken: 'csrf-filing-token'
            })
          };
        }
        if (url.includes('/api/bff/disclosures')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              disclosures: mockEligibleDisclosures
            })
          };
        }
        if (url.includes('/api/bff/patents') && init?.method === 'POST') {
          postedFilingBody = JSON.parse(init?.body as string);
          postedHeaders = init?.headers;
          return {
            ok: true,
            status: 201,
            json: async () => ({
              status: 201,
              application: {
                id: 'pat-docket-new-001',
                currentStage: 'FILING_PREPARATION'
              }
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<LegalFilingPage />);
      });

      await act(async () => {
        await flushPromises();
        await flushPromises();
      });

      expect(container.textContent).toContain('PU-IPR-2026-0088');

      // Submit the form
      const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Create Official Patent Docket')
      );
      expect(submitBtn).toBeDefined();

      await act(async () => {
        submitBtn?.click();
        await flushPromises();
      });

      expect(postedHeaders['X-CSRF-Token']).toBe('csrf-filing-token');
      expect(postedFilingBody.disclosureId).toBe('disc-filing-001');
      expect(container.textContent).toContain('Official Patent Docket Created Successfully!');
      expect(container.textContent).toContain('pat-docket-new-001');
    });
  });

  describe('Legal Portfolio Page (/legal/patents)', () => {
    it('displays the pending migration transparency banner for list_patent_applications_v1', async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<LegalPatentsPage />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Gateway Status (Pending Migration)');
      expect(container.textContent).toContain('list_patent_applications_v1');
      expect(container.textContent).toContain('PREVIEW / PENDING GATEWAY');
    });

    it('navigates to direct docket detail via UUID search bar', async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<LegalPatentsPage />);
      });

      await act(async () => {
        await flushPromises();
      });

      const searchInput = container.querySelector('input[placeholder*="Inspect Live Patent Docket"]') as HTMLInputElement;
      expect(searchInput).toBeDefined();

      const form = container.querySelector('form');
      expect(form).toBeDefined();

      await act(async () => {
        if (searchInput) {
          setElementValue(searchInput, '550e8400-e29b-41d4-a716-446655440000');
        }
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(pushMock).toHaveBeenCalledWith('/legal/patents/550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('Legal Patent Detail & Stage Management (/legal/patents/[id])', () => {
    it('renders live patent details and advances statutory stage via POST /api/bff/patents/:id/stage-transition', async () => {
      currentRouteId = 'pat-live-1234';

      const mockLegalUser = {
        id: 'usr-legal-1111',
        email: 'legal@paruluniversity.ac.in',
        fullName: 'Adv. Rajesh Mehta',
        activeRoles: ['Legal'],
        isActive: true
      };

      const mockPatentApp = {
        id: 'pat-live-1234',
        disclosureId: 'disc-live-5678',
        applicationNumber: '202621004567',
        cbrNumber: 'CBR-2026-999',
        jurisdiction: 'IN',
        currentStage: 'FILING_PREPARATION',
        assignedLegalOfficerId: 'usr-legal-1111',
        createdAt: '2026-11-27T10:00:00.000Z',
        updatedAt: '2026-11-27T10:00:00.000Z',
        disclosure: {
          trackingNumber: 'PU-IPR-2026-0042',
          title: 'Autonomous Drone Navigation for Precision Agriculture',
          primaryDepartment: 'Computer Science & Engineering',
          primaryFaculty: 'Faculty of Engineering & Technology'
        },
        stageHistory: [
          {
            id: 'sh-1',
            toStage: 'FILING_PREPARATION',
            transitionReason: 'Initial docket creation',
            transitionedAt: '2026-11-27T10:00:00.000Z'
          }
        ]
      };

      let postedTransitionBody: any = null;
      let postedHeaders: any = null;

      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/v1/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              authenticated: true,
              user: mockLegalUser,
              csrfToken: 'csrf-stage-transition-token'
            })
          };
        }
        if (url.includes('/api/bff/patents/pat-live-1234/stage-transition') && init?.method === 'POST') {
          postedTransitionBody = JSON.parse(init?.body as string);
          postedHeaders = init?.headers;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 200,
              data: {
                id: 'pat-live-1234',
                toStage: 'FORMALITIES_CHECK',
                reason: 'Formal filing submitted to IPO Mumbai'
              }
            })
          };
        }
        if (url.includes('/api/bff/patents/pat-live-1234')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              application: mockPatentApp
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<LegalPatentDetailPage />);
      });

      await act(async () => {
        await flushPromises();
        await flushPromises();
      });

      expect(container.textContent).toContain('Application No: 202621004567');
      expect(container.textContent).toContain('FILING PREPARATION');
      expect(container.textContent).toContain('Live Patent Application Record');
      expect(container.textContent).toContain('LIVE GATEWAY');

      // Fill in transition remarks
      const remarksTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(remarksTextarea).toBeDefined();

      const form = container.querySelector('form');
      expect(form).toBeDefined();

      await act(async () => {
        if (remarksTextarea) {
          setElementValue(remarksTextarea, 'Formal filing submitted to IPO Mumbai');
        }
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flushPromises();
      });

      expect(postedHeaders['X-CSRF-Token']).toBe('csrf-stage-transition-token');
      expect(postedTransitionBody.toStage).toBe('FORMALITIES_CHECK');
      expect(postedTransitionBody.transitionReason).toBe('Formal filing submitted to IPO Mumbai');
      expect(container.textContent).toContain('Patent stage advanced successfully to FORMALITIES_CHECK');
    });

    it('renders 403 Access Denied when Legal Officer is not assigned to the patent case', async () => {
      currentRouteId = 'pat-unassigned-9999';

      const mockLegalUser = {
        id: 'usr-legal-different-9999',
        email: 'other.legal@paruluniversity.ac.in',
        fullName: 'Adv. Other Officer',
        activeRoles: ['Legal'],
        isActive: true
      };

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              authenticated: true,
              user: mockLegalUser,
              csrfToken: 'csrf-token'
            })
          };
        }
        if (url.includes('/api/bff/patents/pat-unassigned-9999')) {
          return {
            ok: false,
            status: 403,
            json: async () => ({
              error: {
                code: 'PATENT_ACCESS_DENIED',
                message: 'Case isolation: You are not assigned to this patent application.'
              }
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<LegalPatentDetailPage />);
      });

      await act(async () => {
        await flushPromises();
        await flushPromises();
      });

      expect(container.textContent).toContain('Access Denied');
      expect(container.textContent).toContain('Case Isolation Security Rule');
      expect(container.textContent).toContain('Under institutional legal case isolation rules');
    });
  });
});
