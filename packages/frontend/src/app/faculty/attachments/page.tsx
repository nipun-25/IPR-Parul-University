'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { Paperclip, Download, UploadCloud } from 'lucide-react';

export default function FacultyAttachmentsPage() {
  const attachments = MOCK_DISCLOSURES.flatMap((d) =>
    d.attachments.map((a) => ({ ...a, disclosureTitle: d.title, trackingNumber: d.trackingNumber }))
  );

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/attachments"
      title="Research Lab Specifications & Attachments"
      subtitle="Antivirus-screened experimental protocols, patent drawings, and chromatograms"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Certified Scientific Documents
          </span>
          <span className="text-xs text-gray-500">ClamAV Quarantine Verified</span>
        </div>

        {attachments.map((att) => (
          <div key={att.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{att.filename}</span>
                <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                  {att.category}
                </span>
                <StatusBadge status={att.scanStatus} size="sm" />
              </div>
              <p className="text-gray-500">
                Invention: <strong>{att.trackingNumber}</strong> &bull; {att.disclosureTitle}
              </p>
              <p className="text-[10px] font-mono text-gray-400">
                SHA-256: {att.sha256} &bull; {(att.sizeBytes / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition shrink-0">
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Download File</span>
            </button>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
