'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_USERS } from '../../../data/mock-portal-data';
import { UserCheck } from 'lucide-react';

export default function AdminStudentsPage() {
  const students = MOCK_USERS.filter((u) => u.role === 'Student');

  const columns = [
    {
      key: 'name',
      header: 'Student Name',
      render: (u: (typeof students)[0]) => (
        <div>
          <span className="font-bold text-gray-900">{u.name}</span>
          <p className="text-xs text-gray-400">{u.email}</p>
        </div>
      )
    },
    {
      key: 'department',
      header: 'Department / Institute',
      className: 'text-xs text-gray-600'
    },
    {
      key: 'status',
      header: 'Status',
      className: 'w-28',
      render: (u: (typeof students)[0]) => <StatusBadge status={u.status} size="sm" />
    },
    {
      key: 'joinedDate',
      header: 'Enrollment Date',
      className: 'w-32 text-xs text-gray-500'
    }
  ];

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/students"
      title="Student Innovator Management"
      subtitle="Oversight of undergraduate and postgraduate students submitting invention disclosures"
    >
      <DataTable
        columns={columns}
        data={students}
        rowKey={(u) => u.id}
        searchPlaceholder="Search students..."
      />
    </PortalShell>
  );
}
