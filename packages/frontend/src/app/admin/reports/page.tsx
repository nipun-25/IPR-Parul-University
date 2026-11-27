'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatCard } from '../../../components/ui/StatCard';
import { BarChart3, Download, TrendingUp, Users, Scale, FileText } from 'lucide-react';

export default function AdminReportsPage() {
  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/reports"
      title="Institutional R&D Analytics & IPR Reports"
      subtitle="Executive intelligence for the Directorate of Research, Board of Trustees, and Accreditation bodies"
      actions={
        <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-sm transition">
          <Download className="w-4 h-4" />
          <span>Export NAAC / NIRF IPR Data</span>
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Inventions Filed"
          value="48"
          subtitle="Annual Cumulative"
          icon={FileText}
          colorScheme="rose"
        />
        <StatCard
          title="Published Patents"
          value="19"
          subtitle="IPO Gazette"
          icon={Scale}
          colorScheme="amber"
        />
        <StatCard
          title="Granted Patents"
          value="7"
          subtitle="Patents in Force"
          icon={TrendingUp}
          colorScheme="emerald"
        />
        <StatCard
          title="Active Innovators"
          value="142"
          subtitle="Students & Faculty"
          icon={Users}
          colorScheme="blue"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
            Top Contributing Institutes
          </h3>
          <div className="space-y-3 text-gray-700">
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Parul Institute of Technology</span>
                <span>24 Disclosures</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-rose-600 h-full rounded-full" style={{ width: '50%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Parul Institute of Pharmacy</span>
                <span>14 Disclosures</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full" style={{ width: '30%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Parul Institute of Applied Sciences</span>
                <span>10 Disclosures</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: '20%' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
            Accreditation & NIRF Metrics Summary
          </h3>
          <div className="space-y-2 text-gray-600 leading-relaxed">
            <p>&bull; <strong>NIRF Innovation Parameter (IPR):</strong> 48 filed, 7 granted.</p>
            <p>&bull; <strong>Commercialization Pipeline:</strong> 2 technology transfers under active licensing negotiation.</p>
            <p>&bull; <strong>University IPR Subsidy Budget Utilization:</strong> 78% utilized for FY 2026-27.</p>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
