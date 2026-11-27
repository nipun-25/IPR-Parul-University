'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PortalShell } from '../../../../components/layout/PortalShell';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { ConfirmModal } from '../../../../components/ui/ConfirmModal';
import { MOCK_PATENT_APPLICATIONS, type MockPatentApplication } from '../../../../data/mock-portal-data';
import { ALLOWED_STAGE_TRANSITIONS, type PatentStage } from '../../../../data/mock-portal-data';
import { Scale, ArrowLeft, History, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function LegalPatentDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const app = MOCK_PATENT_APPLICATIONS.find((p) => p.id === id) || MOCK_PATENT_APPLICATIONS[0];

  const [currentStage, setCurrentStage] = useState<PatentStage>(app.currentStage);
  const [targetStage, setTargetStage] = useState<PatentStage | null>(null);
  const [stageRemarks, setStageRemarks] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const validNextStages = ALLOWED_STAGE_TRANSITIONS[currentStage] || [];

  const handleStageTransition = () => {
    if (!targetStage) return;
    setCurrentStage(targetStage);
    setConfirmOpen(false);
    setSuccessMsg(`Patent stage advanced successfully to ${targetStage}!`);
  };

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/patents"
      title={app.title}
      subtitle={`Application No: ${app.applicationNumber} • CBR: ${app.cbrNumber} • ${app.jurisdiction}`}
      actions={
        <Link
          href="/legal/patents"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Portfolio</span>
        </Link>
      }
    >
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-gray-500 font-semibold">Current Statutory Stage:</span>
          <StatusBadge status={currentStage} />
        </div>
        <div className="text-gray-500">
          Attorney: <strong className="text-gray-800">{app.attorneyAssigned}</strong> &bull; Filed: {app.filingDate}
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Statutory Stage History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-1.5">
              <History className="w-4 h-4 text-amber-600" /> Statutory Examination Progression
            </h3>

            <div className="divide-y divide-gray-100">
              {app.stagesHistory.map((st, i) => (
                <div key={i} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={st.stage} size="sm" />
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(st.changedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-700 mt-1">{st.remarks}</p>
                  <p className="text-[10px] text-gray-400">Recorded by: {st.changedBy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Stage Transition Controls */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-amber-600" /> Advance Statutory Stage
            </h3>

            {validNextStages.length === 0 ? (
              <p className="text-gray-500">
                This patent application has reached a terminal stage ({currentStage}). No further transitions permitted.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-500 leading-relaxed">
                  Only authorized Legal Team members may record transitions matching Indian Patent Office communication.
                </p>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Target Next Stage *</label>
                  <select
                    value={targetStage || ''}
                    onChange={(e) => setTargetStage(e.target.value as PatentStage)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">Select Next Stage...</option>
                    {validNextStages.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Official Remarks / IPO Notice No. *</label>
                  <textarea
                    rows={3}
                    value={stageRemarks}
                    onChange={(e) => setStageRemarks(e.target.value)}
                    placeholder="e.g. First Examination Report received, Oral Hearing notice issued..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <button
                  type="button"
                  disabled={!targetStage || !stageRemarks.trim()}
                  onClick={() => setConfirmOpen(true)}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  Commit Stage Transition
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleStageTransition}
        title={`Advance Patent Stage to ${targetStage}?`}
        message={`This action will update the official statutory ledger for ${app.applicationNumber}. This operation is audit-recorded.`}
        confirmText="Confirm Transition"
        variant="warning"
      />
    </PortalShell>
  );
}
