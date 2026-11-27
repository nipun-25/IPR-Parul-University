'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PortalShell } from '../../../../components/layout/PortalShell';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { MOCK_PATENT_APPLICATIONS, type MockPatentApplication } from '../../../../data/mock-portal-data';
import {
  Scale,
  ArrowLeft,
  History,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Database,
  Lock,
  Loader2,
  ShieldCheck
} from 'lucide-react';

interface PatentApplicationDto {
  id: string;
  disclosureId: string;
  currentStage: string;
  assignedLegalOfficerId: string | null;
  currentHistoryId: string | null;
  filingDate: string | null;
  applicationNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUTORY_ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  FILING_PREPARATION: ['FORMALITIES_CHECK', 'ABANDONED'],
  FORMALITIES_CHECK: ['PUBLICATION_PENDING', 'ABANDONED'],
  PUBLICATION_PENDING: ['EXAMINATION_REQUESTED', 'ABANDONED'],
  EXAMINATION_REQUESTED: ['FIRST_EXAMINATION_REPORT', 'ABANDONED'],
  FIRST_EXAMINATION_REPORT: ['RESPONSE_SUBMITTED', 'ABANDONED'],
  RESPONSE_SUBMITTED: ['HEARING_SCHEDULED', 'GRANTED', 'REJECTED', 'ABANDONED'],
  HEARING_SCHEDULED: ['GRANTED', 'REJECTED', 'ABANDONED'],
  GRANTED: [],
  REJECTED: [],
  ABANDONED: []
};

export default function LegalPatentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [realPatent, setRealPatent] = useState<PatentApplicationDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stage transition form state
  const [currentStage, setCurrentStage] = useState<string>('FILING_PREPARATION');
  const [targetStage, setTargetStage] = useState<string>('');
  const [stageRemarks, setStageRemarks] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionSuccess, setTransitionSuccess] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    async function loadPatentApplication() {
      if (!id) return;
      setIsLoading(true);
      setAccessDenied(false);
      setErrorMessage(null);

      try {
        const sessRes = await fetch(`${backendUrl}/api/v1/auth/session`, {
          credentials: 'include'
        });

        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (sessData.authenticated && sessData.user) {
            setIsBackendConnected(true);
            setCsrfToken(sessData.csrfToken || '');

            const appRes = await fetch(`/api/bff/patents/${id}`, {
              credentials: 'include'
            });

            if (!appRes.ok) {
              if (appRes.status === 403) {
                setAccessDenied(true);
                setIsLoading(false);
                return;
              }
              const errData = await appRes.json().catch(() => ({}));
              throw new Error(errData.error?.message || 'Failed to load patent application');
            }

            const appData = await appRes.json();
            const app = appData.application;
            setRealPatent(app);
            setCurrentStage(app.currentStage);
            const nextValid = STATUTORY_ALLOWED_TRANSITIONS[app.currentStage] || [];
            if (nextValid.length > 0) {
              setTargetStage(nextValid[0]);
            }
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error fetching patent application';
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadPatentApplication();
  }, [id, backendUrl]);

  // Preview data fallback
  const previewApp = MOCK_PATENT_APPLICATIONS.find((p) => p.id === id) || MOCK_PATENT_APPLICATIONS[0];

  const effectiveCurrentStage = realPatent ? currentStage : previewApp.currentStage;
  const validNextStages = STATUTORY_ALLOWED_TRANSITIONS[effectiveCurrentStage] || [];

  const handleStageTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTransitioning(true);
    setTransitionError(null);
    setTransitionSuccess(null);

    if (!targetStage) {
      setTransitionError('Please select a target statutory stage.');
      setIsTransitioning(false);
      return;
    }

    if (!stageRemarks.trim()) {
      setTransitionError('Transition reason and statutory citation are required.');
      setIsTransitioning(false);
      return;
    }

    if (isBackendConnected && csrfToken) {
      try {
        const res = await fetch(`/api/bff/patents/${id}/stage-transition`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          credentials: 'include',
          body: JSON.stringify({
            toStage: targetStage,
            transitionReason: stageRemarks.trim()
          })
        });

        const resData = await res.json();
        if (!res.ok) {
          const detail = resData.error?.detail || resData.error?.message || 'Stage transition failed';
          setTransitionError(detail);
        } else {
          setCurrentStage(targetStage);
          setTransitionSuccess(`Patent stage advanced successfully to ${targetStage}!`);
          setStageRemarks('');
          const next = STATUTORY_ALLOWED_TRANSITIONS[targetStage] || [];
          setTargetStage(next[0] || '');
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Network error during stage transition';
        setTransitionError(message);
      } finally {
        setIsTransitioning(false);
      }
    } else {
      // Preview Simulation
      setCurrentStage(targetStage);
      setTransitionSuccess(`Preview Mode: Advanced stage to ${targetStage}`);
      setStageRemarks('');
      setIsTransitioning(false);
    }
  };

  if (accessDenied) {
    return (
      <PortalShell
        role="Legal"
        currentPath="/legal/patents"
        title="Access Denied"
        subtitle="Restricted Legal Docket"
      >
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-gray-900">Case Isolation Security Rule</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Under institutional legal case isolation rules, Legal Officers can only inspect and transition patent applications assigned to their docket.
          </p>
          <div className="pt-2">
            <Link
              href="/legal/patents"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Patent Portfolio
            </Link>
          </div>
        </div>
      </PortalShell>
    );
  }

  const title = realPatent
    ? `Patent Docket #${realPatent.id.slice(0, 8)}`
    : previewApp.title;
  const appNumber = realPatent?.applicationNumber || previewApp.applicationNumber;
  const attorneyDisplay = realPatent?.assignedLegalOfficerId
    ? `Legal Officer (${realPatent.assignedLegalOfficerId.slice(0, 8)})`
    : previewApp.attorneyAssigned;

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/patents"
      title={title}
      subtitle={`Application No: ${appNumber} • Case Docket: ${id}`}
      actions={
        <Link
          href="/legal/patents"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Portfolio</span>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Connection Notice */}
        {isBackendConnected && realPatent ? (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Live Patent Application Record:</strong> Retrieved from PostgreSQL via <code>public.get_patent_application_v1</code>.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
              LIVE GATEWAY
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>UI Preview Mode:</strong> Showing demonstration patent case. Sign in as the designated Legal Officer to inspect live application dockets.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
              PREVIEW
            </span>
          </div>
        )}

        {/* Top Case Summary Bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 font-semibold">Current Statutory Stage:</span>
            <StatusBadge status={effectiveCurrentStage} />
          </div>
          <div className="text-gray-500">
            Assigned Attorney: <strong className="text-gray-800">{attorneyDisplay}</strong> &bull; Filed:{' '}
            {realPatent?.filingDate || previewApp.filingDate || 'Under Preparation'}
          </div>
        </div>

        {transitionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{transitionSuccess}</span>
          </div>
        )}

        {transitionError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{transitionError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Statutory Examination Progression */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-600" /> Statutory Examination Progression
              </h3>

              <div className="divide-y divide-gray-100">
                <div className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={effectiveCurrentStage} size="sm" />
                    <span className="text-[10px] text-gray-400 font-mono">
                      {realPatent ? new Date(realPatent.updatedAt).toLocaleString() : 'Current Stage'}
                    </span>
                  </div>
                  <p className="text-gray-700 mt-1">
                    {realPatent
                      ? `Active statutory docket state maintained in public.patent_applications.`
                      : 'Statutory filing entry registered.'}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Docket ID: {id} &bull; History ID: {realPatent?.currentHistoryId?.slice(0, 8) || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Advance Statutory Stage Form */}
          <div className="space-y-6">
            <form
              onSubmit={handleStageTransition}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs"
            >
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-600" /> Advance Statutory Stage
              </h3>

              {validNextStages.length === 0 ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500">
                  <p className="font-semibold text-gray-700">Terminal Stage Reached</p>
                  <p className="text-[11px] mt-0.5">
                    Stage <code>{effectiveCurrentStage}</code> is a terminal state. No further statutory stage transitions are permitted.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Permitted Next Stage *</label>
                    <select
                      value={targetStage}
                      onChange={(e) => setTargetStage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      {validNextStages.map((st) => (
                        <option key={st} value={st}>
                          {st.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Enforced by <code>public.patent_stage_allowed_transitions</code>.
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Transition Reason & Remarks *</label>
                    <textarea
                      rows={3}
                      required
                      value={stageRemarks}
                      onChange={(e) => setStageRemarks(e.target.value)}
                      placeholder="e.g. Form 18 filed, First Examination Report received from IPO Mumbai..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isTransitioning}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-sm transition inline-flex items-center justify-center gap-1.5"
                  >
                    {isTransitioning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Recording Transition...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Record Stage Transition</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
