'use client';

import React, { useState } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { MOCK_USERS } from '../../../data/mock-portal-data';
import { User, Shield, Mail, Building, Key, CheckCircle2 } from 'lucide-react';

export default function StudentProfilePage() {
  const student = MOCK_USERS[0];
  const [saved, setSaved] = useState(false);

  return (
    <PortalShell
      role="Student"
      currentPath="/student/profile"
      title="Student Profile & Security Settings"
      subtitle="Institutional identity, department details, and authentication security preferences"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Identity Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-700 to-indigo-900 text-white font-bold flex items-center justify-center text-2xl mx-auto shadow-md">
              {student.avatar}
            </div>
            <h3 className="text-lg font-bold text-gray-900">{student.name}</h3>
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
              {student.role}
            </span>
          </div>

          <div className="pt-4 border-t border-gray-100 space-y-3 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <span>{student.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-400" />
              <span>{student.department}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-700 font-semibold">Argon2id Hashed Security Verified</span>
            </div>
          </div>
        </div>

        {/* Right Col: Preferences & Security Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="text-base font-bold text-gray-900">Security Credentials & Notifications</h3>
            <p className="text-xs text-gray-500">Manage institutional notification dispatch and password rotation</p>
          </div>

          {saved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Settings updated successfully!</span>
            </div>
          )}

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Registered Student Name</label>
              <input
                type="text"
                disabled
                value={student.name}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Name alterations require Parul University Registrar synchronization.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Institutional Email</label>
              <input
                type="email"
                disabled
                value={student.email}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
              />
            </div>

            <div className="pt-2 border-t border-gray-100">
              <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-blue-600" /> Rotate Password
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    placeholder="Min. 8 characters"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setSaved(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
