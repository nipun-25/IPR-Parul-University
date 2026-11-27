'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatCard } from '../../../components/ui/StatCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, MOCK_USERS, type MockDisclosure } from '../../../data/mock-portal-data';
import {
  FileText,
  Clock,
  CheckCircle2,
  ArrowRight,
  Database,
  AlertCircle,
  RefreshCw,
  Send,
  Loader2,
  Inbox
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

export default function ReviewerDashboard() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [realDisclosures, setRealDisclosures] = useState<DisclosureListItemDto[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  const fetchAssignedDisclosures = async () => {
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
          throw new Error(errData.error?.message || 'Failed to fetch assigned disclosures from backend');
        }

        const discData = await discRes.json();
        const allDisclosures: DisclosureListItemDto[] = discData.disclosures || [];
        // Filter strictly to disclosures assigned to this reviewer
        const assignedOnly = allDisclosures.filter(
          (d) => d.assignedReviewerId === sessData.user.id || !d.assignedReviewerId
        );
        setRealDisclosures(assignedOnly);
      } else {
        setIsBackendConnected(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to reviewer queue';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedDisclosures();
  }, [backendUrl]);

  // Fallback preview data
  const previewReviewer = MOCK_USERS[3]; // Prof. Vikramaditya Joshi
  const previewAssigned = MOCK_DISCLOSURES.filter((d) => d.assignedReviewer?.id === previewReviewer.id);
  const previewPending = previewAssigned.filter((d) => !d.evaluation);

  const assignedCount = realDisclosures !== null ? realDisclosures.length : previewAssigned.length;
  const pendingCount = realDisclosures !== null
    ? realDisclosures.filter((d) => d.reviewStatus !== 'COMPLETED').length
    : previewPending.length;
  const completedCount = realDisclosures !== null
    ? realDisclosures.filter((d) => d.reviewStatus === 'COMPLETED').length
    : previewAssigned.length - previewPending.length;

  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/dashboard"
      title="IPR Technical Reviewer Workspace"
      subtitle={
        user
          ? `Welcome, ${user.fullName} • Technical Review Committee`
          : `Welcome, ${previewReviewer.name} • ${previewReviewer.department}`
      }
    >
      <div className="space-y-6">
        {/* Status Banner */}
        {isBackendConnected && realDisclosures !== null ? (
          <div className="flex items-center justify-between p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-700 shrink-0" />
              <span>
                <strong>Live Reviewer Queue Connected:</strong> Displaying {realDisclosures.length} assigned disclosure(s) from PostgreSQL.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-mono text-[10px] font-bold">
              LIVE DATA
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>UI Preview Mode:</strong> Showing sample reviewer queue. Sign in as an authorized Reviewer to view live assigned disclosures.
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
              onClick={fetchAssignedDisclosures}
              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded font-medium text-xs flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Assigned Disclosures"
            value={assignedCount}
            subtitle="Technical evaluation queue"
            icon={FileText}
            colorScheme="purple"
          />
          <StatCard
            title="Pending Reviews"
            value={pendingCount}
            subtitle="Awaiting scoring & remarks"
            icon={Clock}
            colorScheme="amber"
          />
          <StatCard
            title="Completed Evaluations"
            value={completedCount}
            subtitle="Evaluated & cleared"
            icon={CheckCircle2}
            colorScheme="emerald"
          />
          <StatCard
            title="Clarification Queries"
            value="0"
            subtitle="Pending DB gateway"
            icon={Send}
            colorScheme="blue"
          />
        </div>

        {/* Evaluation Queue Table / Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Current Evaluation Queue</h2>
                <p className="text-xs text-gray-500">Examine novelty, inventive step, and industrial applicability</p>
              </div>
              <Link
                href="/reviewer/pending"
                className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                View Pending <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-xs text-gray-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                <span>Loading assigned reviewer queue...</span>
              </div>
            ) : realDisclosures !== null ? (
              realDisclosures.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-xs text-gray-500 space-y-2">
                  <Inbox className="w-8 h-8 text-gray-300" />
                  <p className="font-semibold text-gray-700">No Disclosures Assigned</p>
                  <p className="text-gray-400 max-w-sm">
                    You currently have no invention disclosures assigned to your evaluation panel. The IPR Administrator will allocate submissions as they arrive.
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
                          <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-mono">
                            Review: {disc.reviewStatus}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm hover:text-purple-600 transition">
                          <Link href={`/reviewer/disclosures/${disc.id}`}>{disc.title}</Link>
                        </h3>
                        <p className="text-gray-500">
                          Primary Inventor ID: {disc.primaryInventorId.slice(0, 8)}... &bull; Submitted:{' '}
                          {new Date(disc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/reviewer/disclosures/${disc.id}`}
                          className="px-3.5 py-1.5 font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition"
                        >
                          Evaluate
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Preview Mode List */
              <div className="divide-y divide-gray-100">
                {previewAssigned.map((disc) => (
                  <div key={disc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-400 font-semibold">{disc.trackingNumber}</span>
                        <StatusBadge status={disc.status} size="sm" />
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm hover:text-purple-600 transition">
                        <Link href={`/reviewer/disclosures/${disc.id}`}>{disc.title}</Link>
                      </h3>
                      <p className="text-gray-500">Lead: {disc.leadInventor.name} &bull; {disc.fieldOfInvention}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/reviewer/disclosures/${disc.id}`}
                        className="px-3.5 py-1.5 font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition"
                      >
                        Evaluate
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Guidelines */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
              Statutory Evaluation Criteria
            </h3>
            <div className="space-y-3 text-gray-600">
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                <p className="font-bold text-purple-900 mb-0.5">1. Novelty (Section 2(1)(j))</p>
                <p className="text-[11px] text-gray-500">
                  Invention or technology must not have been anticipated by publication anywhere in the world or prior public use.
                </p>
              </div>
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                <p className="font-bold text-purple-900 mb-0.5">2. Inventive Step (Section 2(1)(ja))</p>
                <p className="text-[11px] text-gray-500">
                  Feature that involves technical advance as compared to existing knowledge, not obvious to a person skilled in the art.
                </p>
              </div>
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                <p className="font-bold text-purple-900 mb-0.5">3. Industrial Applicability (Section 2(1)(ac))</p>
                <p className="text-[11px] text-gray-500">
                  Capable of being made or used in an industry.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
