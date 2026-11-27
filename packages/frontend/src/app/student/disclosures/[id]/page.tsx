'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PortalShell } from '../../../../components/layout/PortalShell';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { ConfirmModal } from '../../../../components/ui/ConfirmModal';
import { MOCK_DISCLOSURES } from '../../../../data/mock-portal-data';
import {
  FileText,
  Users,
  Paperclip,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Send,
  Download
} from 'lucide-react';

export default function StudentDisclosureDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const disclosure = MOCK_DISCLOSURES.find((d) => d.id === id) || MOCK_DISCLOSURES[0];

  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submitted, setSubmitted] = useState(disclosure.status !== 'DRAFT');

  return (
    <PortalShell
      role="Student"
      currentPath="/student/disclosures"
      title={disclosure.title}
      subtitle={`Tracking No: ${disclosure.trackingNumber} • Lead: ${disclosure.leadInventor.name}`}
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/student/disclosures"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Disclosures</span>
          </Link>
          <Link
            href={`/disclosures/${disclosure.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <span>Live Workspace</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          {disclosure.status === 'DRAFT' && !submitted && (
            <button
              onClick={() => setConfirmSubmitOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Final Submit</span>
            </button>
          )}
        </div>
      }
    >
      {/* Status Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium">Lifecycle Status:</span>
          <StatusBadge status={submitted ? 'SUBMITTED' : disclosure.status} />
        </div>
        <div className="text-xs text-gray-400">
          Created: {new Date(disclosure.createdAt).toLocaleDateString()} &bull; Last updated:{' '}
          {new Date(disclosure.updatedAt).toLocaleDateString()}
        </div>
      </div>

      {/* Tabs / Multi-card content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Invention Specification */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider text-xs border-b border-gray-100 pb-2">
              1. Technical Abstract
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">{disclosure.abstract}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider text-xs border-b border-gray-100 pb-2">
              2. Detailed Description & Working Principle
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
              {disclosure.detailedDescription}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider text-xs border-b border-gray-100 pb-2">
              3. Commercial Potential & Prior Art
            </h3>
            <div className="space-y-3 text-xs text-gray-600">
              <div>
                <span className="font-semibold text-gray-800">Commercial Market:</span>{' '}
                {disclosure.commercialPotential}
              </div>
              <div>
                <span className="font-semibold text-gray-800">Prior Art Differentiation:</span>{' '}
                {disclosure.priorArtDetails}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Inventors & Attachments */}
        <div className="space-y-6">
          {/* Inventors Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" /> Inventors ({disclosure.inventors.length})
              </h3>
              <Link href="/student/inventors" className="text-[11px] text-blue-600 font-semibold hover:underline">
                Manage
              </Link>
            </div>
            <div className="space-y-3">
              {disclosure.inventors.map((inv) => (
                <div key={inv.id} className="p-3 bg-gray-50 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">{inv.name}</span>
                    <StatusBadge status={inv.consentStatus} size="sm" />
                  </div>
                  <p className="text-[11px] text-gray-500">{inv.email}</p>
                  <p className="text-[10px] text-gray-400">{inv.role} &bull; {inv.affiliation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Attachments Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-emerald-600" /> Attachments ({disclosure.attachments.length})
              </h3>
              <Link href="/student/attachments" className="text-[11px] text-emerald-600 font-semibold hover:underline">
                Upload
              </Link>
            </div>
            <div className="space-y-2.5">
              {disclosure.attachments.map((att) => (
                <div key={att.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{att.filename}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{(att.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                      <StatusBadge status={att.scanStatus} size="sm" />
                    </div>
                  </div>
                  <button className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        onConfirm={() => {
          setSubmitted(true);
          setConfirmSubmitOpen(false);
        }}
        title="Submit Invention Disclosure?"
        message="Once submitted, the disclosure becomes read-only and transitions to the Reviewer panel for technical evaluation."
        confirmText="Confirm & Submit"
        variant="info"
      />
    </PortalShell>
  );
}
