'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatCard } from '../../../components/ui/StatCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, MOCK_USERS } from '../../../data/mock-portal-data';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  UploadCloud
} from 'lucide-react';

export default function StudentDashboard() {
  const student = MOCK_USERS[0];
  const studentDisclosures = MOCK_DISCLOSURES.filter(
    (d) => d.leadInventor.id === student.id
  );

  const draftsCount = studentDisclosures.filter((d) => d.status === 'DRAFT').length;
  const submittedCount = studentDisclosures.filter((d) => d.status === 'SUBMITTED').length;
  const underReviewCount = studentDisclosures.filter((d) => d.status === 'UNDER_REVIEW').length;

  return (
    <PortalShell
      role="Student"
      currentPath="/student/dashboard"
      title="Student Innovator Dashboard"
      subtitle={`Welcome, ${student.name} • ${student.department}`}
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/student/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Disclosure</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <span>Live Backend Mode</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      }
    >
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Disclosures"
          value={studentDisclosures.length}
          subtitle="All filed innovations"
          icon={FileText}
          colorScheme="blue"
        />
        <StatCard
          title="Active Drafts"
          value={draftsCount}
          subtitle="Pending completion"
          icon={Clock}
          colorScheme="amber"
        />
        <StatCard
          title="Submitted"
          value={submittedCount}
          subtitle="Under institutional review"
          icon={CheckCircle2}
          colorScheme="indigo"
        />
        <StatCard
          title="Inventor Consents"
          value="100%"
          subtitle="3 of 3 signatures verified"
          icon={ShieldCheck}
          colorScheme="emerald"
        />
      </div>

      {/* Main Grid: My Inventions & Quick Workflow Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Disclosures Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">My Intellectual Property Disclosures</h2>
              <p className="text-xs text-gray-500">Track and manage your submitted patent invention disclosures</p>
            </div>
            <Link
              href="/student/disclosures"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {studentDisclosures.map((disc) => (
              <div key={disc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-gray-400">
                      {disc.trackingNumber}
                    </span>
                    <StatusBadge status={disc.status} size="sm" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 hover:text-blue-600 transition">
                    <Link href={`/student/disclosures/${disc.id}`}>{disc.title}</Link>
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-1">{disc.abstract}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {disc.status === 'DRAFT' ? (
                    <Link
                      href={`/student/disclosures/${disc.id}/edit`}
                      className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition"
                    >
                      Edit Draft
                    </Link>
                  ) : (
                    <Link
                      href={`/student/disclosures/${disc.id}`}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
                    >
                      Workspace
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Submission Readiness Checklist */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900">Submission Checklist</h2>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-900">PIDCS Novelty Details</p>
                <p className="text-[11px] text-emerald-700">Abstract, technical field, and commercial potential populated.</p>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-900">Antivirus Scanned Attachments</p>
                <p className="text-[11px] text-emerald-700">Clean ClamAV certification received for all specifications.</p>
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-900">Co-Inventor Legal Consents</p>
                <p className="text-[11px] text-blue-700">All co-inventors must verify consent before final submission.</p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/student/checklist"
              className="w-full block py-2.5 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl text-center transition"
            >
              Open Full Checklist Tracker &rarr;
            </Link>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
