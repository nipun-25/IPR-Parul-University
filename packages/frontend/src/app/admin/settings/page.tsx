'use client';

import React, { useState } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { Settings, Shield, CheckCircle2 } from 'lucide-react';

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/settings"
      title="System Governance & Infrastructure Settings"
      subtitle="Configure institutional domain filters, antivirus parameters, and session policies"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6 text-xs max-w-3xl">
        <div className="border-b border-gray-100 pb-3">
          <h3 className="text-base font-bold text-gray-900">Institutional IPR Portal Governance</h3>
          <p className="text-gray-500">Security configurations matching Parul University IT policy</p>
        </div>

        {saved && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>System settings updated successfully!</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Permitted Student Domain</label>
            <input
              type="text"
              disabled
              value="@paruluniversity.ac.in"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 font-mono"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Enforced at backend registration validator and CSRF layer.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">ClamAV Quarantine Max File Size</label>
            <input
              type="text"
              defaultValue="25 MB"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Reviewer SLA Window</label>
            <input
              type="number"
              defaultValue={14}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            <p className="text-[10px] text-gray-400 mt-1">Calendar days allocated for peer review determination.</p>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setSaved(true)}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-sm transition"
          >
            Save Governance Policies
          </button>
        </div>
      </div>
    </PortalShell>
  );
}
