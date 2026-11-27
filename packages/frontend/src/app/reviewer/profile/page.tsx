'use client';

import React, { useState } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { MOCK_USERS } from '../../../data/mock-portal-data';
import { Award, CheckCircle2 } from 'lucide-react';

export default function ReviewerProfilePage() {
  const reviewer = MOCK_USERS[3];
  const [saved, setSaved] = useState(false);

  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/profile"
      title="Reviewer Panel Profile"
      subtitle="Evaluation committee credentials, technical domain specialties, and review quotas"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-center">
          <div className="w-20 h-20 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-2xl mx-auto shadow-md">
            {reviewer.avatar}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{reviewer.name}</h3>
            <p className="text-xs text-gray-500">{reviewer.department}</p>
          </div>
          <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
            Technical Reviewer Panel
          </span>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            Domain Specialization & Capacity Settings
          </h3>

          {saved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Reviewer capacity preferences saved.</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Assigned Panel</label>
              <input
                type="text"
                disabled
                value={reviewer.department}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Max Concurrent Reviews</label>
              <input
                type="number"
                defaultValue={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="button"
              onClick={() => setSaved(true)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-sm transition"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
