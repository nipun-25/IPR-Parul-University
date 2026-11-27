'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatCard } from '../../../components/ui/StatCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, MOCK_USERS } from '../../../data/mock-portal-data';
import {
  BookOpen,
  PlusCircle,
  FileCheck,
  Scale,
  Award,
  Users,
  ArrowRight,
  TrendingUp,
  FileText
} from 'lucide-react';

export default function FacultyDashboard() {
  const faculty = MOCK_USERS[1]; // Dr. Ramesh Patel
  const facultyDisclosures = MOCK_DISCLOSURES.filter(
    (d) => d.leadInventor.role === 'Faculty' || d.inventors.some((inv) => inv.name === faculty.name)
  );

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/dashboard"
      title="Faculty Research & Innovation Portal"
      subtitle={`Welcome, ${faculty.name} • ${faculty.department}`}
      actions={
        <Link
          href="/faculty/create"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Research Disclosure</span>
        </Link>
      }
    >
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Research Disclosures"
          value={facultyDisclosures.length}
          subtitle="Funded & Lab Innovations"
          icon={BookOpen}
          colorScheme="emerald"
        />
        <StatCard
          title="Patent Pending"
          value="1"
          subtitle="E-filed at IPO Mumbai"
          icon={Scale}
          colorScheme="indigo"
        />
        <StatCard
          title="Under Review"
          value="1"
          subtitle="Committee evaluation"
          icon={Award}
          colorScheme="purple"
        />
        <StatCard
          title="Student Co-Inventors"
          value="4"
          subtitle="Active mentee authors"
          icon={Users}
          colorScheme="blue"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Active Research Inventions */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Active Department Disclosures</h2>
              <p className="text-xs text-gray-500">Funded research projects and intellectual property assets</p>
            </div>
            <Link
              href="/faculty/disclosures"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {facultyDisclosures.map((disc) => (
              <div key={disc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-400 font-semibold">{disc.trackingNumber}</span>
                    <StatusBadge status={disc.status} size="sm" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm hover:text-emerald-600 transition">
                    <Link href={`/faculty/disclosures/${disc.id}`}>{disc.title}</Link>
                  </h3>
                  <p className="text-gray-500 line-clamp-1">{disc.fieldOfInvention}</p>
                </div>
                <div className="shrink-0">
                  <Link
                    href={`/faculty/disclosures/${disc.id}`}
                    className="px-3 py-1.5 font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: R&D Directives & Quick Shortcuts */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span>Faculty R&D Support</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
              <p className="font-bold text-emerald-900">Institutional Patent Subsidies</p>
              <p className="text-emerald-800 leading-relaxed">
                100% of Indian Patent Office statutory filing and attorney fees are sponsored by Parul University.
              </p>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
              <p className="font-bold text-blue-900">Commercialization Royalties</p>
              <p className="text-blue-800 leading-relaxed">
                60/40 revenue share policy in favor of contributing faculty inventors upon commercial licensing.
              </p>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <Link
              href="/faculty/create"
              className="w-full flex items-center justify-between p-2.5 text-xs font-semibold text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-gray-200 transition"
            >
              <span>File New Research PIDCS</span>
              <PlusCircle className="w-4 h-4 text-emerald-600" />
            </Link>
            <Link
              href="/faculty/consent"
              className="w-full flex items-center justify-between p-2.5 text-xs font-semibold text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-gray-200 transition"
            >
              <span>Verify Co-Author Consents</span>
              <FileCheck className="w-4 h-4 text-emerald-600" />
            </Link>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
