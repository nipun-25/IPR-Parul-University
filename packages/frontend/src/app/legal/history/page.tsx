'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_PATENT_APPLICATIONS } from '../../../data/mock-portal-data';
import { History, Award } from 'lucide-react';

export default function LegalHistoryPage() {
  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/history"
      title="Statutory Prosecution History"
      subtitle="Complete ledger of Indian Patent Office communications, FER receipts, and hearings"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Filing & Prosecution Ledger
          </span>
          <span className="text-xs text-gray-500">Official IPO Communications</span>
        </div>

        {MOCK_PATENT_APPLICATIONS.map((app) => (
          <div key={app.id} className="p-6 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-700">
                  {app.applicationNumber} &bull; {app.cbrNumber}
                </span>
                <h4 className="text-sm font-bold text-gray-900 mt-0.5">{app.title}</h4>
              </div>
              <StatusBadge status={app.currentStage} />
            </div>

            <div className="p-3 bg-gray-50 rounded-xl space-y-2">
              <span className="font-bold text-gray-700 block">Prosecution Timeline:</span>
              {app.stagesHistory.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] text-gray-600">
                  <span>
                    &bull; <strong>{h.stage}:</strong> {h.remarks}
                  </span>
                  <span className="text-gray-400 font-mono">{new Date(h.changedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
