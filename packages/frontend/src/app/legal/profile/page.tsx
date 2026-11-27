'use client';

import React, { useState } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { MOCK_USERS } from '../../../data/mock-portal-data';
import { Scale, CheckCircle2 } from 'lucide-react';

export default function LegalProfilePage() {
  const legalOfficer = MOCK_USERS[4];
  const [saved, setSaved] = useState(false);

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/profile"
      title="Legal Officer Profile & Attorney Registration"
      subtitle="Bar council credentials, Indian Patent Office agent registration, and notification dispatch"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-2xl mx-auto shadow-md">
            {legalOfficer.avatar}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{legalOfficer.name}</h3>
            <p className="text-xs text-gray-500">{legalOfficer.department}</p>
          </div>
          <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
            Legal & Patent Counsel
          </span>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            Attorney Credentials & Statutory Authority
          </h3>

          {saved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Legal counsel credentials saved.</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Counsel Name</label>
              <input
                type="text"
                disabled
                value={legalOfficer.name}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Official Legal Email</label>
              <input
                type="email"
                disabled
                value={legalOfficer.email}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Indian Patent Agent Reg. No. (IPO)</label>
              <input
                type="text"
                defaultValue="IN/PA-3412"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="button"
              onClick={() => setSaved(true)}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl shadow-sm transition"
            >
              Save Credentials
            </button>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
