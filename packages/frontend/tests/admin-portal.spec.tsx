import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AdminDisclosuresPage from '../src/app/admin/disclosures/page';
import AdminAssignmentsPage from '../src/app/admin/assignments/page';
import AdminUsersPage from '../src/app/admin/users/page';
import AdminAuditPage from '../src/app/admin/audit/page';

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
  useParams: () => ({ id: 'mock-disclosure-id' }),
  useSearchParams: () => new URLSearchParams()
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 30));

describe('Administrator Portal Integration Tests', () => {
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

  describe('Admin Disclosures Page', () => {
    it('renders in UI Preview Mode when unauthenticated', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Unauthenticated'));
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<AdminDisclosuresPage />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Institutional Disclosures Oversight');
      expect(container.textContent).toContain('UI Preview Mode');
      expect(container.textContent).toContain('PREVIEW');
      expect(container.textContent).toContain('PU-IPR-2026-0042');
    });

    it('renders live disclosures when authenticated Administrator session exists', async () => {
      const mockAdminUser = {
        id: 'adm-0000-1111-2222-3333',
        email: 'admin@paruluniversity.ac.in',
        fullName: 'Dr. Ketan Kotecha',
        activeRoles: ['Administrator'],
        isActive: true
      };

      const mockLiveDisclosures = [
        {
          id: 'b1111111-2222-3333-4444-555555555555',
          trackingNumber: 'PU-IPR-2026-0099',
          title: 'Autonomous Drone Navigation for Precision Farming',
          status: 'SUBMITTED',
          primaryInventorId: '99999999-8888-7777-6666-555555555555',
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
              user: mockAdminUser,
              csrfToken: 'admin-csrf-test-token'
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
        root.render(<AdminDisclosuresPage />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Live Database Connected');
      expect(container.textContent).toContain('LIVE DATA');
      expect(container.textContent).toContain('Autonomous Drone Navigation');
      expect(container.textContent).toContain('PU-IPR-2026-0099');
      expect(container.textContent).toContain('Unassigned');
    });
  });

  describe('Admin Assignments Page', () => {
    it('renders in UI Preview Mode when unauthenticated', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Unauthenticated'));
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<AdminAssignmentsPage />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Reviewer Allocation & Assignments');
      expect(container.textContent).toContain('UI Preview Mode');
      expect(container.textContent).toContain('PREVIEW');
    });

    it('submits reviewer allocation to /api/bff/disclosures/:id/assign-reviewer with CSRF token', async () => {
      const mockAdminUser = {
        id: 'adm-0000-1111-2222-3333',
        email: 'admin@paruluniversity.ac.in',
        fullName: 'Dr. Ketan Kotecha',
        activeRoles: ['Administrator'],
        isActive: true
      };

      const disclosureId = 'b1111111-2222-3333-4444-555555555555';
      const mockLiveDisclosures = [
        {
          id: disclosureId,
          trackingNumber: 'PU-IPR-2026-0099',
          title: 'Autonomous Drone Navigation for Precision Farming',
          status: 'SUBMITTED',
          primaryInventorId: '99999999-8888-7777-6666-555555555555',
          assignedReviewerId: null,
          reviewStatus: 'UNASSIGNED',
          legalClearanceStatus: 'PENDING',
          createdAt: '2026-11-27T10:00:00.000Z',
          updatedAt: '2026-11-27T10:00:00.000Z'
        }
      ];

      let assignRequestBody: any = null;
      let assignHeaders: Record<string, string> = {};

      const fetchMock = vi.fn().mockImplementation(async (url: string, options: any) => {
        if (url.includes('/api/v1/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              authenticated: true,
              user: mockAdminUser,
              csrfToken: 'test-admin-csrf-9999'
            })
          };
        }
        if (url.includes('/api/bff/disclosures') && !url.includes('/assign-reviewer')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              disclosures: mockLiveDisclosures
            })
          };
        }
        if (url.includes(`/api/bff/disclosures/${disclosureId}/assign-reviewer`)) {
          assignRequestBody = JSON.parse(options.body);
          assignHeaders = options.headers;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                assigned: true,
                disclosureId,
                reviewerId: assignRequestBody.reviewerId,
                assignedAt: new Date().toISOString()
              }
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<AdminAssignmentsPage />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Live Reviewer Allocation Active');
      expect(container.textContent).toContain('Autonomous Drone Navigation');

      // Click "Save / Allocate"
      const buttons = container.querySelectorAll('button');
      const allocateBtn = Array.from(buttons).find((b) => b.textContent?.includes('Save / Allocate'));
      expect(allocateBtn).toBeDefined();

      await act(async () => {
        allocateBtn?.click();
      });

      await act(async () => {
        await flushPromises();
      });

      // Verify request to BFF endpoint
      expect(assignHeaders['X-CSRF-Token']).toBe('test-admin-csrf-9999');
      expect(assignHeaders['Content-Type']).toBe('application/json');
      expect(assignRequestBody).toBeDefined();
      expect(assignRequestBody.reviewerId).toBe('c1111111-2222-3333-4444-555555555555');

      // Verify success message in UI
      expect(container.textContent).toContain('Assigned to Prof. Vikramaditya Joshi successfully!');
    });

    it('displays error message when reviewer allocation fails', async () => {
      const mockAdminUser = {
        id: 'adm-0000-1111-2222-3333',
        email: 'admin@paruluniversity.ac.in',
        fullName: 'Dr. Ketan Kotecha',
        activeRoles: ['Administrator'],
        isActive: true
      };

      const disclosureId = 'b1111111-2222-3333-4444-555555555555';
      const mockLiveDisclosures = [
        {
          id: disclosureId,
          trackingNumber: 'PU-IPR-2026-0099',
          title: 'Draft Invention Not Yet Submitted',
          status: 'DRAFT',
          primaryInventorId: '99999999-8888-7777-6666-555555555555',
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
              user: mockAdminUser,
              csrfToken: 'test-admin-csrf-9999'
            })
          };
        }
        if (url.includes('/api/bff/disclosures') && !url.includes('/assign-reviewer')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              disclosures: mockLiveDisclosures
            })
          };
        }
        if (url.includes('/assign-reviewer')) {
          return {
            ok: false,
            status: 422,
            json: async () => ({
              error: {
                code: 'INVALID_WORKFLOW_STATE',
                detail: 'Reviewers can only be assigned to SUBMITTED or APPROVED disclosures.'
              }
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<AdminAssignmentsPage />);
      });

      await act(async () => {
        await flushPromises();
      });

      // Click "Save / Allocate"
      const buttons = container.querySelectorAll('button');
      const allocateBtn = Array.from(buttons).find((b) => b.textContent?.includes('Save / Allocate'));
      expect(allocateBtn).toBeDefined();

      await act(async () => {
        allocateBtn?.click();
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('Reviewers can only be assigned to SUBMITTED or APPROVED disclosures.');
    });
  });

  describe('Admin Pending Gateways Transparency', () => {
    it('Admin Users page clearly displays pending database gateway status banner', async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<AdminUsersPage />);
      });

      expect(container.textContent).toContain('Gateway Status (Pending Migration)');
      expect(container.textContent).toContain('list_portal_users_v1');
      expect(container.textContent).toContain('PREVIEW / PENDING GATEWAY');
    });

    it('Admin Audit page clearly displays pending database gateway status banner', async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<AdminAuditPage />);
      });

      expect(container.textContent).toContain('Gateway Status (Pending Migration)');
      expect(container.textContent).toContain('list_security_audit_events_v1');
      expect(container.textContent).toContain('PREVIEW / PENDING GATEWAY');
    });
  });
});
