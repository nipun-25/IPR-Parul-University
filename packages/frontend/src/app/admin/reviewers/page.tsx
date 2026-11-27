'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_USERS } from '../../../data/mock-portal-data';
import { Award } from 'lucide-react';

export default function AdminReviewersPage() {
  const reviewers = MOCK_USERS.filter((u) => u.role === 'Reviewer');

  const columns = [
    {
      key: 'name',
      header: 'Reviewer Name',
      render: (u: (typeof reviewers)[0]) => (
        <div>
          <span className="font-bold text-gray-900">{u.name}</span>
          <p className="text-xs text-gray-400">{u.email}</p>
        </div>
      )
    },
    {
      key: 'department',
      header: 'Technical Panel',
      className: 'text-xs text-gray-600'
    },
    {
      key: 'status',
      header: 'Status',
      className: 'w-28',
      render: (u: (typeof reviewers)[0]) => <StatusBadge status={u.status} size="sm" />
    }
  ];

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/reviewers"
      title="Reviewer Panel Management"
      subtitle="Institutional scientific review committee members evaluating invention disclosures"
    >
      <DataTable
        columns={columns}
        data={reviewers}
        rowKey={(u) => u.id}
        searchPlaceholder="Search reviewers..."
      />
    </PortalShell>
  );
}
