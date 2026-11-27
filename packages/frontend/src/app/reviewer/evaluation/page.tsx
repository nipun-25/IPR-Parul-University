'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { Award, CheckCircle2, Star } from 'lucide-react';

export default function ReviewerEvaluationPage() {
  const evaluations = MOCK_DISCLOSURES.filter((d) => d.evaluation).map((d) => ({
    ...d.evaluation!,
    title: d.title,
    trackingNumber: d.trackingNumber
  }));

  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/evaluation"
      title="Technical Evaluation Ledgers"
      subtitle="Complete scoring rubrics covering novelty, inventive step and commercial viability"
    >
      <div className="space-y-6">
        {evaluations.map((ev) => (
          <div key={ev.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
              <div>
                <span className="font-mono text-xs font-semibold text-gray-400">{ev.trackingNumber}</span>
                <h3 className="text-base font-bold text-gray-900">{ev.title}</h3>
              </div>
              <span className="font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                {ev.recommendation.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="text-gray-500 block">Novelty</span>
                <span className="text-base font-bold text-purple-700">{ev.noveltyScore} / 10</span>
              </div>
              <div>
                <span className="text-gray-500 block">Inventive Step</span>
                <span className="text-base font-bold text-purple-700">{ev.inventiveStepScore} / 10</span>
              </div>
              <div>
                <span className="text-gray-500 block">Industrial Utility</span>
                <span className="text-base font-bold text-purple-700">{ev.industrialApplicabilityScore} / 10</span>
              </div>
              <div>
                <span className="text-gray-500 block">Commercial Potential</span>
                <span className="text-base font-bold text-purple-700">{ev.commercialViabilityScore} / 10</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-gray-800">Evaluator Technical Remarks:</span>
              <p className="text-gray-600 leading-relaxed bg-purple-50/40 p-3 rounded-lg border border-purple-100">
                {ev.detailedRemarks}
              </p>
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
