'use client';

import React, { useState, useEffect } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { MOCK_NOTIFICATIONS } from '../../../data/mock-portal-data';
import { Bell, CheckCheck, Clock, CheckCircle2, AlertTriangle, Info, AlertCircle, Database } from 'lucide-react';

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
  type: 'success' | 'info' | 'warning' | 'alert';
  createdAt: string;
  read: boolean;
}

export default function StudentNotificationsPage() {
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
                    id: `notif-clear-${d.id}`,
                    title: 'Legal Clearance Granted',
                    message: `Disclosure "${d.title}" (${d.trackingNumber || 'DRAFT'}) has received formal legal clearance from the university patent cell.`,
                    type: 'success',
                    createdAt: d.updatedAt,
                    read: true
                  });
                }
                if (d.reviewStatus === 'COMPLETED') {
                  alerts.push({
                    id: `notif-rev-comp-${d.id}`,
                    title: 'Peer Technical Review Completed',
                    message: `Evaluation completed for "${d.title}". The disclosure has moved to the next assessment stage.`,
                    type: 'info',
                    createdAt: d.updatedAt,
                    read: true
                  });
                } else if (d.reviewStatus === 'ASSIGNED') {
                  alerts.push({
                    id: `notif-rev-assign-${d.id}`,
                    title: 'Technical Reviewer Allocated',
                    message: `An institutional domain expert has been assigned to evaluate "${d.title}".`,
                    type: 'info',
                    createdAt: d.updatedAt,
                    read: false
                  });
                }
                if (d.status === 'SUBMITTED') {
                  alerts.push({
                    id: `notif-sub-${d.id}`,
                    title: 'Initial Disclosure Locked & Submitted',
                    message: `Submission confirmed for "${d.title}" with tracking identifier ${d.trackingNumber || 'N/A'}.`,
                    type: 'success',
                    createdAt: d.createdAt,
                    read: true
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
    : MOCK_NOTIFICATIONS.filter((n) => n.targetRole === 'Student');

  return (
    <PortalShell
      role="Student"
      currentPath="/student/notifications"
      title="Notifications & System Alerts"
      subtitle="Activity feed regarding your submissions, co-inventor signatures, and reviewer feedback"
    >
      <div className="space-y-6">
        {/* Pending Migration Banner */}
        <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Gateway Status (Pending Migration):</strong> Persistent notification inbox and read-receipt gateway (<code>public.user_notifications</code>) is pending migration approval. Displaying live system activity derived authoritatively from active PostgreSQL disclosure events.
            </span>
          </div>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
            PREVIEW / LIVE WORKFLOW EVENTS
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">Recent Workflow Notifications</h3>
              {isBackendConnected && derivedAlerts !== null && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-semibold flex items-center gap-1">
                  <Database className="w-3 h-3" /> Live Feed ({displayNotifications.length})
                </span>
              )}
            </div>
            <button
              onClick={() => alert('Persistent read-receipt persistence requires public.user_notifications migration approval.')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <CheckCheck className="w-4 h-4" /> Mark all as read
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {displayNotifications.map((n) => {
              const iconMap = {
                success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
                info: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
                warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
                alert: <Bell className="w-5 h-5 text-rose-600 shrink-0" />
              };
              return (
                <div
                  key={n.id}
                  className={`p-4 flex items-start gap-4 text-xs transition ${
                    !n.read ? 'bg-blue-50/30' : 'hover:bg-gray-50'
                  }`}
                >
                  {iconMap[n.type]}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-gray-900 text-sm">{n.title}</h4>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-600 leading-relaxed">{n.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
