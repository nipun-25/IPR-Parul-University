'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_USERS } from '../../../data/mock-portal-data';
import { Scale } from 'lucide-react';

export default function AdminLegalPage() {
  const legalTeam = MOCK_USERS.filter((u) => u.role === 'Legal');

  const columns = [
    {
      key: 'name',
      header: 'Counsel Name',
      render: (u: (typeof legalTeam)[0]) => (
        <div>
          <span className="font-bold text-gray-900">{u.name}</span>
          <p className="text-xs text-gray-400">{u.email}</p>
        </div>
      )
    },
    {
      key: 'department',
      header: 'Legal Division',
      className: 'text-xs text-gray-600'
    },
    {
      key: 'status',
      header: 'Status',
      className: 'w-28',
      render: (u: (typeof legalTeam)[0]) => <StatusBadge status={u.status} size="sm" />
    }
  ];

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/legal"
      title="Legal Team & Patent Counsel Management"
      subtitle="Authorized officers permitted to e-file and advance patent stages before the Indian Patent Office"
    >
      <DataTable
        columns={columns}
        data={legalTeam}
        rowKey={(u) => u.id}
        searchPlaceholder="Search legal officers..."
      />
    </PortalShell>
  );
}
