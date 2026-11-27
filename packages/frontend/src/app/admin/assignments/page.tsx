'use client';

import React, { useState, useEffect } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import {
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Database,
  Loader2,
  AlertCircle
} from 'lucide-react';

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

interface InstitutionalReviewer {
  id: string;
  name: string;
  department: string;
}

const INSTITUTIONAL_REVIEWERS: InstitutionalReviewer[] = [
  {
    id: 'c1111111-2222-3333-4444-555555555555',
    name: 'Prof. Vikramaditya Joshi',
    department: 'Department of Electrical & Electronics, PIT'
  },
  {
    id: 'c2222222-2222-3333-4444-555555555555',
    name: 'Dr. Priya Patel',
    department: 'Department of Computer Science & AI, PIET'
  },
  {
    id: 'c3333333-2222-3333-4444-555555555555',
    name: 'Dr. Rajesh Verma',
    department: 'Department of Mechanical Engineering, PIT'
  }
];

export default function AdminAssignmentsPage() {
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [realDisclosures, setRealDisclosures] = useState<DisclosureListItemDto[] | null>(null);
  const [selectedReviewers, setSelectedReviewers] = useState<Record<string, string>>({});
  const [customReviewerIds, setCustomReviewerIds] = useState<Record<string, string>>({});
  const [assignedStatus, setAssignedStatus] = useState<Record<string, string>>({});
  const [successMessages, setSuccessMessages] = useState<Record<string, string>>({});
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    async function checkSessionAndFetch() {
      try {
        const sessRes = await fetch(`${backendUrl}/api/v1/auth/session`, {
          credentials: 'include'
        });

        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (sessData.authenticated && sessData.user) {
            setIsBackendConnected(true);
            setCsrfToken(sessData.csrfToken || '');

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
        // Fallback to preview data
      }
    }

    checkSessionAndFetch();
  }, [backendUrl]);

  // Determine which disclosures to render
  const disclosuresToRender = realDisclosures !== null
    ? realDisclosures.map((d) => ({
      id: d.id,
      trackingNumber: d.trackingNumber || 'DRAFT-PENDING',
      title: d.title,
      status: d.status,
      leadName: `Inventor (${d.primaryInventorId.slice(0, 8)})`,
      domain: 'University Research & Technology',
      assignedReviewerId: d.assignedReviewerId,
      isAssignable: d.status === 'SUBMITTED' || d.status === 'APPROVED'
    }))
    : MOCK_DISCLOSURES.map((d) => ({
      id: d.id,
      trackingNumber: d.trackingNumber,
      title: d.title,
      status: d.status,
      leadName: d.leadInventor.name,
      domain: d.fieldOfInvention,
      assignedReviewerId: d.assignedReviewer?.id || null,
      isAssignable: d.status === 'SUBMITTED' || d.status === 'APPROVED'
    }));

  const handleSelectChange = (disclosureId: string, value: string) => {
    setSelectedReviewers((prev) => ({ ...prev, [disclosureId]: value }));
  };

  const handleCustomIdChange = (disclosureId: string, value: string) => {
    setCustomReviewerIds((prev) => ({ ...prev, [disclosureId]: value }));
  };

  const handleAssign = async (disclosureId: string) => {
    setSavingId(disclosureId);
    setErrorMessages((prev) => ({ ...prev, [disclosureId]: '' }));
    setSuccessMessages((prev) => ({ ...prev, [disclosureId]: '' }));

    const selectedChoice = selectedReviewers[disclosureId] || INSTITUTIONAL_REVIEWERS[0].id;
    const effectiveReviewerId = selectedChoice === 'custom'
      ? (customReviewerIds[disclosureId] || '').trim()
      : selectedChoice;

    if (!effectiveReviewerId) {
      setErrorMessages((prev) => ({ ...prev, [disclosureId]: 'Please provide a valid Reviewer UUID.' }));
      setSavingId(null);
      return;
    }

    if (isBackendConnected && csrfToken) {
      try {
        const res = await fetch(`/api/bff/disclosures/${disclosureId}/assign-reviewer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          credentials: 'include',
          body: JSON.stringify({ reviewerId: effectiveReviewerId })
        });

        const resData = await res.json();

        if (!res.ok) {
          const detail = resData.error?.detail || resData.error?.message || 'Assignment failed.';
          setErrorMessages((prev) => ({ ...prev, [disclosureId]: detail }));
        } else {
          const reviewerObj = INSTITUTIONAL_REVIEWERS.find((r) => r.id === effectiveReviewerId);
          const reviewerLabel = reviewerObj ? reviewerObj.name : `Reviewer (${effectiveReviewerId.slice(0, 8)}...)`;

          setAssignedStatus((prev) => ({ ...prev, [disclosureId]: reviewerLabel }));
          setSuccessMessages((prev) => ({
            ...prev,
            [disclosureId]: `Assigned to ${reviewerLabel} successfully!`
          }));

          // Update real disclosures list locally
          setRealDisclosures((prev) =>
            prev
              ? prev.map((d) => (d.id === disclosureId ? { ...d, assignedReviewerId: effectiveReviewerId } : d))
              : null
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Network error during reviewer allocation.';
        setErrorMessages((prev) => ({ ...prev, [disclosureId]: message }));
      } finally {
        setSavingId(null);
      }
    } else {
      // Preview Mode
      const reviewerObj = INSTITUTIONAL_REVIEWERS.find((r) => r.id === effectiveReviewerId);
      const reviewerLabel = reviewerObj ? reviewerObj.name : effectiveReviewerId;

      setAssignedStatus((prev) => ({ ...prev, [disclosureId]: reviewerLabel }));
      setSuccessMessages((prev) => ({
        ...prev,
        [disclosureId]: `Preview Mode: Allocated to ${reviewerLabel}`
      }));
      setSavingId(null);
    }
  };

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/assignments"
      title="Reviewer Allocation & Assignments"
      subtitle="Assign submitted disclosures to qualified subject matter expert reviewers"
    >
      <div className="space-y-4">
        {/* Status Banner */}
        {isBackendConnected ? (
          <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Live Reviewer Allocation Active:</strong> Connected via BFF to <code>public.assign_disclosure_reviewer_v1</code>.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px] font-bold">
              LIVE GATEWAY
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>UI Preview Mode:</strong> Showing simulated reviewer assignment. Sign in with an Administrator account to submit live allocations.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
              PREVIEW
            </span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
          <div className="p-4 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Institutional Invention Disclosures
            </span>
            <span className="text-xs text-rose-700 font-semibold">
              Authorized Committee Oversight
            </span>
          </div>

          {disclosuresToRender.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              No invention disclosures found in repository.
            </div>
          ) : (
            disclosuresToRender.map((disc) => {
              const currentReviewerDisplay =
                assignedStatus[disc.id] ||
                (disc.assignedReviewerId
                  ? INSTITUTIONAL_REVIEWERS.find((r) => r.id === disc.assignedReviewerId)?.name ||
                  `Reviewer (${disc.assignedReviewerId.slice(0, 8)}...)`
                  : null);

              const selectedChoice = selectedReviewers[disc.id] || INSTITUTIONAL_REVIEWERS[0].id;
              const isSaving = savingId === disc.id;
              const hasError = !!errorMessages[disc.id];
              const hasSuccess = !!successMessages[disc.id];

              return (
                <div key={disc.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-400 font-semibold">{disc.trackingNumber}</span>
                      <StatusBadge status={disc.status} size="sm" />
                      {!disc.isAssignable && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-medium">
                          Workflow Rule: Must be SUBMITTED or APPROVED
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-gray-900">{disc.title}</h4>
                    <p className="text-gray-500">
                      Lead: {disc.leadName} &bull; Domain: {disc.domain}
                    </p>
                    <p className="text-gray-600 font-medium">
                      Current Allocation:{' '}
                      {currentReviewerDisplay ? (
                        <span className="text-emerald-700 font-bold">{currentReviewerDisplay}</span>
                      ) : (
                        <span className="text-amber-600 font-semibold">Unassigned</span>
                      )}
                    </p>

                    {hasSuccess && (
                      <p className="text-emerald-700 font-semibold flex items-center gap-1 mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        {successMessages[disc.id]}
                      </p>
                    )}

                    {hasError && (
                      <p className="text-rose-700 font-semibold flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {errorMessages[disc.id]}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                    <select
                      value={selectedChoice}
                      onChange={(e) => handleSelectChange(disc.id, e.target.value)}
                      disabled={isSaving}
                      className="px-3 py-2 border border-gray-300 rounded-xl bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    >
                      {INSTITUTIONAL_REVIEWERS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                      <option value="custom">Custom Reviewer UUID...</option>
                    </select>

                    {selectedChoice === 'custom' && (
                      <input
                        type="text"
                        placeholder="Reviewer UUID"
                        value={customReviewerIds[disc.id] || ''}
                        onChange={(e) => handleCustomIdChange(disc.id, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono w-48 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    )}

                    <button
                      onClick={() => handleAssign(disc.id)}
                      disabled={isSaving}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-sm transition inline-flex items-center gap-1.5"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Save / Allocate</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </PortalShell>
  );
}
