'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, type MockDisclosure } from '../../../data/mock-portal-data';
import { Eye, UserCheck } from 'lucide-react';

export default function AdminDisclosuresPage() {
  const columns = [
    {
      key: 'trackingNumber',
      header: 'Tracking No.',
      className: 'w-36 font-mono text-xs font-semibold text-gray-500'
    },
    {
      key: 'title',
      header: 'Invention Title',
      render: (disc: MockDisclosure) => (
        <div>
          <span className="font-bold text-gray-900">{disc.title}</span>
          <p className="text-xs text-gray-400">{disc.leadInventor.name} &bull; {disc.department}</p>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Workflow Status',
      className: 'w-32',
      render: (disc: MockDisclosure) => <StatusBadge status={disc.status} size="sm" />
    },
    {
      key: 'assignedReviewer',
      header: 'Reviewer',
      className: 'w-36 text-xs',
      render: (disc: MockDisclosure) =>
        disc.assignedReviewer ? (
          <span className="font-semibold text-gray-800">{disc.assignedReviewer.name}</span>
        ) : (
          <span className="text-amber-600 font-semibold">Unassigned</span>
        )
    },
    {
      key: 'actions',
      header: 'Action',
      className: 'w-32 text-right',
      render: (disc: MockDisclosure) => (
        <Link
          href={`/admin/assignments`}
          className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
        >
          Assign / Reassign
        </Link>
      )
    }
  ];

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/disclosures"
      title="Institutional Disclosures Oversight"
      subtitle="Complete inventory of all student and faculty invention disclosures"
    >
      <DataTable
        columns={columns}
        data={MOCK_DISCLOSURES}
        rowKey={(d) => d.id}
        searchPlaceholder="Search all disclosures..."
      />
    </PortalShell>
  );
}
