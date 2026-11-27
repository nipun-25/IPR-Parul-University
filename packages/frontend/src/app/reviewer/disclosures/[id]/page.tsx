'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PortalShell } from '../../../../components/layout/PortalShell';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../../data/mock-portal-data';
import {
  Award,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Download,
  AlertCircle,
  Database,
  Lock,
  Loader2,
  Users,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

interface DisclosureDetailDto {
  id: string;
  trackingNumber: string | null;
  title: string;
  status: string;
  primaryInventorId: string;
  assignedReviewerId: string | null;
  reviewStatus: string;
  legalClearanceStatus: string;
  pidcsData: {
    abstract?: string;
    detailedDescription?: string;
    priorArtDetails?: string;
    commercialPotential?: string;
    fieldOfInvention?: string;
    noveltyClaims?: string;
    stageOfDevelopment?: string;
  } | null;
  submissionTimestamp: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConsentDto {
  id: string;
  disclosureId: string;
  userId: string | null;
  isExternal: boolean;
  externalName: string | null;
  externalEmail: string | null;
  externalOrganization: string | null;
  shareBasisPoints: number;
  status: string;
}

interface AttachmentDto {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256Hash: string;
  scanStatus: string;
  createdAt: string;
}

export default function ReviewerDisclosureDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [realDisclosure, setRealDisclosure] = useState<DisclosureDetailDto | null>(null);
  const [consents, setConsents] = useState<ConsentDto[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rubric state
  const [novelty, setNovelty] = useState(8);
  const [inventive, setInventive] = useState(8);
  const [applicability, setApplicability] = useState(9);
  const [recommendation, setRecommendation] = useState<
    'APPROVE_FOR_PATENT_FILING' | 'REVISE_AND_RESUBMIT' | 'REJECT'
  >('APPROVE_FOR_PATENT_FILING');
  const [remarks, setRemarks] = useState('');
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    async function loadDisclosureData() {
      if (!id) return;
      setIsLoading(true);
      setAccessDenied(false);
      setErrorMessage(null);

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
          setIsBackendConnected(true);

          // 1. Fetch disclosure details
          const discRes = await fetch(`/api/bff/disclosures/${id}`, {
            credentials: 'include'
          });

          if (!discRes.ok) {
            if (discRes.status === 403) {
              setAccessDenied(true);
              setIsLoading(false);
              return;
            }
            const errData = await discRes.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Failed to load disclosure details');
          }

          const discData = await discRes.json();
          setRealDisclosure(discData.disclosure);

          // 2. Fetch consents & attachments in parallel
          const [consentsRes, attachRes] = await Promise.all([
            fetch(`/api/bff/disclosures/${id}/consents`, { credentials: 'include' }),
            fetch(`/api/bff/disclosures/${id}/attachments`, { credentials: 'include' })
          ]);

          if (consentsRes.ok) {
            const cData = await consentsRes.json();
            setConsents(cData.consents || []);
          }

          if (attachRes.ok) {
            const aData = await attachRes.json();
            setAttachments(aData.attachments || []);
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error loading disclosure';
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadDisclosureData();
  }, [id, backendUrl]);

  // Preview data fallback
  const previewDisclosure = MOCK_DISCLOSURES.find((d) => d.id === id) || MOCK_DISCLOSURES[1];

  const handleSubmitScore = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!remarks.trim()) {
      setFormError('Please provide evaluation remarks stating the technical basis.');
      return;
    }

    setValidationSuccess(
      `Rubric validated: Novelty ${novelty}/10, Inventive Step ${inventive}/10, Applicability ${applicability}/10. Recommendation: ${recommendation}. (Simulation Mode: Database evaluation gateway is pending migration approval).`
    );
  };

  if (accessDenied) {
    return (
      <PortalShell
        role="Reviewer"
        currentPath="/reviewer/pending"
        title="Access Denied"
        subtitle="Restricted Institutional Resource"
      >
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-gray-900">Disclosure Not Assigned</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            You are not authorized to inspect this disclosure. Under institutional intellectual property rules, Reviewers can only access invention disclosures that have been formally allocated to them by the IPR Administrator.
          </p>
          <div className="pt-2">
            <Link
              href="/reviewer/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Reviewer Dashboard
            </Link>
          </div>
        </div>
      </PortalShell>
    );
  }

  const title = realDisclosure ? realDisclosure.title : previewDisclosure.title;
  const trackingNumber = realDisclosure
    ? realDisclosure.trackingNumber || 'DRAFT-PENDING'
    : previewDisclosure.trackingNumber;
  const status = realDisclosure ? realDisclosure.status : previewDisclosure.status;
  const abstractText = realDisclosure?.pidcsData?.abstract || previewDisclosure.abstract || 'No abstract provided.';
  const descriptionText =
    realDisclosure?.pidcsData?.detailedDescription ||
    previewDisclosure.detailedDescription ||
    'No detailed specification submitted.';
  const priorArtText =
    realDisclosure?.pidcsData?.priorArtDetails ||
    previewDisclosure.priorArtDetails ||
    'No prior art citations provided.';

  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/pending"
      title={title}
      subtitle={`Tracking No: ${trackingNumber} • Read-Only Technical Evaluation`}
      actions={
        <Link
          href="/reviewer/dashboard"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Connection Notice */}
        {isBackendConnected && realDisclosure ? (
          <div className="flex items-center justify-between p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-700 shrink-0" />
              <span>
                <strong>Live Database Record:</strong> Retrieved from PostgreSQL via <code>public.get_disclosure_v1</code>. Read-only review access granted.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-mono text-[10px] font-bold">
              AUTHORIZED
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>UI Preview Mode:</strong> Showing demonstration specification. Sign in as the designated Reviewer to inspect live database records.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
              PREVIEW
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-xs text-gray-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <span>Loading authorized disclosure details...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Disclosure Specification (Read-Only) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                    Abstract & Summary of Invention
                  </h3>
                  <StatusBadge status={status} size="sm" />
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">{abstractText}</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
                  Detailed Technical Specification
                </h3>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                  {descriptionText}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
                  Prior Art Citations & Differentiation
                </h3>
                <p className="text-xs text-gray-700 leading-relaxed">{priorArtText}</p>
              </div>

              {/* Research Inventors List (Read-Only) */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-gray-600" /> Institutional Research Team
                </h3>
                {consents.length > 0 ? (
                  <div className="divide-y divide-gray-100 text-xs">
                    {consents.map((c) => (
                      <div key={c.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {c.isExternal ? c.externalName : `Inventor (${c.userId?.slice(0, 8)})`}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {c.isExternal
                              ? `${c.externalEmail} • ${c.externalOrganization}`
                              : 'Parul University Affiliated'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-500 font-medium">
                            {(c.shareBasisPoints / 100).toFixed(1)}% Share
                          </span>
                          <StatusBadge status={c.status} size="sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Primary inventor only or consent records pending.</p>
                )}
              </div>
            </div>

            {/* Right Col: Technical Evaluation Scoring Form */}
            <div className="space-y-6">
              <form
                onSubmit={handleSubmitScore}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs"
              >
                <div className="border-b border-gray-100 pb-2">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-purple-600" /> Technical Scoring Sheet
                  </h3>
                  <p className="text-[11px] text-gray-400">Subject Matter Expert Panel</p>
                </div>

                {/* Gateway Pending Notice */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Pending Gateway:</strong> Reviewer scoring persistence gateway (<code>public.record_reviewer_evaluation_v1</code>) is pending migration approval. Scoring below runs rubric validation in simulation mode.
                  </div>
                </div>

                {validationSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{validationSuccess}</span>
                  </div>
                )}

                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <div className="flex justify-between font-semibold text-gray-700 mb-1">
                    <span>Novelty Rating (Section 2(1)(j))</span>
                    <span className="font-bold text-purple-700">{novelty}/10</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={novelty}
                    onChange={(e) => setNovelty(Number(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Prior art novelty & differentiation</p>
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-gray-700 mb-1">
                    <span>Inventive Step (Non-Obviousness)</span>
                    <span className="font-bold text-purple-700">{inventive}/10</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={inventive}
                    onChange={(e) => setInventive(Number(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Non-obvious to person skilled in the art</p>
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-gray-700 mb-1">
                    <span>Industrial Applicability</span>
                    <span className="font-bold text-purple-700">{applicability}/10</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={applicability}
                    onChange={(e) => setApplicability(Number(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Commercial & industrial utility</p>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Statutory Recommendation *</label>
                  <select
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="APPROVE_FOR_PATENT_FILING">Approve for Patent Filing (IPO)</option>
                    <option value="REVISE_AND_RESUBMIT">Request Technical Clarification</option>
                    <option value="REJECT">Reject (Prior Art Anticipated)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Reviewer Evaluation Remarks *</label>
                  <textarea
                    rows={4}
                    required
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="State technical basis for patentability determination under Indian Patents Act..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-xs shadow-sm transition"
                >
                  Validate & Submit Evaluation
                </button>
              </form>

              {/* Attachments preview */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3 text-xs">
                <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center justify-between">
                  <span>Attached Documents</span>
                  <span className="font-mono text-[11px] text-gray-400">
                    ({attachments.length || previewDisclosure.attachments.length})
                  </span>
                </h4>
                {attachments.length > 0 ? (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div key={att.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-gray-900">{att.fileName}</p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {(att.fileSizeBytes / 1024).toFixed(1)} KB &bull; {att.mimeType}
                          </p>
                          <StatusBadge status={att.scanStatus} size="sm" className="mt-1" />
                        </div>
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : previewDisclosure.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {previewDisclosure.attachments.map((att) => (
                      <div key={att.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{att.filename}</p>
                          <StatusBadge status={att.scanStatus} size="sm" className="mt-1" />
                        </div>
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No attachments uploaded.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
