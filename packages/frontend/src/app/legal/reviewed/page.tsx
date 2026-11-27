'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, type MockDisclosure } from '../../../data/mock-portal-data';
import {
  Scale,
  CheckCircle2,
  Database,
  AlertCircle,
  AlertTriangle,
  Loader2,
  FileCheck,
  ShieldCheck,
  ShieldAlert
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

export default function LegalReviewedPage() {
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [realDisclosures, setRealDisclosures] = useState<DisclosureListItemDto[] | null>(null);
  const [selectedDisclosureId, setSelectedDisclosureId] = useState<string | null>(null);
  const [clearanceStatus, setClearanceStatus] = useState<'CLEARED' | 'REJECTED'>('CLEARED');
  const [clearanceNotes, setClearanceNotes] = useState<string>('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    async function loadReviewedDisclosures() {
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
              const approvedOnly = list.filter(
                (d) => d.status === 'APPROVED' || d.status === 'SUBMITTED'
              );
              setRealDisclosures(approvedOnly);
            }
          }
        }
      } catch {
        // Fallback to preview data
      }
    }

    loadReviewedDisclosures();
  }, [backendUrl]);

  const handleRecordClearance = async (disclosureId: string) => {
    setSubmittingId(disclosureId);
    setActionError(null);
    setActionSuccess(null);

    if (!clearanceNotes.trim()) {
      setActionError('Clearance assessment notes are required.');
      setSubmittingId(null);
      return;
    }

    if (isBackendConnected && csrfToken) {
      try {
        const res = await fetch(`/api/bff/disclosures/${disclosureId}/legal-clearance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          credentials: 'include',
          body: JSON.stringify({
            clearanceStatus,
            clearanceNotes: clearanceNotes.trim()
          })
        });

        const resData = await res.json();
        if (!res.ok) {
          const detail = resData.error?.detail || resData.error?.message || 'Failed to record legal clearance';
          setActionError(detail);
        } else {
          setActionSuccess(`Legal clearance successfully recorded as ${clearanceStatus}!`);
          setSelectedDisclosureId(null);
          setClearanceNotes('');
          // Update local state
          setRealDisclosures((prev) =>
            prev
              ? prev.map((d) => (d.id === disclosureId ? { ...d, legalClearanceStatus: clearanceStatus } : d))
              : null
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Network error recording legal clearance';
        setActionError(message);
      } finally {
        setSubmittingId(null);
      }
    } else {
      // Preview Mode Simulation
      setActionSuccess(`Preview Mode: Simulated clearance recorded as ${clearanceStatus}`);
      setSelectedDisclosureId(null);
      setClearanceNotes('');
      setSubmittingId(null);
    }
  };

  const previewDisclosures = MOCK_DISCLOSURES.filter((d) => d.evaluation || d.status === 'APPROVED');

  const displayDisclosures: MockDisclosure[] = realDisclosures !== null
    ? realDisclosures.map((d) => ({
        id: d.id,
        trackingNumber: d.trackingNumber || 'DRAFT-PENDING',
        title: d.title,
        status: d.status as any,
        fieldOfInvention: 'Approved Invention',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        leadInventor: {
          id: d.primaryInventorId,
          name: `Inventor (${d.primaryInventorId.slice(0, 8)})`,
          email: 'inventor@paruluniversity.ac.in',
          role: 'Student' as const,
          department: 'Academic Faculty',
          avatar: '',
          status: 'ACTIVE' as const,
          joinedDate: d.createdAt
        },
        department: 'Parul University',
        commercialPotential: '',
        priorArtDetails: '',
        clarifications: [],
        inventors: [],
        abstract: '',
        detailedDescription: '',
        attachments: [],
        reviewStatus: d.reviewStatus,
        legalClearanceStatus: d.legalClearanceStatus
      }))
    : previewDisclosures;

  const columns = [
    {
      key: 'trackingNumber',
      header: 'Tracking No.',
      className: 'w-36 font-mono text-xs font-semibold text-gray-500'
    },
    {
      key: 'title',
      header: 'Reviewed Invention Title',
      render: (disc: MockDisclosure) => (
        <div>
          <span className="font-bold text-gray-900">{disc.title}</span>
          <p className="text-xs text-gray-400">Lead: {disc.leadInventor.name}</p>
        </div>
      )
    },
    {
      key: 'legalClearanceStatus',
      header: 'Legal Clearance',
      className: 'w-36 text-xs',
      render: (disc: MockDisclosure) => {
        const statusVal = (disc as any).legalClearanceStatus || 'PENDING';
        return (
          <span
            className={`font-semibold px-2.5 py-1 rounded-full border text-[11px] ${
              statusVal === 'CLEARED'
                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                : statusVal === 'REJECTED'
                ? 'text-rose-800 bg-rose-50 border-rose-200'
                : 'text-amber-800 bg-amber-50 border-amber-200'
            }`}
          >
            {statusVal}
          </span>
        );
      }
    },
    {
      key: 'actions',
      header: 'Legal Action',
      className: 'w-48 text-right',
      render: (disc: MockDisclosure) => {
        const isCleared = (disc as any).legalClearanceStatus === 'CLEARED';
        return (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setSelectedDisclosureId(disc.id);
                setActionError(null);
                setActionSuccess(null);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition"
            >
              Clearance Assessment
            </button>
            {isCleared && (
              <Link
                href={`/legal/filing?disclosureId=${disc.id}`}
                className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
              >
                Draft Form 1 & 2
              </Link>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/reviewed"
      title="Peer-Reviewed Disclosures Ready for Legal Clearance"
      subtitle="Examine technical recommendations and issue formal legal clearance before Indian Patent Office docketing"
    >
      <div className="space-y-6">
        {/* Status Banner */}
        {isBackendConnected && realDisclosures !== null ? (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Live Clearance Gateway Active:</strong> Connected to <code>public.record_legal_clearance_v1</code> via BFF.
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
                <strong>UI Preview Mode:</strong> Showing demonstration disclosures. Sign in as a Legal Officer to issue live clearance.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
              PREVIEW
            </span>
          </div>
        )}

        {actionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Modal / Inline Panel for Recording Legal Clearance */}
        {selectedDisclosureId && (
          <div className="p-6 bg-white border border-amber-300 rounded-2xl shadow-sm space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-600" /> Statutory Legal Clearance Assessment
              </h3>
              <button
                onClick={() => setSelectedDisclosureId(null)}
                className="text-gray-400 hover:text-gray-700 font-semibold"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-gray-500">
              Assessing disclosure ID: <code className="font-mono text-gray-800">{selectedDisclosureId}</code>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Clearance Determination *</label>
                <select
                  value={clearanceStatus}
                  onChange={(e) => setClearanceStatus(e.target.value as 'CLEARED' | 'REJECTED')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="CLEARED">CLEARED (Ready for IPO Patent Application)</option>
                  <option value="REJECTED">REJECTED (Statutory Ineligibility / Prior Art)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Clearance Notes & Statutory Basis *</label>
                <textarea
                  rows={2}
                  required
                  value={clearanceNotes}
                  onChange={(e) => setClearanceNotes(e.target.value)}
                  placeholder="State non-anticipation under Section 2(1)(j) or grounds for objection under Section 3..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedDisclosureId(null)}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRecordClearance(selectedDisclosureId)}
                disabled={submittingId === selectedDisclosureId}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-xl inline-flex items-center gap-1.5"
              >
                {submittingId === selectedDisclosureId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Submit Clearance Determination</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={displayDisclosures}
          rowKey={(d) => d.id}
          searchPlaceholder="Search approved disclosures by tracking number or title..."
        />
      </div>
    </PortalShell>
  );
}
