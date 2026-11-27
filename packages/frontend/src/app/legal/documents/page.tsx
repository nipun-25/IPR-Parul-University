'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_PATENT_APPLICATIONS, MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { FolderLock, Download, ShieldCheck, FileText } from 'lucide-react';

export default function LegalDocumentsPage() {
  const documents = MOCK_DISCLOSURES.flatMap((d) =>
    d.attachments.map((a) => ({ ...a, disclosureTitle: d.title, trackingNumber: d.trackingNumber }))
  );

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/documents"
      title="Official Patent Documents & Legal Filings"
      subtitle="Form 1 (Application), Form 2 (Provisional/Complete), Form 3, Form 5, and certified claims"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Certified Statutory Document Vault
          </span>
          <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Legal Custody
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
                Associated: <strong className="text-gray-700">{doc.trackingNumber}</strong> &bull; {doc.disclosureTitle}
              </p>
              <p className="text-[10px] font-mono text-gray-400">
                SHA-256: {doc.sha256} &bull; {(doc.sizeBytes / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1.5 transition shrink-0">
              <Download className="w-3.5 h-3.5" />
              <span>Download Vault Copy</span>
            </button>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
