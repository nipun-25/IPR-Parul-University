'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatCard } from '../../../components/ui/StatCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_PATENT_APPLICATIONS, MOCK_DISCLOSURES, MOCK_USERS } from '../../../data/mock-portal-data';
import {
  Scale,
  PlusCircle,
  FileCheck,
  Clock,
  Award,
  ArrowRight,
  FolderLock,
  AlertTriangle
} from 'lucide-react';

export default function LegalDashboard() {
  const legalOfficer = MOCK_USERS[4]; // Adv. Meera Desai
  const filedCount = MOCK_PATENT_APPLICATIONS.filter((a) => a.currentStage === 'FILED').length;
  const examCount = MOCK_PATENT_APPLICATIONS.filter((a) => a.currentStage === 'EXAMINATION' || a.currentStage === 'HEARING').length;
  const grantedCount = MOCK_PATENT_APPLICATIONS.filter((a) => a.currentStage === 'GRANTED').length;

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/dashboard"
      title="Legal & Patent Directorate Workspace"
      subtitle={`Welcome, ${legalOfficer.name} • ${legalOfficer.department}`}
      actions={
        <Link
          href="/legal/filing"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Prepare Indian Patent Filing</span>
        </Link>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Patent Portfolio"
          value={MOCK_PATENT_APPLICATIONS.length}
          subtitle="Indian Patent Office (IPO)"
          icon={Scale}
          colorScheme="amber"
        />
        <StatCard
          title="Pending Examination"
          value={examCount}
          subtitle="FER & Hearing stages"
          icon={Clock}
          colorScheme="purple"
        />
        <StatCard
          title="Recently Filed"
          value={filedCount}
          subtitle="CBR receipts confirmed"
          icon={FileCheck}
          colorScheme="blue"
        />
        <StatCard
          title="Patents Granted"
          value={grantedCount}
          subtitle="Certificates in custody"
          icon={Award}
          colorScheme="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Active IPO Patent Filings</h2>
              <p className="text-xs text-gray-500">Live statutory tracking before the Controller of Patents</p>
            </div>
            <Link
              href="/legal/patents"
              className="text-xs font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1"
            >
              View Full Portfolio <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {MOCK_PATENT_APPLICATIONS.map((app) => (
              <div key={app.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-700">{app.applicationNumber}</span>
                    <span className="text-gray-400">&bull; {app.cbrNumber}</span>
                    <StatusBadge status={app.currentStage} size="sm" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm hover:text-amber-600 transition">
                    <Link href={`/legal/patents/${app.id}`}>{app.title}</Link>
                  </h3>
                  <p className="text-gray-500">
                    Lead: {app.leadInventor} &bull; Filed: {app.filingDate} &bull; {app.jurisdiction}
                  </p>
                </div>
                <div className="shrink-0">
                  <Link
                    href={`/legal/patents/${app.id}`}
                    className="px-3 py-1.5 font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition"
                  >
                    Manage Stages
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h2 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>Statutory Deadlines (FER / Hearing)</span>
          </h2>

          <div className="space-y-3">
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
              <span className="font-bold text-amber-900">FER Response: App 202521098412</span>
              <p className="text-amber-800">Due by Jan 15, 2027. Claims amendment under Section 3(d) required.</p>
            </div>
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1">
              <span className="font-bold text-rose-900">Oral Hearing: App 202421045100</span>
              <p className="text-rose-800">Scheduled on Dec 10, 2026 before Assistant Controller of Patents.</p>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
