import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AdminReportsPage from '../src/app/admin/reports/page';
import LegalReportsPage from '../src/app/legal/reports/page';
import StudentNotificationsPage from '../src/app/student/notifications/page';
import FacultyNotificationsPage from '../src/app/faculty/notifications/page';
import ReviewerNotificationsPage from '../src/app/reviewer/notifications/page';
import LegalNotificationsPage from '../src/app/legal/notifications/page';
import AdminNotificationsPage from '../src/app/admin/notifications/page';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn()
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams()
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('Phase 2 Step 5: Notifications, Search & Reports Integration Tests', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
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

  describe('1. Institutional Reports & Analytics (/admin/reports & /legal/reports)', () => {
    it('Admin Reports renders live metrics from /api/bff/reports/summary', async () => {
      const mockAdminUser = {
        id: 'usr-admin-001',
        email: 'dean.rnd@paruluniversity.ac.in',
        fullName: 'Dr. Dean Research',
        activeRoles: ['Administrator'],
        isActive: true
      };

      const mockSummary = {
        totalDisclosures: 15,
        byStatus: { APPROVED: 8, SUBMITTED: 5, DRAFT: 2 },
        byReviewStatus: { UNASSIGNED: 2, ASSIGNED: 3, IN_PROGRESS: 2, COMPLETED: 8 },
        byLegalClearanceStatus: { NOT_STARTED: 4, PENDING: 3, CLEARED: 7, REJECTED: 1 },
        recentActivity: []
      };

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ authenticated: true, user: mockAdminUser })
          };
        }
        if (url.includes('/api/bff/reports/summary')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, summary: mockSummary })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<AdminReportsPage />);
      });

      await act(async () => {
        await flushPromises();
        await flushPromises();
      });

      expect(container.textContent).toContain('Live Institutional Analytics Connected');
      expect(container.textContent).toContain('LIVE DATABASE METRICS');
      expect(container.textContent).toContain('15'); // Total Disclosures
      expect(container.textContent).toContain('8 filings'); // Approved filings
      expect(container.textContent).toContain('7'); // Cleared for IPO
    });

    it('Admin Reports falls back to UI Demonstration Analytics when unauthenticated', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Unauthenticated'));
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<AdminReportsPage />);
      });

      await act(async () => {
        await flushPromises();
      });

      expect(container.textContent).toContain('UI Demonstration Analytics');
      expect(container.textContent).toContain('DEMO METRICS');
      expect(container.textContent).toContain('Export Authoritative CSV');
    });

    it('Legal Reports renders live statutory summary when Legal session is active', async () => {
      const mockLegalUser = {
        id: 'usr-legal-001',
        email: 'legal.officer@paruluniversity.ac.in',
        fullName: 'Adv. Rajesh Mehta',
        activeRoles: ['Legal'],
        isActive: true
      };

      const mockSummary = {
        totalDisclosures: 5,
        byStatus: { APPROVED: 5, SUBMITTED: 0, DRAFT: 0 },
        byReviewStatus: { UNASSIGNED: 0, ASSIGNED: 0, IN_PROGRESS: 0, COMPLETED: 5 },
        byLegalClearanceStatus: { NOT_STARTED: 0, PENDING: 2, CLEARED: 3, REJECTED: 0 },
        recentActivity: []
      };

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ authenticated: true, user: mockLegalUser })
          };
        }
        if (url.includes('/api/bff/reports/summary')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, summary: mockSummary })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<LegalReportsPage />);
      });

      await act(async () => {
        await flushPromises();
        await flushPromises();
      });

      expect(container.textContent).toContain('Live Legal Analytics Connected');
      expect(container.textContent).toContain('LIVE GATEWAY DATA');
      expect(container.textContent).toContain('5'); // Total Inventions
      expect(container.textContent).toContain('3 cases'); // Cleared cases
    });

    it('triggers CSV download from authoritative /api/bff/reports/export/disclosures.csv', async () => {
      const mockBlob = new Blob(['ID,Tracking Number,Title\n1,PU-001,Drone\n'], { type: 'text/csv' });
      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/bff/reports/export/disclosures.csv')) {
          return {
            ok: true,
            status: 200,
            blob: async () => mockBlob
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      // Mock URL.createObjectURL and revokeObjectURL
      const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
      const revokeObjectURLMock = vi.fn();
      window.URL.createObjectURL = createObjectURLMock;
      window.URL.revokeObjectURL = revokeObjectURLMock;

      await act(async () => {
        root = createRoot(container);
        root.render(<AdminReportsPage />);
      });

      await act(async () => {
        await flushPromises();
      });

      const exportBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Export Authoritative CSV')
      );
      expect(exportBtn).toBeDefined();

      await act(async () => {
        exportBtn?.click();
        await flushPromises();
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/bff/reports/export/disclosures.csv', expect.anything());
      expect(createObjectURLMock).toHaveBeenCalledWith(mockBlob);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('2. Notification Gateways & Pending Migration Transparency', () => {
    it('Student Notifications displays pending migration notice and live derived alerts', async () => {
      const mockStudentUser = {
        id: 'usr-student-001',
        email: 'student@paruluniversity.ac.in',
        fullName: 'Nipun Student',
        activeRoles: ['Student'],
        isActive: true
      };

      const mockDisclosures = [
        {
          id: 'disc-notif-001',
          trackingNumber: 'PU-IPR-2026-0042',
          title: 'Precision Agri Drone',
          status: 'APPROVED',
          reviewStatus: 'COMPLETED',
          legalClearanceStatus: 'CLEARED',
          createdAt: '2026-11-20T10:00:00Z',
          updatedAt: '2026-11-26T10:00:00Z'
        }
      ];

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/auth/session')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ authenticated: true, user: mockStudentUser })
          };
        }
        if (url.includes('/api/bff/disclosures')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ disclosures: mockDisclosures })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', fetchMock);

      await act(async () => {
        root = createRoot(container);
        root.render(<StudentNotificationsPage />);
      });

      await act(async () => {
        await flushPromises();
        await flushPromises();
      });

      // Pending migration banner verification
      expect(container.textContent).toContain('Gateway Status (Pending Migration)');
      expect(container.textContent).toContain('public.user_notifications');
      expect(container.textContent).toContain('PREVIEW / LIVE WORKFLOW EVENTS');

      // Live activity feed verification
      expect(container.textContent).toContain('Legal Clearance Granted');
      expect(container.textContent).toContain('Precision Agri Drone');
      expect(container.textContent).toContain('Peer Technical Review Completed');
    });

    it('Faculty, Reviewer, Legal & Admin Notifications all display pending migration notices', async () => {
      // 1. Faculty
      await act(async () => {
        root = createRoot(container);
        root.render(<FacultyNotificationsPage />);
      });
      await act(async () => { await flushPromises(); });
      expect(container.textContent).toContain('Gateway Status (Pending Migration)');
      expect(container.textContent).toContain('public.user_notifications');
      await act(async () => { root?.unmount(); await flushPromises(); });

      // 2. Reviewer
      await act(async () => {
        root = createRoot(container);
        root.render(<ReviewerNotificationsPage />);
      });
      await act(async () => { await flushPromises(); });
      expect(container.textContent).toContain('Gateway Status (Pending Migration)');
      expect(container.textContent).toContain('public.user_notifications');
      await act(async () => { root?.unmount(); await flushPromises(); });

      // 3. Legal
      await act(async () => {
        root = createRoot(container);
        root.render(<LegalNotificationsPage />);
      });
      await act(async () => { await flushPromises(); });
      expect(container.textContent).toContain('Gateway Status (Pending Migration)');
      expect(container.textContent).toContain('public.user_notifications');
      await act(async () => { root?.unmount(); await flushPromises(); });

      // 4. Admin
      await act(async () => {
        root = createRoot(container);
        root.render(<AdminNotificationsPage />);
      });
      await act(async () => { await flushPromises(); });
      expect(container.textContent).toContain('Gateway Status (Pending Migration)');
      expect(container.textContent).toContain('public.user_notifications');
    });
  });
});
