'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, type MockDisclosure } from '../../../data/mock-portal-data';
import { Eye, Award } from 'lucide-react';

export default function ReviewerAssignedPage() {
  const columns = [
    {
      key: 'trackingNumber',
      header: 'Tracking No.',
      className: 'w-36 font-mono text-xs font-semibold text-gray-500'
    },
    {
      key: 'title',
      header: 'Invention Disclosure',
      render: (disc: MockDisclosure) => (
        <div>
          <Link
            href={`/reviewer/disclosures/${disc.id}`}
            className="font-bold text-gray-900 hover:text-purple-600 transition"
          >
            {disc.title}
          </Link>
          <p className="text-xs text-gray-400 mt-0.5">Lead: {disc.leadInventor.name} ({disc.leadInventor.department})</p>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Stage',
      className: 'w-32',
      render: (disc: MockDisclosure) => <StatusBadge status={disc.status} size="sm" />
    },
    {
      key: 'evaluation',
      header: 'Review Status',
      className: 'w-36 text-xs',
      render: (disc: MockDisclosure) =>
        disc.evaluation ? (
          <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Scored ({disc.evaluation.noveltyScore}/10)
          </span>
        ) : (
          <span className="font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            Pending Scoring
          </span>
        )
    },
    {
      key: 'actions',
      header: 'Action',
      className: 'w-28 text-right',
      render: (disc: MockDisclosure) => (
        <Link
          href={`/reviewer/disclosures/${disc.id}`}
          className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition"
        >
          Evaluate
        </Link>
      )
    }
  ];

  return (
    <PortalShell
      role="Reviewer"
      currentPath="/reviewer/assigned"
      title="All Assigned Inventions"
      subtitle="Complete portfolio of invention disclosures allocated to your scientific evaluation panel"
    >
      <DataTable
        columns={columns}
        data={MOCK_DISCLOSURES}
        rowKey={(d) => d.id}
        searchPlaceholder="Search assigned disclosures..."
      />
    </PortalShell>
  );
}
