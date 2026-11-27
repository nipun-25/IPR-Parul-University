'use client';

import React, { useState } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, MOCK_USERS } from '../../../data/mock-portal-data';
import { UserCheck, CheckCircle2 } from 'lucide-react';

export default function AdminAssignmentsPage() {
  const reviewers = MOCK_USERS.filter((u) => u.role === 'Reviewer');
  const [assignedStatus, setAssignedStatus] = useState<Record<string, string>>({});
  const [successId, setSuccessId] = useState<string | null>(null);

  const handleAssign = (disclosureId: string, reviewerName: string) => {
    setAssignedStatus((prev) => ({ ...prev, [disclosureId]: reviewerName }));
    setSuccessId(disclosureId);
    setTimeout(() => setSuccessId(null), 3000);
  };

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/assignments"
      title="Reviewer Allocation & Assignments"
      subtitle="Assign submitted disclosures to qualified subject matter expert reviewers"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Disclosures Awaiting Reviewer Assignment
          </span>
          <span className="text-xs text-rose-700 font-semibold">Committee Allocation</span>
        </div>

        {MOCK_DISCLOSURES.map((disc) => {
          const currentReviewer = assignedStatus[disc.id] || disc.assignedReviewer?.name || 'Prof. Vikramaditya Joshi';
          return (
            <div key={disc.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-gray-400 font-semibold">{disc.trackingNumber}</span>
                  <StatusBadge status={disc.status} size="sm" />
                </div>
                <h4 className="text-sm font-bold text-gray-900">{disc.title}</h4>
                <p className="text-gray-500">
                  Lead: {disc.leadInventor.name} &bull; Domain: {disc.fieldOfInvention}
                </p>
                {successId === disc.id && (
                  <p className="text-emerald-700 font-semibold flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Allocated to {currentReviewer}!
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  defaultValue={currentReviewer}
                  onChange={(e) => handleAssign(disc.id, e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-xl bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  {reviewers.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} ({r.department})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleAssign(disc.id, currentReviewer)}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs shadow-sm transition"
                >
                  Save
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </PortalShell>
  );
}
