'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_PATENT_APPLICATIONS, type MockPatentApplication } from '../../../data/mock-portal-data';
import { Scale, Eye } from 'lucide-react';

export default function AdminPatentsPage() {
  const columns = [
    {
      key: 'applicationNumber',
      header: 'IPO App No.',
      className: 'w-36 font-mono text-xs font-bold text-indigo-700'
    },
    {
      key: 'title',
      header: 'Patent Title',
      render: (app: MockPatentApplication) => (
        <div>
          <span className="font-bold text-gray-900">{app.title}</span>
          <p className="text-xs text-gray-400">Lead: {app.leadInventor} &bull; {app.department}</p>
        </div>
      )
    },
    {
      key: 'currentStage',
      header: 'Statutory Stage',
      className: 'w-32',
      render: (app: MockPatentApplication) => <StatusBadge status={app.currentStage} size="sm" />
    },
    {
      key: 'attorneyAssigned',
      header: 'Handling Counsel',
      className: 'w-36 text-xs text-gray-600'
    },
    {
      key: 'actions',
      header: 'Oversight',
      className: 'w-24 text-right',
      render: (app: MockPatentApplication) => (
        <Link
          href={`/legal/patents/${app.id}`}
          className="p-1.5 text-rose-700 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1 text-xs font-semibold transition"
        >
          <Eye className="w-4 h-4" />
          <span>Inspect</span>
        </Link>
      )
    }
  ];

  return (
    <PortalShell
      role="Administrator"
      currentPath="/admin/patents"
      title="Patent Portfolio Oversight"
      subtitle="High-level governance over university-owned patents filed before Indian and international patent authorities"
    >
      <DataTable
        columns={columns}
        data={MOCK_PATENT_APPLICATIONS}
        rowKey={(a) => a.id}
        searchPlaceholder="Search patent portfolio..."
      />
    </PortalShell>
  );
}
