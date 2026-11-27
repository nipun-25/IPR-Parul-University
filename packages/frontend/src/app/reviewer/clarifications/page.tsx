'use client';

import React, { useState } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { Send, CheckCircle2, HelpCircle } from 'lucide-react';

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

      {newQueryModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Issue Technical Clarification Query</h3>
            {dispatched ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Clarification request dispatched to lead inventor!</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Specify details regarding missing experimental parameters, stability data, or prior art citations.
                </p>
                <textarea
                  rows={4}
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="State the technical query clearly..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setNewQueryModal(false);
                  setDispatched(false);
                }}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
              {!dispatched && (
                <button
                  type="button"
                  onClick={() => setDispatched(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
                >
                  Send to Inventor
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
