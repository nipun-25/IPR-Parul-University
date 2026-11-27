'use client';

import React, { useState } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { MOCK_USERS } from '../../../data/mock-portal-data';
import { User, Mail, Building, Key, Award, CheckCircle2 } from 'lucide-react';

export default function FacultyProfilePage() {
  const faculty = MOCK_USERS[1];
  const [saved, setSaved] = useState(false);

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/profile"
      title="Faculty Researcher Profile"
      subtitle="Academic department credentials, publication profile, and IPR governance preferences"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-2xl mx-auto shadow-md">
            {faculty.avatar}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{faculty.name}</h3>
            <p className="text-xs text-gray-500">{faculty.department}</p>
          </div>
          <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
            Faculty Innovator
          </span>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
            Faculty Credentials & R&D Directives
          </h3>

          {saved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Faculty profile preferences saved.</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Institutional Email</label>
              <input
                type="email"
                disabled
                value={faculty.email}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Faculty Institute</label>
              <input
                type="text"
                disabled
                value={faculty.department}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="button"
              onClick={() => setSaved(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm transition"
            >
              Save Profile
            </button>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
