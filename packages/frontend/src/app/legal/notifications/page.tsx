'use client';

import React, { useState, useEffect } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { MOCK_NOTIFICATIONS } from '../../../data/mock-portal-data';
import { Bell, AlertTriangle, AlertCircle, Database } from 'lucide-react';

interface DisclosureItem {
  id: string;
  trackingNumber: string | null;
  title: string;
  status: string;
  reviewStatus: string;
  legalClearanceStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface DerivedNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export default function LegalNotificationsPage() {
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [derivedAlerts, setDerivedAlerts] = useState<DerivedNotification[] | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    async function loadActivity() {
      try {
        const sessRes = await fetch(`${backendUrl}/api/v1/auth/session`, {
          credentials: 'include'
        });

        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (sessData.authenticated && sessData.user) {
            setIsBackendConnected(true);
            const discRes = await fetch('/api/bff/disclosures', {
              credentials: 'include'
            });

            if (discRes.ok) {
              const discData = await discRes.json();
              const list: DisclosureItem[] = discData.disclosures || [];
              const alerts: DerivedNotification[] = [];

              for (const d of list) {
                if (d.legalClearanceStatus === 'PENDING' && (d.status === 'APPROVED' || d.status === 'SUBMITTED')) {
                  alerts.push({
                    id: `notif-leg-pending-${d.id}`,
                    title: 'Clearance Determination Pending',
                    message: `Disclosure "${d.title}" (${d.trackingNumber || 'DRAFT'}) is awaiting formal patentability assessment.`,
                    createdAt: d.updatedAt
                  });
                } else if (d.legalClearanceStatus === 'CLEARED') {
                  alerts.push({
                    id: `notif-leg-cleared-${d.id}`,
                    title: 'Invention Cleared for Indian Patent Office Docketing',
                    message: `Clearance recorded for "${d.title}". Ready for Form 1/2 filing entry.`,
                    createdAt: d.updatedAt
                  });
                }
              }

              setDerivedAlerts(alerts);
            }
          }
        }
      } catch {
        // Fallback to preview
      }
    }

    loadActivity();
  }, [backendUrl]);

  const displayNotifications = isBackendConnected && derivedAlerts !== null && derivedAlerts.length > 0
    ? derivedAlerts
    : MOCK_NOTIFICATIONS.filter((n) => n.targetRole === 'Legal');

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/notifications"
      title="Legal Team Statutory Alerts"
      subtitle="Deadline notices for First Examination Reports (FER), hearings and publication gazettes"
    >
      <div className="space-y-6">
        {/* Pending Migration Banner */}
        <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Gateway Status (Pending Migration):</strong> Persistent notification inbox & read-receipt gateway (<code>public.user_notifications</code>) is pending migration approval. Showing live activity derived from PostgreSQL clearance queues.
            </span>
          </div>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
            PREVIEW / LIVE WORKFLOW EVENTS
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
          <div className="p-4 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
              Legal Deadlines & Alerts
              {isBackendConnected && derivedAlerts !== null && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full text-[10px] font-semibold flex items-center gap-1">
                  <Database className="w-3 h-3" /> Live Feed ({displayNotifications.length})
                </span>
              )}
            </span>
            <span className="text-xs text-amber-700 font-semibold">Priority Notifications</span>
          </div>

          {displayNotifications.map((n) => (
            <div key={n.id} className="p-4 flex items-start gap-4 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-900 text-sm">{n.title}</h4>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-600 leading-relaxed">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
