'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { Clock, Award, ArrowRight } from 'lucide-react';

export default function ReviewerPendingPage() {
  const pending = MOCK_DISCLOSURES.filter((d) => d.status === 'UNDER_REVIEW' || d.status === 'SUBMITTED');

  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/pending"
      title="Pending Technical Reviews"
      subtitle="Disclosures actively awaiting statutory novelty, inventive step and patentability scoring"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Priority Scoring Queue ({pending.length})
          </span>
          <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
            <Clock className="w-4 h-4" /> 14-day SLA Target
          </span>
        </div>

        {pending.map((disc) => (
          <div key={disc.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="font-mono text-gray-400 font-semibold">{disc.trackingNumber}</span>
                <StatusBadge status={disc.status} size="sm" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">{disc.title}</h4>
              <p className="text-gray-500 leading-relaxed">{disc.abstract}</p>
              <div className="pt-1 flex items-center gap-3 text-gray-400">
                <span>Lead: {disc.leadInventor.name}</span>
                <span>&bull;</span>
                <span>Submitted: {disc.submittedAt && new Date(disc.submittedAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <Link
                href={`/reviewer/disclosures/${disc.id}`}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <Award className="w-4 h-4" />
                <span>Evaluate</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
