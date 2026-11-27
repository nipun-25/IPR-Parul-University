'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_USERS } from '../../../data/mock-portal-data';
import { Building } from 'lucide-react';

export default function AdminFacultyPage() {
  const faculty = MOCK_USERS.filter((u) => u.role === 'Faculty');

  const columns = [
    {
      key: 'name',
      header: 'Faculty Name',
      render: (u: (typeof faculty)[0]) => (
        <div>
          <span className="font-bold text-gray-900">{u.name}</span>
          <p className="text-xs text-gray-400">{u.email}</p>
        </div>
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
      render: (u: (typeof faculty)[0]) => <StatusBadge status={u.status} size="sm" />
    },
    {
      key: 'joinedDate',
      header: 'Appointment Date',
      className: 'w-32 text-xs text-gray-500'
    }
  ];

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/faculty"
      title="Faculty Researchers Management"
      subtitle="Institutional directory of principal investigators and academic innovators"
    >
      <DataTable
        columns={columns}
        data={faculty}
        rowKey={(u) => u.id}
        searchPlaceholder="Search faculty researchers..."
      />
    </PortalShell>
  );
}
