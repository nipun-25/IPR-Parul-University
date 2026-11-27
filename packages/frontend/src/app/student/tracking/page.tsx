'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES } from '../../../data/mock-portal-data';
import { Clock, CheckCircle2, CircleDot, ArrowRight } from 'lucide-react';

export default function StudentTrackingPage() {
  const disclosure = MOCK_DISCLOSURES[0];

  const timeline = [
    {
      title: 'Invention Disclosure Created',
      date: '2026-11-20',
      status: 'Completed',
      desc: 'Initial PIDCS parameters established.'
    },
    {
      title: 'Inventor Consents Secured',
      date: '2026-11-24',
      status: 'Completed',
      desc: 'All 3 internal and external inventors digitally signed consent.'
    },
    {
      title: 'Specification Antivirus Cleared',
      date: '2026-11-24',
      status: 'Completed',
      desc: 'ClamAV scanner certified 0 threats detected.'
    },
    {
      title: 'Institutional Submission',
      date: '2026-11-24',
      status: 'Completed',
      desc: 'Tracking number PU-IPR-2026-0042 assigned.'
    },
    {
      title: 'Technical Reviewer Evaluation',
      date: 'In Progress',
      status: 'Active',
      desc: 'Assigned to Prof. Vikramaditya Joshi (EEE Panel).'
    },
    {
      title: 'IPR Committee Approval & Patent Drafting',
      date: 'Upcoming',
      status: 'Pending',
      desc: 'Handover to Legal Team for Indian Patent Office filing.'
    }
  ];

  return (
    <PortalShell
      role="Student"
      currentPath="/student/tracking"
      title="Submission Lifecycle Tracking"
      subtitle="Live end-to-end progress tracker from disclosure draft to Indian Patent Office filing"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-2">
          <div>
            <span className="text-xs font-mono font-semibold text-gray-400">{disclosure.trackingNumber}</span>
            <h3 className="text-base font-bold text-gray-900">{disclosure.title}</h3>
          </div>
          <StatusBadge status={disclosure.status} />
        </div>

        {/* Vertical Stepper Timeline */}
        <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200">
          {timeline.map((step, idx) => {
            const isCompleted = step.status === 'Completed';
            const isActive = step.status === 'Active';
            return (
              <div key={idx} className="relative flex items-start gap-4 text-xs">
                <span
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isActive
                      ? 'bg-blue-600 text-white animate-pulse'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <CircleDot className="w-3.5 h-3.5" />
                  )}
                </span>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 text-sm">{step.title}</h4>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : isActive
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>
                  <p className="text-gray-500 mt-0.5">{step.desc}</p>
                  <span className="text-[10px] text-gray-400 font-mono mt-1 block">{step.date}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PortalShell>
  );
}
