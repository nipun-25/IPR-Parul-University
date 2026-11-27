'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PortalShell } from '../../../../components/layout/PortalShell';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../../data/mock-portal-data';
import { ArrowLeft, Users, Paperclip, Award, Scale, Download } from 'lucide-react';

export default function FacultyDisclosureDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const disclosure = MOCK_DISCLOSURES.find((d) => d.id === id) || MOCK_DISCLOSURES[2];

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/disclosures"
      title={disclosure.title}
      subtitle={`Tracking No: ${disclosure.trackingNumber} • Lead: ${disclosure.leadInventor.name}`}
      actions={
        <Link
          href="/faculty/disclosures"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Disclosures</span>
        </Link>
      }
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Stage:</span>
          <StatusBadge status={disclosure.status} />
        </div>
        <div className="text-gray-400">
          Created: {new Date(disclosure.createdAt).toLocaleDateString()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
              Abstract & Novelty
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">{disclosure.abstract}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
              Specification & Experimental Data
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
              {disclosure.detailedDescription}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <Users className="w-4 h-4 text-emerald-600" /> Research Co-Authors
            </h3>
            <div className="space-y-2">
              {disclosure.inventors.map((inv) => (
                <div key={inv.id} className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">{inv.name}</span>
                    <StatusBadge status={inv.consentStatus} size="sm" />
                  </div>
                  <p className="text-[11px] text-gray-400">{inv.email}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <Paperclip className="w-4 h-4 text-emerald-600" /> Uploaded Schematics
            </h3>
            <div className="space-y-2">
              {disclosure.attachments.map((att) => (
                <div key={att.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-gray-900">{att.filename}</p>
                    <StatusBadge status={att.scanStatus} size="sm" className="mt-1" />
                  </div>
                  <Download className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
