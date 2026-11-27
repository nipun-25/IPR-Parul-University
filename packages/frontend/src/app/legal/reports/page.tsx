'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatCard } from '../../../components/ui/StatCard';
import { MOCK_PATENT_APPLICATIONS } from '../../../data/mock-portal-data';
import { BarChart3, Download, TrendingUp, Scale, Award } from 'lucide-react';

export default function LegalReportsPage() {
  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/reports"
      title="Institutional IP Analytics & Reports"
      subtitle="Statutory filing analytics, patent grants, department distributions, and commercial licensing reports"
      actions={
        <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm transition">
          <Download className="w-4 h-4" />
          <span>Export Annual IPR Report (PDF)</span>
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Applications Filed"
          value="4"
          subtitle="FY 2024-2026"
          icon={Scale}
          colorScheme="amber"
        />
        <StatCard
          title="Patents Granted"
          value="1"
          subtitle="Certificate in Force"
          icon={Award}
          colorScheme="emerald"
        />
        <StatCard
          title="Pending Examination"
          value="2"
          subtitle="IPO Mumbai"
          icon={BarChart3}
          colorScheme="purple"
        />
        <StatCard
          title="Statutory Success Rate"
          value="88%"
          subtitle="FER clearance rate"
          icon={TrendingUp}
          colorScheme="blue"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
            Department IP Distribution
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between font-semibold text-gray-700 mb-1">
                <span>Parul Institute of Technology (Engineering)</span>
                <span>50% (2)</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: '50%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between font-semibold text-gray-700 mb-1">
                <span>Parul Institute of Pharmacy</span>
                <span>25% (1)</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: '25%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between font-semibold text-gray-700 mb-1">
                <span>Renewable Energy Systems</span>
                <span>25% (1)</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-amber-600 h-full rounded-full" style={{ width: '25%' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
            Compliance & Expenditure Overview
          </h3>
          <div className="space-y-2 text-gray-600 leading-relaxed">
            <p>&bull; <strong>Total Government Statutory Filing Fees:</strong> ₹ 32,000 (Subsidized by PU R&D)</p>
            <p>&bull; <strong>External Patent Attorney Retainers:</strong> Active institutional retainer agreement</p>
            <p>&bull; <strong>Compliance Status:</strong> All Form 3 and Form 27 annual working statements up to date.</p>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
