'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, type MockDisclosure } from '../../../data/mock-portal-data';
import { Scale, CheckCircle2 } from 'lucide-react';

export default function LegalReviewedPage() {
  const reviewed = MOCK_DISCLOSURES.filter((d) => d.evaluation);

  const columns = [
    {
      key: 'trackingNumber',
      header: 'Tracking No.',
      className: 'w-36 font-mono text-xs font-semibold text-gray-500'
    },
    {
      key: 'title',
      header: 'Reviewed Invention Title',
      render: (disc: MockDisclosure) => (
        <div>
          <span className="font-bold text-gray-900">{disc.title}</span>
          <p className="text-xs text-gray-400">Lead: {disc.leadInventor.name}</p>
        </div>
      )
    },
    {
      key: 'evaluation',
      header: 'Reviewer Finding',
      className: 'w-48 text-xs',
      render: (disc: MockDisclosure) => (
        <span className="font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          {disc.evaluation?.recommendation.replace(/_/g, ' ')}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Legal Action',
      className: 'w-36 text-right',
      render: (disc: MockDisclosure) => (
        <Link
          href="/legal/filing"
          className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition"
        >
          Draft Form 1 & 2
        </Link>
      )
    }
  ];

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/reviewed"
      title="Peer-Reviewed Disclosures Ready for Filing"
      subtitle="Invention disclosures approved by technical committee recommended for Indian Patent Office filing"
    >
      <DataTable
        columns={columns}
        data={reviewed}
        rowKey={(d) => d.id}
        searchPlaceholder="Search approved disclosures..."
      />
    </PortalShell>
  );
}
