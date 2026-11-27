'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_PATENT_APPLICATIONS } from '../../../data/mock-portal-data';
import { PATENT_STAGES } from '../../../data/mock-portal-data';
import { Clock, ArrowRight, Scale } from 'lucide-react';

export default function LegalStagesPage() {
  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/stages"
      title="Patent Stage Tracking (IPO Lifecycle)"
      subtitle="Comprehensive overview of all institutional patents across the 7 statutory examination stages"
    >
      <div className="space-y-6">
        {/* Stage Buckets Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {PATENT_STAGES.map((st) => {
            const count = MOCK_PATENT_APPLICATIONS.filter((a) => a.currentStage === st).length;
            return (
              <div key={st} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{st}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Detailed Application Progression */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
          <div className="p-4 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Statutory Stage Audit Records
            </span>
            <span className="text-xs text-amber-700 font-semibold">Real-time IPO Sync</span>
          </div>

          {MOCK_PATENT_APPLICATIONS.map((app) => (
            <div key={app.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-indigo-700">{app.applicationNumber}</span>
                  <StatusBadge status={app.currentStage} size="sm" />
                </div>
                <h4 className="font-bold text-gray-900 text-sm">{app.title}</h4>
                <p className="text-gray-500">
                  Lead: {app.leadInventor} &bull; Next Deadline: {app.nextDeadline || 'None pending'}
                </p>
              </div>
              <Link
                href={`/legal/patents/${app.id}`}
                className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition shrink-0"
              >
                Inspect Stages
              </Link>
            </div>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
