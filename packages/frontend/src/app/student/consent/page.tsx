'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { CheckSquare, ShieldCheck, Clock, AlertCircle } from 'lucide-react';

export default function StudentConsentStatusPage() {
  const consents = MOCK_DISCLOSURES.flatMap((d) =>
    d.inventors.map((inv) => ({
      ...inv,
      disclosureTitle: d.title,
      trackingNumber: d.trackingNumber
    }))
  );

  return (
    <PortalShell
      role="Student"
      currentPath="/student/consent"
      title="Inventor Consent Verification Status"
      subtitle="Track digital signatures and formal consent authorizations across all co-inventors"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-semibold uppercase">Total Invitations</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{consents.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-emerald-600 font-semibold uppercase">Verified Consents</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">
            {consents.filter((c) => c.consentStatus === 'VERIFIED').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-amber-600 font-semibold uppercase">Pending Signatures</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">
            {consents.filter((c) => c.consentStatus === 'PENDING').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Consent Audit & Verification Ledger</h3>
          <span className="text-xs text-gray-400 font-medium">Immutable digital records</span>
        </div>
        <div className="divide-y divide-gray-100">
          {consents.map((item, idx) => (
            <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-sm">{item.name}</span>
                  <span className="text-[11px] font-mono text-gray-400">({item.email})</span>
                  <StatusBadge status={item.consentStatus} size="sm" />
                </div>
                <p className="text-gray-500">
                  Disclosure: <strong className="text-gray-700">{item.trackingNumber}</strong> &bull; {item.disclosureTitle}
                </p>
                {item.signatureEvidence && (
                  <p className="text-[10px] font-mono text-emerald-600">
                    Verification Method: {item.signatureEvidence} {item.consentDate && `• Signed on ${new Date(item.consentDate).toLocaleString()}`}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {item.consentStatus === 'PENDING' ? (
                  <button className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition">
                    Resend Reminder
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                    <ShieldCheck className="w-4 h-4" /> Legally Valid
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
