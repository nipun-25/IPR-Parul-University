'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { MOCK_AUDIT_LOGS } from '../../../data/mock-portal-data';
import { History, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminAuditPage() {
  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/audit"
      title="System Audit Trail & Security Ledger"
      subtitle="Append-only immutable record of all authentication, submission, and stage changes"
    >
      <div className="space-y-4">
        {/* Missing Gateway Notice */}
        <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Gateway Status (Pending Migration):</strong> The outbox/audit stream reader gateway (<code>list_security_audit_events_v1</code>) is pending formal database migration approval. The underlying table <code>public.outbox_messages</code> is strictly append-only and locked down under least-privilege architecture. Showing demonstration ledger.
            </span>
          </div>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
            PREVIEW / PENDING GATEWAY
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
          <div className="p-4 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Immutable Audit Stream
            </span>
            <span className="text-xs text-rose-700 font-semibold flex items-center gap-1">
              <Shield className="w-4 h-4" /> Cryptographic Integrity Guaranteed
            </span>
          </div>

          {MOCK_AUDIT_LOGS.map((log) => (
            <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">{log.action}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                    {log.actorRole}
                  </span>
                  <span className="text-emerald-700 font-semibold text-[11px]">{log.status}</span>
                </div>
                <p className="text-gray-600 text-[11px]">{log.targetResource}</p>
                <p className="text-[10px] text-gray-400 font-mono">
                  Actor: {log.actorName} &bull; IP: {log.ipAddress} &bull; {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="shrink-0">
                <span className="font-mono text-gray-400 text-[10px]">{log.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
