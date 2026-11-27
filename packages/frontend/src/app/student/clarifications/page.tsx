'use client';

import React, { useState } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { HelpCircle, Send, CheckCircle2, MessageSquare } from 'lucide-react';

export default function StudentClarificationsPage() {
  const allClarifications = MOCK_DISCLOSURES.flatMap((d) =>
    d.clarifications.map((c) => ({ ...c, disclosureTitle: d.title, trackingNumber: d.trackingNumber }))
  );

  const [replyText, setReplyText] = useState('');
  const [activeClarId, setActiveClarId] = useState<string | null>(null);

  return (
    <PortalShell
      role="Student"
      currentPath="/student/clarifications"
      title="Revision & Clarification Requests"
      subtitle="Direct queries and amendment requests issued by peer technical reviewers"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Technical Reviewer Queries</h3>
          <span className="text-xs text-gray-400 font-medium">Peer Dialogue Channel</span>
        </div>

        <div className="divide-y divide-gray-100">
          {allClarifications.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-xs">
              No pending clarification queries for your active invention disclosures.
            </div>
          ) : (
            allClarifications.map((item) => (
              <div key={item.id} className="p-6 space-y-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-mono font-semibold text-gray-400">
                      {item.trackingNumber} &bull; {item.disclosureTitle}
                    </span>
                    <h4 className="text-sm font-bold text-gray-900">Query from {item.requestedBy}</h4>
                  </div>
                  <StatusBadge status={item.status} size="sm" />
                </div>

                <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-xl text-purple-900 leading-relaxed">
                  <span className="font-semibold block mb-1">Reviewer Remark:</span>
                  {item.query}
                </div>

                {item.response ? (
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl text-emerald-900 leading-relaxed">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">Your Response:</span>
                      <span className="text-[10px] text-emerald-600">
                        {item.respondedAt && new Date(item.respondedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {item.response}
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your technical clarification response and attach reference citations..."
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Response</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </PortalShell>
  );
}
