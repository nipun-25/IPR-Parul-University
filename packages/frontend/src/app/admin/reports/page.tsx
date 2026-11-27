'use client';

import React, { useState, useEffect } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { StatCard } from '../../../components/ui/StatCard';
import { BarChart3, Download, TrendingUp, Users, Scale, FileText, Database, AlertCircle, Loader2, Printer } from 'lucide-react';
import type { ReportingSummaryDto } from '@ipr/shared';

export default function AdminReportsPage() {
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
        a.download = 'parul-ipr-disclosures.csv';
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

  const totalInventions = summary ? summary.totalDisclosures : 48;
  const approvedCount = summary ? (summary.byStatus['APPROVED'] || 0) : 19;
  const submittedCount = summary ? (summary.byStatus['SUBMITTED'] || 0) : 22;
  const draftCount = summary ? (summary.byStatus['DRAFT'] || 0) : 7;
  const clearedCount = summary ? (summary.byLegalClearanceStatus['CLEARED'] || 0) : 12;

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/reports"
      title="Institutional R&D Analytics & IPR Reports"
      subtitle="Executive intelligence for the Directorate of Research, Board of Trustees, and Accreditation bodies"
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
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Export Authoritative CSV</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status Banner */}
        {isBackendConnected && summary ? (
          <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-rose-700 shrink-0" />
              <span>
                <strong>Live Institutional Analytics Connected:</strong> Authoritative summary computed across {summary.totalDisclosures} database disclosure records.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-mono text-[10px] font-bold">
              LIVE DATABASE METRICS
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-gray-500 shrink-0" />
              <span>
                <strong>UI Demonstration Analytics:</strong> Sign in with Administrator session to inspect live institutional R&D summaries.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-mono text-[10px] font-bold">
              DEMO METRICS
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Disclosures"
            value={totalInventions}
            subtitle="Campus Portfolio"
            icon={FileText}
            colorScheme="rose"
          />
          <StatCard
            title="Approved Filings"
            value={approvedCount}
            subtitle="Technical Clearance"
            icon={Scale}
            colorScheme="amber"
          />
          <StatCard
            title="Cleared for IPO"
            value={clearedCount}
            subtitle="Form 1/2 Ready"
            icon={TrendingUp}
            colorScheme="emerald"
          />
          <StatCard
            title="In-Review & Drafts"
            value={submittedCount + draftCount}
            subtitle="Pipeline Inventions"
            icon={Users}
            colorScheme="blue"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
              Institutional Status Distribution
            </h3>
            <div className="space-y-3 text-gray-700">
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Approved Disclosures</span>
                  <span>{approvedCount} filings</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalInventions > 0 ? (approvedCount / totalInventions) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Submitted (Under Evaluation)</span>
                  <span>{submittedCount} filings</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalInventions > 0 ? (submittedCount / totalInventions) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>In-Progress Drafts</span>
                  <span>{draftCount} filings</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalInventions > 0 ? (draftCount / totalInventions) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
              Accreditation & Statutory Compliance Summary
            </h3>
            <div className="space-y-2 text-gray-600 leading-relaxed">
              <p>&bull; <strong>Accreditation Compliance:</strong> All metrics computed authoritatively via <code>public.list_disclosures_v1</code> under strict PostgreSQL least privilege.</p>
              <p>&bull; <strong>Data Export Authorization:</strong> Export generates compliant RFC 4180 CSV with automatic delimiter escaping, restricted to authorized roles.</p>
              <p>&bull; <strong>Confidentiality Protection:</strong> Storage paths, quarantine UUIDs, and encryption nonces are stripped from external reports.</p>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
