'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PortalShell } from '../../../components/layout/PortalShell';
import {
  Scale,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Database,
  ExternalLink
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
}

function LegalFilingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDisclosureId = searchParams?.get('disclosureId') || '';

  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [eligibleDisclosures, setEligibleDisclosures] = useState<DisclosureListItemDto[]>([]);
  const [selectedDisclosureId, setSelectedDisclosureId] = useState<string>(preselectedDisclosureId);
  const [appNumber, setAppNumber] = useState('');
  const [cbrNumber, setCbrNumber] = useState('');
  const [jurisdiction, setJurisdiction] = useState('Indian Patent Office (Mumbai)');
  const [submitting, setSubmitting] = useState(false);
  const [createdDocket, setCreatedDocket] = useState<{ id: string; stage: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    async function initFilingData() {
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
              const list: DisclosureListItemDto[] = discData.disclosures || [];
              setEligibleDisclosures(list);
              if (!selectedDisclosureId && list.length > 0) {
                // Pick first cleared disclosure if available
                const cleared = list.find((d) => d.legalClearanceStatus === 'CLEARED');
                setSelectedDisclosureId(cleared ? cleared.id : list[0].id);
              }
            }
          }
        }
      } catch {
        // Fallback to preview mode
      }
    }

    initFilingData();
  }, [backendUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setCreatedDocket(null);

    if (!selectedDisclosureId) {
      setErrorMessage('Please select a target invention disclosure.');
      setSubmitting(false);
      return;
    }

    if (isBackendConnected && csrfToken) {
      try {
        const res = await fetch('/api/bff/patents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          credentials: 'include',
          body: JSON.stringify({
            disclosureId: selectedDisclosureId
          })
        });

        const resData = await res.json();
        if (!res.ok) {
          const detail = resData.error?.detail || resData.error?.message || 'Failed to create patent application';
          setErrorMessage(detail);
        } else {
          setCreatedDocket({
            id: resData.application?.id || resData.data?.id,
            stage: resData.application?.currentStage || 'FILING_PREPARATION'
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Network error creating patent application';
        setErrorMessage(message);
      } finally {
        setSubmitting(false);
      }
    } else {
      // Preview Simulation
      const simulatedId = 'pat-' + Math.random().toString(36).substring(2, 10);
      setCreatedDocket({
        id: simulatedId,
        stage: 'FILING_PREPARATION'
      });
      setSubmitting(false);
    }
  };

  const selectedDisc = eligibleDisclosures.find((d) => d.id === selectedDisclosureId);

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/filing"
      title="Prepare Official Patent Filing (Form 1 & 2)"
      subtitle="E-filing record creation and docket opening backed by PostgreSQL gateway (public.create_patent_application_v1)"
      actions={
        <Link
          href="/legal/patents"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Status Banner */}
        {isBackendConnected ? (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Live Docket Creation Active:</strong> Connected to <code>public.create_patent_application_v1</code> via BFF.
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
                <strong>UI Preview Mode:</strong> Showing simulated patent docket preparation. Sign in as a Legal Officer to create live dockets.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
              PREVIEW
            </span>
          </div>
        )}

        {createdDocket && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-xs text-emerald-900">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Official Patent Docket Created Successfully!</span>
            </div>
            <p>
              Docket identifier: <code className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-800">{createdDocket.id}</code> &bull; Initial Stage: <strong>{createdDocket.stage}</strong>
            </p>
            <div className="pt-2">
              <Link
                href={`/legal/patents/${createdDocket.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl transition"
              >
                <span>Open Docket & Stage Manager</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Target Disclosure Selector */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-amber-600" /> 1. Select Approved Invention Disclosure
          </h3>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Invention Disclosure Docket *</label>
            {eligibleDisclosures.length > 0 ? (
              <select
                value={selectedDisclosureId}
                onChange={(e) => setSelectedDisclosureId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {eligibleDisclosures.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.trackingNumber || 'DRAFT'} — {d.title} ({d.status} • Legal: {d.legalClearanceStatus})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Target Disclosure UUID"
                value={selectedDisclosureId}
                onChange={(e) => setSelectedDisclosureId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            )}
            <p className="text-[11px] text-gray-500 mt-1">
              Database Rule: Disclosures must have <code>legal_clearance_status = &apos;CLEARED&apos;</code> to create a patent docket.
            </p>
          </div>

          {selectedDisc && selectedDisc.legalClearanceStatus !== 'CLEARED' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Clearance Notice:</strong> Current clearance is <code>{selectedDisc.legalClearanceStatus}</code>. Please issue formal legal clearance under <Link href="/legal/reviewed" className="underline font-bold">Peer-Reviewed Disclosures</Link> before docket creation.
              </span>
            </div>
          )}
        </div>

        {/* 2. Statutory Identification & Jurisdiction */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
            2. Filing Jurisdiction & Registry Metadata
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">IPO Registry Office *</label>
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white"
              >
                <option value="Indian Patent Office (Mumbai)">Indian Patent Office (Mumbai)</option>
                <option value="Indian Patent Office (Delhi)">Indian Patent Office (Delhi)</option>
                <option value="PCT / WIPO International">PCT / WIPO International Phase</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Official Application Number (Optional)</label>
              <input
                type="text"
                value={appNumber}
                onChange={(e) => setAppNumber(e.target.value)}
                placeholder="Assigned by IPO e.g. 202621004821"
                className="w-full px-3 py-2 font-mono border border-gray-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">CBR Number (Optional)</label>
              <input
                type="text"
                value={cbrNumber}
                onChange={(e) => setCbrNumber(e.target.value)}
                placeholder="e.g. CBR-2026-MUM-89124"
                className="w-full px-3 py-2 font-mono border border-gray-300 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Link
            href="/legal/patents"
            className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-xs transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-sm transition inline-flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Instantiating Docket...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Create Official Patent Docket</span>
              </>
            )}
          </button>
        </div>
      </form>
    </PortalShell>
  );
}

export default function LegalFilingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <span>Loading patent filing console...</span>
          </div>
        </div>
      }
    >
      <LegalFilingContent />
    </React.Suspense>
  );
}
