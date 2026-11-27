'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatCard } from '../../../components/ui/StatCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, MOCK_USERS } from '../../../data/mock-portal-data';
import {
  BookOpen,
  PlusCircle,
  FileCheck,
  Scale,
  Award,
  Users,
  ArrowRight,
  TrendingUp,
  X,
  AlertCircle
} from 'lucide-react';

interface UserSession {
  id: string;
  fullName: string;
  email: string;
  activeRoles: string[];
  isActive: boolean;
}

interface DisclosureListItemDto {
  id: string;
  trackingNumber: string | null;
  title: string;
  status: string;
  primaryInventorId: string;
  assignedReviewerId: string | null;
  reviewStatus: string;
  legalClearanceStatus: string;
  createdAt: string;
  updatedAt: string;
}

export default function FacultyDashboard() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [realDisclosures, setRealDisclosures] = useState<DisclosureListItemDto[] | null>(null);

  // New Draft Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch(`${backendUrl}/api/v1/auth/session`, {
          credentials: 'include'
        });

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
            setCsrfToken(data.csrfToken || '');
            setIsBackendConnected(true);

            // Fetch live disclosures
            const discRes = await fetch('/api/bff/disclosures', {
              credentials: 'include'
            });
            if (discRes.ok) {
              const discData = await discRes.json();
              setRealDisclosures(discData.disclosures || []);
            }
          }
        }
      } catch {
        // Fallback to preview mode
      }
    }

    checkSession();
  }, [backendUrl]);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError('Please enter an invention disclosure title.');
      return;
    }

    setCreating(true);
    setCreateError('');

    try {
      const res = await fetch('/api/bff/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          title: newTitle.trim(),
          pidcsData: {
            fieldOfInvention: 'Academic Research & Innovation',
            grantDetails: 'Institutional R&D',
            abstract: '',
            detailedDescription: ''
          }
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.title || 'Failed to create draft disclosure');
      }

      const created = await res.json();
      setShowCreateModal(false);
      setNewTitle('');

      // Refresh disclosures list
      const discRes = await fetch('/api/bff/disclosures', {
        credentials: 'include'
      });
      if (discRes.ok) {
        const discData = await discRes.json();
        setRealDisclosures(discData.disclosures || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating draft disclosure';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const defaultFaculty = MOCK_USERS[1]; // Dr. Ramesh Patel
  const facultyUser = user
    ? {
        fullName: user.fullName,
        email: user.email,
        department: 'Department of Renewable Energy, PIT'
      }
    : {
        fullName: defaultFaculty.name,
        email: defaultFaculty.email,
        department: defaultFaculty.department
      };

  const mockFacultyDisclosures = MOCK_DISCLOSURES.filter(
    (d) => d.leadInventor.role === 'Faculty' || d.inventors.some((inv) => inv.name === defaultFaculty.name)
  );

  const displayDisclosures = realDisclosures !== null
    ? realDisclosures.map((d) => ({
        id: d.id,
        trackingNumber: d.trackingNumber || 'DRAFT-PENDING',
        title: d.title,
        status: d.status,
        fieldOfInvention: 'Renewable Energy & Materials Science',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        leadInventor: { name: facultyUser.fullName, department: facultyUser.department, role: 'Faculty' },
        inventors: [{ id: d.primaryInventorId, name: facultyUser.fullName, email: facultyUser.email, role: 'Faculty', consentStatus: 'VERIFIED', basisPoints: 10000 }]
      }))
    : mockFacultyDisclosures;

  const totalCount = displayDisclosures.length;
  const patentPendingCount = displayDisclosures.filter((d) => d.status === 'PATENT_PENDING' || d.status === 'FILED').length;
  const underReviewCount = displayDisclosures.filter((d) => d.status === 'UNDER_REVIEW').length;
  const draftsCount = displayDisclosures.filter((d) => d.status === 'DRAFT').length;

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/dashboard"
      title="Faculty Research & Innovation Portal"
      subtitle={`Welcome, ${facultyUser.fullName} • ${facultyUser.department}`}
      isBackendConnected={isBackendConnected}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Research Draft</span>
          </button>
          <Link
            href="/faculty/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <span>Full PIDCS Form</span>
          </Link>
        </div>
      }
    >
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Research Disclosures"
          value={totalCount}
          subtitle="Funded & Lab Innovations"
          icon={BookOpen}
          colorScheme="emerald"
        />
        <StatCard
          title="Patent Pending"
          value={patentPendingCount || '1'}
          subtitle="E-filed at IPO Mumbai"
          icon={Scale}
          colorScheme="indigo"
        />
        <StatCard
          title="Under Review"
          value={underReviewCount || '1'}
          subtitle="Committee evaluation"
          icon={Award}
          colorScheme="purple"
        />
        <StatCard
          title="Active Drafts"
          value={draftsCount || '1'}
          subtitle="Pending completion"
          icon={Users}
          colorScheme="blue"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Active Research Inventions */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Active Department Disclosures</h2>
              <p className="text-xs text-gray-500">Funded research projects and intellectual property assets</p>
            </div>
            <Link
              href="/faculty/disclosures"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {displayDisclosures.map((disc) => (
              <div key={disc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-400 font-semibold">{disc.trackingNumber}</span>
                    <StatusBadge status={disc.status} size="sm" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm hover:text-emerald-600 transition">
                    <Link href={`/faculty/disclosures/${disc.id}`}>{disc.title}</Link>
                  </h3>
                  <p className="text-gray-500 line-clamp-1">{disc.fieldOfInvention}</p>
                </div>
                <div className="shrink-0">
                  <Link
                    href={`/faculty/disclosures/${disc.id}`}
                    className="px-3 py-1.5 font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: R&D Directives & Quick Shortcuts */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span>Faculty R&D Support</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
              <p className="font-bold text-emerald-900">Institutional Patent Subsidies</p>
              <p className="text-emerald-800 leading-relaxed">
                100% of Indian Patent Office statutory filing and attorney fees are sponsored by Parul University.
              </p>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
              <p className="font-bold text-blue-900">Commercialization Royalties</p>
              <p className="text-blue-800 leading-relaxed">
                60/40 revenue share policy in favor of contributing faculty inventors upon commercial licensing.
              </p>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <Link
              href="/faculty/create"
              className="w-full flex items-center justify-between p-2.5 text-xs font-semibold text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-gray-200 transition"
            >
              <span>File New Research PIDCS</span>
              <PlusCircle className="w-4 h-4 text-emerald-600" />
            </Link>
            <Link
              href="/faculty/consent"
              className="w-full flex items-center justify-between p-2.5 text-xs font-semibold text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-gray-200 transition"
            >
              <span>Verify Co-Author Consents</span>
              <FileCheck className="w-4 h-4 text-emerald-600" />
            </Link>
          </div>
        </div>
      </div>

      {/* Create Research Draft Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  R&D
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">New Research Disclosure Draft</h3>
                  <p className="text-[11px] text-gray-500">Initiate an academic invention record</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Research Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Autonomous Drone-Assisted Precision Irrigation with Multi-Spectral Soil Moisture Sensing"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Drafts can be incrementally refined before formal institutional review.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition"
                >
                  {creating ? 'Creating Draft...' : 'Create Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
