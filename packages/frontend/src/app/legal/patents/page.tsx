'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_PATENT_APPLICATIONS, type MockPatentApplication } from '../../../data/mock-portal-data';
import { Scale, PlusCircle, Eye } from 'lucide-react';

export default function LegalPatentsPage() {
  const columns = [
    {
      key: 'applicationNumber',
      header: 'Application No.',
      className: 'w-36 font-mono text-xs font-bold text-indigo-700'
    },
    {
      key: 'title',
      header: 'Patent Application Title',
      render: (app: MockPatentApplication) => (
        <div>
          <Link
            href={`/legal/patents/${app.id}`}
            className="font-bold text-gray-900 hover:text-amber-600 transition"
          >
            {app.title}
          </Link>
          <p className="text-xs text-gray-400">Lead Inventor: {app.leadInventor} &bull; {app.department}</p>
        </div>
      )
    },
    {
      key: 'currentStage',
      header: 'Patent Stage',
      className: 'w-32',
      render: (app: MockPatentApplication) => <StatusBadge status={app.currentStage} size="sm" />
    },
    {
      key: 'filingDate',
      header: 'Filing Date',
      className: 'w-28 text-xs text-gray-500'
    },
    {
      key: 'actions',
      header: 'Action',
      className: 'w-24 text-right',
      render: (app: MockPatentApplication) => (
        <Link
          href={`/legal/patents/${app.id}`}
          className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg inline-flex items-center gap-1 text-xs font-semibold transition"
        >
          <Eye className="w-4 h-4" />
          <span>Manage</span>
        </Link>
      )
    }
  ];

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/patents"
      title="Institutional Patent Portfolio"
      subtitle="Complete register of Indian and international patent applications held by Parul University"
      actions={
        <Link
          href="/legal/filing"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Filing Entry</span>
        </Link>
      }
    >
      <DataTable
        columns={columns}
        data={MOCK_PATENT_APPLICATIONS}
        rowKey={(a) => a.id}
        searchPlaceholder="Search by application number or title..."
      />
    </PortalShell>
  );
}
