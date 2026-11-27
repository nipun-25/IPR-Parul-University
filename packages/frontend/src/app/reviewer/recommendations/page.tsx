'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { CheckSquare, Award, ArrowUpRight } from 'lucide-react';

export default function ReviewerRecommendationsPage() {
  const evaluations = MOCK_DISCLOSURES.filter((d) => d.evaluation);

  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/recommendations"
      title="Statutory Recommendations Ledger"
      subtitle="Final panel determinations communicated to Dean of R&D and Legal Cell"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Formally Submitted Determinations
          </span>
          <span className="text-xs text-purple-700 font-semibold">Institutional Governance</span>
        </div>

        {evaluations.map((d) => (
          <div key={d.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-1.5 max-w-2xl">
              <span className="font-mono text-gray-400 font-semibold">{d.trackingNumber}</span>
              <h4 className="text-sm font-bold text-gray-900">{d.title}</h4>
              <p className="text-gray-500">{d.fieldOfInvention}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="px-3 py-1.5 font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl">
                {d.evaluation?.recommendation.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
