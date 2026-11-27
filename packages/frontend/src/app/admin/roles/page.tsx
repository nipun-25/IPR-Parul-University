'use client';

import React, { useState } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { PORTAL_ROLES, type PortalRole } from '../../../data/mock-portal-data';
import { Shield, UserCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function AdminRolesPage() {
  const [selectedRole, setSelectedRole] = useState<PortalRole>(PORTAL_ROLES[0]);
  const [saved, setSaved] = useState(false);

  const rolePermissions: Record<string, string[]> = {
    Student: [
      'Create and edit DRAFT invention disclosures',
      'Upload specification documents and CAD diagrams',
      'Manage internal and external co-inventors',
      'Sign own inventor consent digitally',
      'Submit completed disclosures for review'
    ],
    Faculty: [
      'Create and submit research project disclosures',
      'Manage student co-inventor shares',
      'Sign faculty consent declarations',
      'Access university R&D grant subsidy pipeline'
    ],
    Reviewer: [
      'View assigned invention technical disclosures',
      'Score novelty, inventive step and industrial utility',
      'Submit formal patentability recommendations',
      'Issue clarification queries to inventors'
    ],
    Legal: [
      'Access approved disclosures for patent drafting',
      'Record official Indian Patent Office filing numbers',
      'Advance statutory stages (DRAFTING -> FILED -> EXAMINATION -> HEARING -> GRANTED)',
      'Manage FER responses and compliance deadlines'
    ],
    Administrator: [
      'Manage user accounts across all roles',
      'Assign peer reviewers to disclosures',
      'Oversee institutional inventor consent verification',
      'Access system audit trail and compliance reports'
    ]
  };

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/roles"
      title="Role-Based Access Control (RBAC) Management"
      subtitle="Configure institutional privilege boundaries and operation scopes"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 px-2">
            Institutional Roles
          </p>
          {PORTAL_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => {
                setSelectedRole(r);
                setSaved(false);
              }}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                selectedRole === r
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{r}</span>
              <Shield className="w-3.5 h-3.5 text-gray-400" />
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div>
              <h3 className="text-base font-bold text-gray-900">{selectedRole} Role Privileges</h3>
              <p className="text-gray-500">Authorized operations and security constraints</p>
            </div>
            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">
              Postgres RLS Enforced
            </span>
          </div>

          {saved && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Role configuration verified!</span>
            </div>
          )}

          <div className="space-y-2.5">
            <span className="font-bold text-gray-800">Granted Operation Scopes:</span>
            <div className="space-y-2">
              {(rolePermissions[selectedRole] || []).map((perm, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-xl flex items-center gap-2.5 text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{perm}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              onClick={() => setSaved(true)}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-sm transition"
            >
              Save RBAC Policy
            </button>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
