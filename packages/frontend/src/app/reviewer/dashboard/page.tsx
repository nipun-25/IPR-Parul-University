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
  Award,
  CheckCircle2,
  ArrowRight,
  Eye,
  SlidersHorizontal,
  Send
} from 'lucide-react';

export default function ReviewerDashboard() {
  const reviewer = MOCK_USERS[3]; // Prof. Vikramaditya Joshi
  const assigned = MOCK_DISCLOSURES.filter((d) => d.assignedReviewer?.id === reviewer.id);
  const pending = assigned.filter((d) => !d.evaluation);

  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/dashboard"
      title="IPR Technical Reviewer Workspace"
      subtitle={`Welcome, ${reviewer.name} • ${reviewer.department}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Disclosures"
          value={assigned.length}
          subtitle="Evaluation queue"
          icon={FileText}
          colorScheme="purple"
        />
        <StatCard
          title="Pending Reviews"
          value={pending.length}
          subtitle="Awaiting scoring"
          icon={Clock}
          colorScheme="amber"
        />
        <StatCard
          title="Completed Evaluations"
          value="1"
          subtitle="Recommended for filing"
          icon={CheckCircle2}
          colorScheme="emerald"
        />
        <StatCard
          title="Clarification Queries"
          value="1"
          subtitle="Responses resolved"
          icon={Send}
          colorScheme="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Current Evaluation Queue</h2>
              <p className="text-xs text-gray-500">Examine novelty, inventive step, and industrial applicability</p>
            </div>
            <Link
              href="/reviewer/pending"
              className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
            >
              View Pending <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {assigned.map((disc) => (
              <div key={disc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-400 font-semibold">{disc.trackingNumber}</span>
                    <StatusBadge status={disc.status} size="sm" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm hover:text-purple-600 transition">
                    <Link href={`/reviewer/disclosures/${disc.id}`}>{disc.title}</Link>
                  </h3>
                  <p className="text-gray-500">Lead: {disc.leadInventor.name} &bull; {disc.fieldOfInvention}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/reviewer/disclosures/${disc.id}`}
                    className="px-3 py-1.5 font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition"
                  >
                    Evaluate
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h2 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-600" />
            <span>Patentability Rubric</span>
          </h2>

          <div className="space-y-3">
            <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-1">
              <p className="font-bold text-purple-900">1. Novelty (Section 2(1)(l))</p>
              <p className="text-purple-800 leading-relaxed">
                Invention must not be anticipated by publication or prior public knowledge worldwide.
              </p>
            </div>
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1">
              <p className="font-bold text-blue-900">2. Inventive Step (Section 2(1)(ja))</p>
              <p className="text-blue-800 leading-relaxed">
                Must feature technical advance not obvious to a person skilled in the relevant art.
              </p>
            </div>
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
              <p className="font-bold text-emerald-900">3. Industrial Applicability</p>
              <p className="text-emerald-800 leading-relaxed">
                Capable of being manufactured or utilized in commercial industry.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
