'use client';

import React, { useState, useEffect } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatCard } from '../../../components/ui/StatCard';
import { BarChart3, Download, TrendingUp, Scale, Award, Database, AlertCircle, Loader2, Printer } from 'lucide-react';
import type { ReportingSummaryDto } from '@ipr/shared';

export default function LegalReportsPage() {
  const [summary, setSummary] = useState<ReportingSummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    async function loadSummary() {
      setIsLoading(true);
      try {
        const sessRes = await fetch(`${backendUrl}/api/v1/auth/session`, {
          credentials: 'include'
        });

        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (sessData.authenticated && sessData.user) {
            setIsBackendConnected(true);
            const sumRes = await fetch('/api/bff/reports/summary', {
              credentials: 'include'
            });

            if (sumRes.ok) {
              const sumData = await sumRes.json();
              if (sumData.success && sumData.summary) {
                setSummary(sumData.summary);
              }
            }
          }
        }
      } catch {
        // Fallback to preview mode
      } finally {
        setIsLoading(false);
      }
    }

    loadSummary();
  }, [backendUrl]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/bff/reports/export/disclosures.csv', {
        credentials: 'include'
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'parul-ipr-legal-disclosures.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch {
      // Fallback
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const totalInventions = summary ? summary.totalDisclosures : 4;
  const clearedCount = summary ? (summary.byLegalClearanceStatus['CLEARED'] || 0) : 2;
  const pendingClearanceCount = summary ? (summary.byLegalClearanceStatus['PENDING'] || 0) : 1;
  const rejectedClearanceCount = summary ? (summary.byLegalClearanceStatus['REJECTED'] || 0) : 0;

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/reports"
      title="Institutional IP Analytics & Reports"
      subtitle="Statutory filing analytics, patent grants, department distributions, and commercial licensing reports"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <Printer className="w-4 h-4 text-gray-500" />
            <span>Print Report (PDF)</span>
          </button>
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Export Legal CSV</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status Banner */}
        {isBackendConnected && summary ? (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Live Legal Analytics Connected:</strong> Displaying authoritative statutory summary for {summary.totalDisclosures} case(s).
              </span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
              LIVE GATEWAY DATA
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-gray-500 shrink-0" />
              <span>
                <strong>UI Preview Analytics:</strong> Sign in with Legal Officer session to load live legal docket metrics.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-mono text-[10px] font-bold">
              DEMO METRICS
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Inventions"
            value={totalInventions}
            subtitle="Accessible Portfolio"
            icon={Scale}
            colorScheme="amber"
          />
          <StatCard
            title="Cleared for Filing"
            value={clearedCount}
            subtitle="Form 1/2 Eligible"
            icon={Award}
            colorScheme="emerald"
          />
          <StatCard
            title="Pending Clearance"
            value={pendingClearanceCount}
            subtitle="Prior Art Assessment"
            icon={BarChart3}
            colorScheme="purple"
          />
          <StatCard
            title="Clearance Objections"
            value={rejectedClearanceCount}
            subtitle="Non-patentable Subject"
            icon={TrendingUp}
            colorScheme="blue"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
              Statutory Legal Clearance Status
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between font-semibold text-gray-700 mb-1">
                  <span>Cleared for Indian Patent Office Docketing</span>
                  <span>{clearedCount} cases</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalInventions > 0 ? (clearedCount / totalInventions) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between font-semibold text-gray-700 mb-1">
                  <span>Assessment & Examination Pending</span>
                  <span>{pendingClearanceCount} cases</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalInventions > 0 ? (pendingClearanceCount / totalInventions) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
              Statutory Reporting & Export Guidelines
            </h3>
            <div className="space-y-2 text-gray-600 leading-relaxed">
              <p>&bull; <strong>Indian Patents Act Compliance:</strong> Data generated via <code>public.list_disclosures_v1</code> and <code>public.get_patent_application_v1</code>.</p>
              <p>&bull; <strong>Case Isolation Assurance:</strong> Legal officers can only export and inspect filings allocated to their legal jurisdiction or docket.</p>
              <p>&bull; <strong>Audit Log Invariant:</strong> Every CSV generation request is subject to cryptographic HMAC assertion verification.</p>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
