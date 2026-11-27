'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { MessageSquare, FileText, CheckCircle2 } from 'lucide-react';

export default function ReviewerCommentsPage() {
  const evaluations = MOCK_DISCLOSURES.filter((d) => d.evaluation);

  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/comments"
      title="Peer Review Comments & Observations"
      subtitle="Exhaustive qualitative remarks and confidential patentability feedback"
    >
      <div className="space-y-6">
        {evaluations.map((d) => (
          <div key={d.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="font-bold text-gray-900 text-sm">{d.title}</span>
              <span className="font-mono text-gray-400">{d.trackingNumber}</span>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-gray-800">Formal Panel Remarks:</span>
              <p className="text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed">
                {d.evaluation?.detailedRemarks}
              </p>
            </div>

            {d.evaluation?.confidentialNotes && (
              <div className="space-y-1">
                <span className="font-bold text-amber-800">Confidential Committee Notes (IPR Cell Only):</span>
                <p className="text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 leading-relaxed">
                  {d.evaluation.confidentialNotes}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
