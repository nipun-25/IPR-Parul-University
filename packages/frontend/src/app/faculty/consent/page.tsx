'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { ShieldCheck, CheckSquare } from 'lucide-react';

export default function FacultyConsentPage() {
  const consents = MOCK_DISCLOSURES.flatMap((d) =>
    d.inventors.map((inv) => ({
      ...inv,
      disclosureTitle: d.title,
      trackingNumber: d.trackingNumber
    }))
  );

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/consent"
      title="Co-Inventor Consent Signatures"
      subtitle="Track verified intellectual property assignments and institutional consent forms"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Verified Digital Consents Ledger
          </span>
          <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Legal Integrity Enforced
          </span>
        </div>

        {consents.map((c, i) => (
          <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{c.name}</span>
                <span className="text-gray-400">({c.email})</span>
                <StatusBadge status={c.consentStatus} size="sm" />
              </div>
              <p className="text-gray-500">
                Project: <strong className="text-gray-700">{c.trackingNumber}</strong> &bull; {c.disclosureTitle}
              </p>
              {c.signatureEvidence && (
                <p className="text-[10px] font-mono text-emerald-600">
                  Signed: {c.consentDate && new Date(c.consentDate).toLocaleDateString()} &bull; Token: {c.signatureEvidence}
                </p>
              )}
            </div>
            <div className="shrink-0">
              <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg">
                {c.role}
              </span>
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
