'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_PATENT_APPLICATIONS, MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { History, Scale, Award, ArrowUpRight } from 'lucide-react';

export default function FacultyHistoryPage() {
  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/history"
      title="Submission & Patent Filing History"
      subtitle="Complete chronological track record of faculty inventions filed before the Indian Patent Office"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Official Indian Patent Office (IPO) Filings</h3>
          <span className="text-xs text-gray-400 font-medium">University Asset Ledger</span>
        </div>

        <div className="divide-y divide-gray-100">
          {MOCK_PATENT_APPLICATIONS.map((app) => (
            <div key={app.id} className="p-6 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-bold text-indigo-700">
                    IPO App No: {app.applicationNumber} &bull; {app.cbrNumber}
                  </span>
                  <h4 className="text-sm font-bold text-gray-900 mt-0.5">{app.title}</h4>
                </div>
                <StatusBadge status={app.currentStage} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-xl text-gray-600">
                <div>
                  <span className="font-semibold block text-gray-800">Lead Inventor:</span>
                  {app.leadInventor} ({app.department})
                </div>
                <div>
                  <span className="font-semibold block text-gray-800">Filing Date:</span>
                  {app.filingDate}
                </div>
                <div>
                  <span className="font-semibold block text-gray-800">Assigned Attorney:</span>
                  {app.attorneyAssigned}
                </div>
              </div>

              {app.nextDeadline && (
                <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">
                  Upcoming Statutory Deadline: {app.nextDeadline}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
