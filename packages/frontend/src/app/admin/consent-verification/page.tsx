'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { CheckSquare, ShieldCheck } from 'lucide-react';

export default function AdminConsentVerificationPage() {
  const consents = MOCK_DISCLOSURES.flatMap((d) =>
    d.inventors.map((inv) => ({ ...inv, disclosureTitle: d.title, trackingNumber: d.trackingNumber }))
  );

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/consent-verification"
      title="Institutional Inventor Consent Oversight"
      subtitle="Audit and verification ledger of digital signature authorizations across all inventions"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Institutional Consent Evidence Ledger
          </span>
          <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Cryptographic Assertions Verified
          </span>
        </div>

        {consents.map((c, i) => (
          <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{c.name}</span>
                <span className="text-gray-400 font-mono">({c.email})</span>
                <StatusBadge status={c.consentStatus} size="sm" />
              </div>
              <p className="text-gray-500">
                Invention: <strong className="text-gray-700">{c.trackingNumber}</strong> &bull; {c.disclosureTitle}
              </p>
              <p className="text-[10px] font-mono text-gray-400">
                Evidence: {c.signatureEvidence || 'PENDING_INVITATION'} &bull; Date: {c.consentDate || 'Awaiting Action'}
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-2.5 py-1 bg-gray-100 text-gray-700 font-medium rounded-lg text-xs">
                {c.affiliation}
              </span>
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
