'use client';

import React, { useState } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { Send, CheckCircle2, HelpCircle, AlertCircle } from 'lucide-react';

export default function ReviewerClarificationsPage() {
  const clarifications = MOCK_DISCLOSURES.flatMap((d) =>
    d.clarifications.map((c) => ({ ...c, disclosureTitle: d.title, trackingNumber: d.trackingNumber }))
  );

  const [newQueryModal, setNewQueryModal] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [dispatched, setDispatched] = useState(false);

  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/clarifications"
      title="Issued Clarification Requests"
      subtitle="Formal technical queries issued to inventors during evaluation"
      actions={
        <button
          onClick={() => setNewQueryModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Issue New Query</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Pending Migration Banner */}
        <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Gateway Status (Pending Migration):</strong> The formal inventor clarification and response gateway (<code>create_clarification_query_v1</code>) is pending database migration approval. Showing demonstration queries.
            </span>
          </div>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
            PREVIEW / PENDING GATEWAY
          </span>
        </div>

        {clarifications.map((cl) => (
          <div key={cl.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
              <div>
                <span className="font-mono text-gray-400 font-semibold">{cl.trackingNumber}</span>
                <h4 className="text-sm font-bold text-gray-900">{cl.disclosureTitle}</h4>
              </div>
              <StatusBadge status={cl.status} size="sm" />
            </div>

            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1 text-purple-900">
              <span className="font-bold">Your Query:</span>
              <p className="leading-relaxed">{cl.query}</p>
            </div>

            {cl.response && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1 text-emerald-900">
                <div className="flex justify-between font-bold">
                  <span>Inventor Response:</span>
                  <span className="text-[10px] text-emerald-700">{cl.respondedAt && new Date(cl.respondedAt).toLocaleDateString()}</span>
                </div>
                <p className="leading-relaxed">{cl.response}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
