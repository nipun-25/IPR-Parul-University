'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, type MockDisclosure } from '../../../data/mock-portal-data';
import { PlusCircle, Eye, Users, Paperclip } from 'lucide-react';

export default function FacultyDisclosuresPage() {
  const columns = [
    {
      key: 'trackingNumber',
      header: 'Tracking No.',
      className: 'w-36 font-mono text-xs font-semibold text-gray-500'
    },
    {
      key: 'title',
      header: 'Research Invention Title',
      render: (disc: MockDisclosure) => (
        <div>
          <Link
            href={`/faculty/disclosures/${disc.id}`}
            className="font-bold text-gray-900 hover:text-emerald-600 transition"
          >
            {disc.title}
          </Link>
          <p className="text-xs text-gray-400 mt-0.5">{disc.leadInventor.department}</p>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Workflow Stage',
      className: 'w-32',
      render: (disc: MockDisclosure) => <StatusBadge status={disc.status} size="sm" />
    },
    {
      key: 'inventors',
      header: 'Research Team',
      className: 'w-32 text-xs',
      render: (disc: MockDisclosure) => (
        <span className="inline-flex items-center gap-1 font-medium text-gray-700">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          {disc.inventors.length} Inventors
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-24 text-right',
      render: (disc: MockDisclosure) => (
        <Link
          href={`/faculty/disclosures/${disc.id}`}
          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg inline-flex items-center gap-1 text-xs font-semibold transition"
        >
          <Eye className="w-4 h-4" />
          <span>Details</span>
        </Link>
      )
    }
  ];

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/disclosures"
      title="My Research Disclosures"
      subtitle="Complete ledger of faculty-led scientific inventions, laboratory patents, and technology transfers"
      actions={
        <Link
          href="/faculty/create"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Disclosure</span>
        </Link>
      }
    >
      <DataTable
        columns={columns}
        data={MOCK_DISCLOSURES}
        rowKey={(d) => d.id}
        searchPlaceholder="Search research disclosures..."
        searchFilter={(disc, q) =>
          disc.title.toLowerCase().includes(q) ||
          disc.trackingNumber.toLowerCase().includes(q) ||
          disc.fieldOfInvention.toLowerCase().includes(q)
        }
      />
    </PortalShell>
  );
}
