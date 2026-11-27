'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_USERS, type MockUser } from '../../../data/mock-portal-data';
import { Users, Plus, Shield, CheckCircle2 } from 'lucide-react';

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
    </PortalShell>
  );
}
