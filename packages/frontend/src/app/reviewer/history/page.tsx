'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { History, Award } from 'lucide-react';

export default function ReviewerHistoryPage() {
  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/history"
      title="Completed Reviews & Audit History"
      subtitle="Historical log of all completed technical evaluations and patent recommendations"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Evaluation Log Archive
          </span>
          <span className="text-xs text-gray-500">Parul University Institutional Records</span>
        </div>

        {MOCK_DISCLOSURES.filter((d) => d.evaluation).map((d) => (
          <div key={d.id} className="p-6 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-mono text-gray-400 font-semibold">{d.trackingNumber}</span>
                <h4 className="text-sm font-bold text-gray-900 mt-0.5">{d.title}</h4>
              </div>
              <StatusBadge status={d.status} />
            </div>
            <p className="text-gray-500">{d.fieldOfInvention}</p>
            <div className="p-3 bg-purple-50/50 rounded-xl text-purple-900 text-[11px]">
              Recommendation: <strong>{d.evaluation?.recommendation.replace(/_/g, ' ')}</strong> &bull; Completed on{' '}
              {d.evaluation?.submittedAt && new Date(d.evaluation.submittedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
