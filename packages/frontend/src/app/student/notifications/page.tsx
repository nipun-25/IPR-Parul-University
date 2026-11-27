'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { MOCK_NOTIFICATIONS } from '../../../data/mock-portal-data';
import { Bell, CheckCheck, Clock, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export default function StudentNotificationsPage() {
  const notifications = MOCK_NOTIFICATIONS.filter(
    (n) => n.targetRole === 'Student'
  );

  return (
    <PortalShell
      role="Student"
      currentPath="/student/notifications"
      title="Notifications & System Alerts"
      subtitle="Activity feed regarding your submissions, co-inventor signatures, and reviewer feedback"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Recent Notifications</h3>
          <button className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <CheckCheck className="w-4 h-4" /> Mark all as read
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {notifications.map((n) => {
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
    </PortalShell>
  );
}
