'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatCard } from '../../../components/ui/StatCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_PATENT_APPLICATIONS, MOCK_DISCLOSURES, MOCK_USERS } from '../../../data/mock-portal-data';
import {
  Scale,
  PlusCircle,
  FileCheck,
  Clock,
  Award,
  ArrowRight,
  Database,
  AlertCircle,
  RefreshCw,
  Loader2,
  Inbox,
  ShieldAlert
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

export default function LegalDashboard() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [realDisclosures, setRealDisclosures] = useState<DisclosureListItemDto[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  const fetchLegalDisclosures = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const sessRes = await fetch(`${backendUrl}/api/v1/auth/session`, {
        credentials: 'include'
      });

      if (!sessRes.ok) {
        setIsBackendConnected(false);
        setIsLoading(false);
        return;
      }

      const sessData = await sessRes.json();
      if (sessData.authenticated && sessData.user) {
        setUser(sessData.user);
        setIsBackendConnected(true);

        const discRes = await fetch('/api/bff/disclosures', {
          credentials: 'include'
        });

        if (!discRes.ok) {
          const errData = await discRes.json().catch(() => ({}));
          throw new Error(errData.error?.message || 'Failed to fetch disclosures from backend');
        }

        const discData = await discRes.json();
        const allDisclosures: DisclosureListItemDto[] = discData.disclosures || [];
        // Filter disclosures approved for legal clearance or docketing
        const legalQueue = allDisclosures.filter(
          (d) => d.status === 'APPROVED' || d.status === 'SUBMITTED'
        );
        setRealDisclosures(legalQueue);
      } else {
        setIsBackendConnected(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to legal queue';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLegalDisclosures();
  }, [backendUrl]);

  // Fallback preview data
  const previewLegalOfficer = MOCK_USERS[4]; // Adv. Meera Desai
  const filedCount = MOCK_PATENT_APPLICATIONS.filter((a) => a.currentStage === 'FILED').length;
  const examCount = MOCK_PATENT_APPLICATIONS.filter(
    (a) => a.currentStage === 'EXAMINATION' || a.currentStage === 'HEARING'
  ).length;
  const grantedCount = MOCK_PATENT_APPLICATIONS.filter((a) => a.currentStage === 'GRANTED').length;

  const totalLegalQueue = realDisclosures !== null ? realDisclosures.length : MOCK_DISCLOSURES.length;
  const clearedCount = realDisclosures !== null
    ? realDisclosures.filter((d) => d.legalClearanceStatus === 'CLEARED').length
    : 2;
  const pendingClearanceCount = realDisclosures !== null
    ? realDisclosures.filter((d) => d.legalClearanceStatus === 'PENDING').length
    : 1;
  const rejectedClearanceCount = realDisclosures !== null
    ? realDisclosures.filter((d) => d.legalClearanceStatus === 'REJECTED').length
    : 0;

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/dashboard"
      title="Legal & Patent Directorate Workspace"
      subtitle={
        user
          ? `Welcome, ${user.fullName} • Directorate of Legal Affairs & IPR Cell`
          : `Welcome, ${previewLegalOfficer.name} • ${previewLegalOfficer.department}`
      }
      actions={
        <Link
          href="/legal/filing"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Prepare Indian Patent Filing</span>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Status Banner */}
        {isBackendConnected && realDisclosures !== null ? (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Live Legal Clearance Queue Connected:</strong> Displaying {realDisclosures.length} eligible disclosure(s) from PostgreSQL.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
              LIVE DATA
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>UI Preview Mode:</strong> Showing demonstration legal portfolio. Sign in as an authorized Legal Officer to inspect live disclosures.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
              PREVIEW
            </span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchLegalDisclosures}
              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded font-medium text-xs flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Legal Clearance Queue"
            value={totalLegalQueue}
            subtitle="Approved / Submitted filings"
            icon={Scale}
            colorScheme="amber"
          />
          <StatCard
            title="Cleared for Filing"
            value={clearedCount}
            subtitle="Ready for IPO Form 1 & 2"
            icon={FileCheck}
            colorScheme="emerald"
          />
          <StatCard
            title="Clearance Pending"
            value={pendingClearanceCount}
            subtitle="Awaiting legal assessment"
            icon={Clock}
            colorScheme="purple"
          />
          <StatCard
            title="Clearance Objections"
            value={rejectedClearanceCount}
            subtitle="Prior art / non-patentable"
            icon={ShieldAlert}
            colorScheme="blue"
          />
        </div>

        {/* Disclosures Ready for Legal Clearance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Legal Review & Clearance Queue</h2>
                <p className="text-xs text-gray-500">Record clearance determination or advance cleared disclosures to IPO filing</p>
              </div>
              <Link
                href="/legal/reviewed"
                className="text-xs font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1"
              >
                Review Disclosures <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-xs text-gray-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                <span>Loading legal queue from database...</span>
              </div>
            ) : realDisclosures !== null ? (
              realDisclosures.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-xs text-gray-500 space-y-2">
                  <Inbox className="w-8 h-8 text-gray-300" />
                  <p className="font-semibold text-gray-700">No Disclosures Pending Legal Review</p>
                  <p className="text-gray-400 max-w-sm">
                    All technical committee reviews have been processed, or new submissions have not yet reached the APPROVED stage.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {realDisclosures.map((disc) => (
                    <div key={disc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-400 font-semibold">
                            {disc.trackingNumber || 'DRAFT-PENDING'}
                          </span>
                          <StatusBadge status={disc.status} size="sm" />
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border ${
                              disc.legalClearanceStatus === 'CLEARED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : disc.legalClearanceStatus === 'REJECTED'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            Legal: {disc.legalClearanceStatus}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm hover:text-amber-600 transition">
                          <Link href={`/legal/reviewed`}>{disc.title}</Link>
                        </h3>
                        <p className="text-gray-500">
                          Primary Inventor ID: {disc.primaryInventorId.slice(0, 8)}... &bull; Submitted:{' '}
                          {new Date(disc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {disc.legalClearanceStatus === 'CLEARED' ? (
                          <Link
                            href={`/legal/filing?disclosureId=${disc.id}`}
                            className="px-3.5 py-1.5 font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                          >
                            File Patent
                          </Link>
                        ) : (
                          <Link
                            href="/legal/reviewed"
                            className="px-3.5 py-1.5 font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition"
                          >
                            Review Clearance
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Preview Mode List */
              <div className="divide-y divide-gray-100">
                {MOCK_PATENT_APPLICATIONS.map((app) => (
                  <div key={app.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-700">{app.applicationNumber}</span>
                        <span className="text-gray-400">&bull; {app.cbrNumber}</span>
                        <StatusBadge status={app.currentStage} size="sm" />
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm hover:text-amber-600 transition">
                        <Link href={`/legal/patents/${app.id}`}>{app.title}</Link>
                      </h3>
                      <p className="text-gray-500">
                        Lead: {app.leadInventor} &bull; Jurisdiction: {app.jurisdiction}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Link
                        href={`/legal/patents/${app.id}`}
                        className="px-3.5 py-1.5 font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Statutory Legal Guidance */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
              Indian Patent Office Legal Protocols
            </h3>
            <div className="space-y-3 text-gray-600">
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                <p className="font-bold text-amber-900 mb-0.5">1. Form 1: Application for Grant</p>
                <p className="text-[11px] text-gray-500">
                  Establishes university ownership and inventory declaration under Section 7 of the Indian Patents Act.
                </p>
              </div>
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                <p className="font-bold text-amber-900 mb-0.5">2. Form 2: Provisional / Complete Specification</p>
                <p className="text-[11px] text-gray-500">
                  Defines claim boundary, enabling disclosure, and best mode under Section 10.
                </p>
              </div>
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                <p className="font-bold text-amber-900 mb-0.5">3. Non-Patentable Subject Matter (Section 3)</p>
                <p className="text-[11px] text-gray-500">
                  Confirm disclosure is free of statutory exclusions under Section 3(d), 3(f), 3(k) before issuing clearance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
