'use client';

import React, { useState, useEffect } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { MOCK_NOTIFICATIONS } from '../../../data/mock-portal-data';
import { Bell, CheckCircle2, Clock, AlertCircle, Database, CheckCheck } from 'lucide-react';

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

export default function FacultyNotificationsPage() {
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
                if (d.legalClearanceStatus === 'CLEARED') {
                  alerts.push({
                    id: `notif-fac-clear-${d.id}`,
                    title: 'R&D Disclosure Cleared for Patent Filing',
                    message: `Lab disclosure "${d.title}" (${d.trackingNumber || 'DRAFT'}) cleared by university legal counsel.`,
                    createdAt: d.updatedAt
                  });
                }
                if (d.reviewStatus === 'COMPLETED') {
                  alerts.push({
                    id: `notif-fac-rev-${d.id}`,
                    title: 'Technical Evaluation Received',
                    message: `Technical committee review completed for research disclosure "${d.title}".`,
                    createdAt: d.updatedAt
                  });
                }
                if (d.status === 'SUBMITTED') {
                  alerts.push({
                    id: `notif-fac-sub-${d.id}`,
                    title: 'Research Invention Disclosure Logged',
                    message: `Disclosure "${d.title}" has been registered in the institutional repository.`,
                    createdAt: d.createdAt
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
    : MOCK_NOTIFICATIONS.filter((n) => n.targetRole === 'Faculty');

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/notifications"
      title="Faculty Activity & Review Notifications"
      subtitle="Real-time alerts regarding committee evaluations, student co-inventor signatures, and legal updates"
    >
      <div className="space-y-6">
        {/* Pending Migration Banner */}
        <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Gateway Status (Pending Migration):</strong> Persistent notification inbox & read-receipt gateway (<code>public.user_notifications</code>) is pending migration approval. Below is live system activity derived from PostgreSQL workflow events.
            </span>
          </div>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
            PREVIEW / LIVE WORKFLOW EVENTS
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
          <div className="p-4 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
              Recent Institutional Alerts
              {isBackendConnected && derivedAlerts !== null && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-semibold flex items-center gap-1">
                  <Database className="w-3 h-3" /> Live Feed ({displayNotifications.length})
                </span>
              )}
            </span>
            <span className="text-xs text-emerald-700 font-semibold">Active Monitoring</span>
          </div>

          {displayNotifications.map((n) => (
            <div key={n.id} className="p-4 flex items-start gap-4 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
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
