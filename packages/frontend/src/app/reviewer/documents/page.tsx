'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { Eye, FileText, Download, ShieldCheck } from 'lucide-react';

export default function ReviewerDocumentsPage() {
  const documents = MOCK_DISCLOSURES.flatMap((d) =>
    d.attachments.map((a) => ({ ...a, disclosureTitle: d.title, trackingNumber: d.trackingNumber }))
  );

  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/documents"
      title="Secure Document & Specification Viewer"
      subtitle="Antivirus-screened invention specifications, CAD drawings, and clinical test logs"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Quarantine Certified Attachments
          </span>
          <span className="text-xs text-purple-700 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Integrity Verified
          </span>
        </div>

        {documents.map((doc) => (
          <div key={doc.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{doc.filename}</span>
                <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-semibold">
                  {doc.category}
                </span>
                <StatusBadge status={doc.scanStatus} size="sm" />
              </div>
              <p className="text-gray-500">
                Disclosure: <strong className="text-gray-700">{doc.trackingNumber}</strong> &bull; {doc.disclosureTitle}
              </p>
              <p className="text-[10px] font-mono text-gray-400">
                SHA-256: {doc.sha256} &bull; {(doc.sizeBytes / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1.5 transition">
                <Eye className="w-3.5 h-3.5" />
                <span>Open Viewer</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
