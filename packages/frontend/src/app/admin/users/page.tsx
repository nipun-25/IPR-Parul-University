'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_USERS, type MockUser } from '../../../data/mock-portal-data';
import { Users, Plus, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminUsersPage() {
  const columns = [
    {
      key: 'name',
      header: 'Full Name',
      render: (u: MockUser) => (
        <div>
          <span className="font-bold text-gray-900">{u.name}</span>
          <p className="text-xs text-gray-400">{u.email}</p>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Assigned Role',
      className: 'w-36',
      render: (u: MockUser) => (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800 border border-slate-200">
          {u.role}
        </span>
      )
    },
    {
      key: 'department',
      header: 'Faculty / College',
      className: 'text-xs text-gray-600'
    },
    {
      key: 'status',
      header: 'Status',
      className: 'w-28',
      render: (u: MockUser) => <StatusBadge status={u.status} size="sm" />
    },
    {
      key: 'actions',
      header: 'Action',
      className: 'w-28 text-right',
      render: (u: MockUser) => (
        <Link
          href="/admin/roles"
          className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
        >
          Edit Role
        </Link>
      )
    }
  ];

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/users"
      title="Institutional User Directory"
      subtitle="Complete register of authenticated students, faculty researchers, reviewers and legal officers"
    >
      <div className="space-y-4">
        {/* Missing Gateway Notice */}
        <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Gateway Status (Pending Migration):</strong> Institutional user directory listing and administrative user provisioning gateways (<code>list_portal_users_v1</code>, <code>admin_provision_user_v1</code>) are pending formal database migration approval. Showing demonstration directory.
            </span>
          </div>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
            PREVIEW / PENDING GATEWAY
          </span>
        </div>

        <DataTable
          columns={columns}
          data={MOCK_USERS}
          rowKey={(u) => u.id}
          searchPlaceholder="Search users by name, email or department..."
          searchFilter={(u, q) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.department.toLowerCase().includes(q)
          }
        />
      </div>
    </PortalShell>
  );
}
