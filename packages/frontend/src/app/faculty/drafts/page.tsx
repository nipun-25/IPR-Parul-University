'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, type MockDisclosure } from '../../../data/mock-portal-data';
import { Edit3, PlusCircle } from 'lucide-react';

export default function FacultyDraftsPage() {
  const drafts = MOCK_DISCLOSURES.filter((d) => d.status === 'DRAFT');

  const columns = [
    {
      key: 'trackingNumber',
      header: 'Tracking No.',
      className: 'w-36 font-mono text-xs font-semibold text-gray-500'
    },
    {
      key: 'title',
      header: 'Draft Title',
      render: (disc: MockDisclosure) => (
        <div>
          <span className="font-bold text-gray-900">{disc.title}</span>
          <p className="text-xs text-gray-400">{disc.fieldOfInvention}</p>
        </div>
      )
    },
    {
      key: 'updatedAt',
      header: 'Last Modified',
      className: 'w-36 text-xs text-gray-500',
      render: (disc: MockDisclosure) => new Date(disc.updatedAt).toLocaleDateString()
    },
    {
      key: 'actions',
      header: 'Action',
      className: 'w-24 text-right',
      render: (disc: MockDisclosure) => (
        <Link
          href={`/faculty/create`}
          className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
        >
          Resume
        </Link>
      )
    }
  ];

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/drafts"
      title="Manage Research Drafts"
      subtitle="Unfinished invention disclosures in preparation before formal institutional review"
      actions={
        <Link
          href="/faculty/create"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Draft</span>
        </Link>
      }
    >
      <DataTable
        columns={columns}
        data={drafts}
        rowKey={(d) => d.id}
        searchPlaceholder="Search draft inventions..."
      />
    </PortalShell>
  );
}
