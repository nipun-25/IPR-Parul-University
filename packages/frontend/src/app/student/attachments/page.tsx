'use client';

import React, { useState } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, type MockAttachment } from '../../../data/mock-portal-data';
import { Paperclip, UploadCloud, Download, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function StudentAttachmentsPage() {
  const allAttachments = MOCK_DISCLOSURES.flatMap((d) =>
    d.attachments.map((a) => ({ ...a, disclosureTitle: d.title, trackingNumber: d.trackingNumber }))
  );

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  return (
    <PortalShell
      role="Student"
      currentPath="/student/attachments"
      title="Supporting Documents & Attachments"
      subtitle="Antivirus-quarantined specification documents, CAD schematics, and experimental data"
      actions={
        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      }
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Quarantine & Antivirus Verified Files</h3>
          <span className="text-xs text-gray-400">ClamAV Scanning Invariant Enforced</span>
        </div>

        <div className="divide-y divide-gray-100">
          {allAttachments.map((att) => (
            <div key={att.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-sm">{att.filename}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                    {att.category}
                  </span>
                  <StatusBadge status={att.scanStatus} size="sm" />
                </div>
                <p className="text-gray-500">
                  Associated: <strong className="text-gray-700">{att.trackingNumber}</strong> &bull; {att.disclosureTitle}
                </p>
                <p className="text-[10px] font-mono text-gray-400 truncate max-w-xl">
                  SHA-256: {att.sha256} &bull; {(att.sizeBytes / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg flex items-center gap-1.5 transition">
                  <Download className="w-3.5 h-3.5 text-gray-500" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Upload Attachment</h3>
            <p className="text-xs text-gray-500">
              Files are automatically stored in an isolated quarantine bucket and scanned by ClamAV before promotion.
            </p>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center space-y-2 hover:border-blue-500 transition cursor-pointer">
              <UploadCloud className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="text-xs font-semibold text-gray-700">Drag & drop PDF / CAD file or Browse</p>
              <p className="text-[10px] text-gray-400">Max size 25MB &bull; PDF, DOCX, ZIP, DWG</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
