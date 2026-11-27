'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { MOCK_NOTIFICATIONS } from '../../../data/mock-portal-data';
import { Bell, CheckCircle2, Clock } from 'lucide-react';

export default function FacultyNotificationsPage() {
  const notifs = MOCK_NOTIFICATIONS.filter((n) => n.targetRole === 'Faculty');

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/notifications"
      title="Faculty Activity & Review Notifications"
      subtitle="Real-time alerts regarding committee evaluations, student co-inventor signatures, and legal updates"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Recent Institutional Alerts
          </span>
          <span className="text-xs text-emerald-700 font-semibold">Active Monitoring</span>
        </div>

        {notifs.map((n) => (
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
    </PortalShell>
  );
}
