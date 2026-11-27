'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatCard } from '../../../components/ui/StatCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_USERS, MOCK_DISCLOSURES, MOCK_AUDIT_LOGS, MOCK_PATENT_APPLICATIONS } from '../../../data/mock-portal-data';
import {
  Shield,
  Users,
  FileText,
  UserCheck,
  Scale,
  History,
  Settings,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';

export default function AdminDashboard() {
  const admin = MOCK_USERS[5]; // Dr. Ketan Kotecha

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/dashboard"
      title="IPR Institutional Administration & Oversight"
      subtitle={`Welcome, ${admin.name} • ${admin.department}`}
      actions={
        <Link
          href="/admin/assignments"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <UserCheck className="w-4 h-4" />
          <span>Assign Reviewers</span>
        </Link>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Institutional Users"
          value={MOCK_USERS.length}
          subtitle="Students, Faculty, Reviewers"
          icon={Users}
          colorScheme="rose"
        />
        <StatCard
          title="Active Disclosures"
          value={MOCK_DISCLOSURES.length}
          subtitle="Across all university institutes"
          icon={FileText}
          colorScheme="blue"
        />
        <StatCard
          title="Patents Filed / Granted"
          value={MOCK_PATENT_APPLICATIONS.length}
          subtitle="IPO Assets under oversight"
          icon={Scale}
          colorScheme="amber"
        />
        <StatCard
          title="System Audit Events"
          value={MOCK_AUDIT_LOGS.length}
          subtitle="Immutable security logs"
          icon={History}
          colorScheme="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Institutional Disclosures Oversight</h2>
              <p className="text-xs text-gray-500">Live lifecycle tracking across all campus units</p>
            </div>
            <Link
              href="/admin/disclosures"
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1"
            >
              Manage Disclosures <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {MOCK_DISCLOSURES.map((disc) => (
              <div key={disc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-400 font-semibold">{disc.trackingNumber}</span>
                    <StatusBadge status={disc.status} size="sm" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm hover:text-rose-600 transition">
                    <Link href={`/admin/disclosures`}>{disc.title}</Link>
                  </h3>
                  <p className="text-gray-500">
                    Lead: {disc.leadInventor.name} &bull; {disc.department}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <Link
                    href={`/admin/assignments`}
                    className="px-3 py-1.5 font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
                  >
                    Reviewer Assignment
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-rose-600" />
              <span>Recent Security Events</span>
            </h2>
            <Link href="/admin/audit" className="text-rose-600 font-semibold hover:underline">
              Audit
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {MOCK_AUDIT_LOGS.slice(0, 4).map((log) => (
              <div key={log.id} className="py-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{log.action}</span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-gray-500 text-[11px] truncate">{log.targetResource}</p>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>Actor: {log.actorName}</span>
                  <span className="font-semibold text-emerald-600">{log.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
