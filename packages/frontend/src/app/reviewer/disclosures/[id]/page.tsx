'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PortalShell } from '../../../../components/layout/PortalShell';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { ConfirmModal } from '../../../../components/ui/ConfirmModal';
import { MOCK_DISCLOSURES } from '../../../../data/mock-portal-data';
import { Award, ArrowLeft, Send, CheckCircle2, FileText, Download } from 'lucide-react';

export default function ReviewerDisclosureDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const disclosure = MOCK_DISCLOSURES.find((d) => d.id === id) || MOCK_DISCLOSURES[1];

  const [novelty, setNovelty] = useState(8);
  const [inventive, setInventive] = useState(8);
  const [applicability, setApplicability] = useState(9);
  const [recommendation, setRecommendation] = useState<'APPROVE_FOR_PATENT_FILING' | 'REVISE_AND_RESUBMIT' | 'REJECT'>('APPROVE_FOR_PATENT_FILING');
  const [remarks, setRemarks] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmitScore = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
  };

  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/pending"
      title={disclosure.title}
      subtitle={`Tracking No: ${disclosure.trackingNumber} • Lead: ${disclosure.leadInventor.name}`}
      actions={
        <Link
          href="/reviewer/pending"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Queue</span>
        </Link>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Disclosure Specification */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
              Abstract & Novelty Claims
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">{disclosure.abstract}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
              Detailed Technical Specification
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
              {disclosure.detailedDescription}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
              Prior Art & Differentiation
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">{disclosure.priorArtDetails}</p>
          </div>
        </div>

        {/* Right Col: Technical Evaluation Scoring Form */}
        <div className="space-y-6">
          <form onSubmit={handleSubmitScore} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
            <div className="border-b border-gray-100 pb-2">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-purple-600" /> Technical Scoring Sheet
              </h3>
              <p className="text-[11px] text-gray-400">Institutional Review Panel</p>
            </div>

            {saved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Evaluation submitted to Legal Cell!</span>
              </div>
            )}

            <div>
              <div className="flex justify-between font-semibold text-gray-700 mb-1">
                <span>Novelty Rating</span>
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
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Statutory Recommendation *</label>
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="APPROVE_FOR_PATENT_FILING">Approve for Patent Filing (IPO)</option>
                <option value="REVISE_AND_RESUBMIT">Request Technical Clarification</option>
                <option value="REJECT">Reject (Prior Art Anticipated)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Reviewer Evaluation Remarks</label>
              <textarea
                rows={4}
                required
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="State technical basis for patentability determination..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-sm transition"
            >
              Submit Evaluation
            </button>
          </form>

          {/* Attachments preview */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3 text-xs">
            <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-2">
              Attached Specifications ({disclosure.attachments.length})
            </h4>
            {disclosure.attachments.map((att) => (
              <div key={att.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{att.filename}</p>
                  <StatusBadge status={att.scanStatus} size="sm" className="mt-1" />
                </div>
                <Download className="w-4 h-4 text-gray-400 hover:text-gray-700 cursor-pointer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
