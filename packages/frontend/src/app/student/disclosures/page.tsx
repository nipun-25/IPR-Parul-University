'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, type MockDisclosure } from '../../../data/mock-portal-data';
import { PlusCircle, Eye, Edit3, Paperclip, Users } from 'lucide-react';

export default function StudentDisclosuresPage() {
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
          <Link
            href={`/student/disclosures/${disc.id}`}
            className="font-bold text-gray-900 hover:text-blue-600 transition"
          >
            {disc.title}
          </Link>
          <p className="text-xs text-gray-400 mt-0.5">{disc.fieldOfInvention}</p>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      className: 'w-32',
      render: (disc: MockDisclosure) => <StatusBadge status={disc.status} size="sm" />
    },
    {
      key: 'inventors',
      header: 'Inventors',
      className: 'w-28 text-xs',
      render: (disc: MockDisclosure) => (
        <span className="inline-flex items-center gap-1 font-medium text-gray-700">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          {disc.inventors.length}
        </span>
      )
    },
    {
      key: 'attachments',
      header: 'Docs',
      className: 'w-24 text-xs',
      render: (disc: MockDisclosure) => (
        <span className="inline-flex items-center gap-1 font-medium text-gray-700">
          <Paperclip className="w-3.5 h-3.5 text-gray-400" />
          {disc.attachments.length}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-28 text-right',
      render: (disc: MockDisclosure) => (
        <div className="flex items-center justify-end gap-1.5">
          {disc.status === 'DRAFT' ? (
            <Link
              href={`/student/disclosures/${disc.id}/edit`}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition"
              title="Edit Draft"
            >
              <Edit3 className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href={`/student/disclosures/${disc.id}`}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="View Workspace"
            >
              <Eye className="w-4 h-4" />
            </Link>
          )}
        </div>
      )
    }
  ];

  return (
    <PortalShell
      role="Student"
      currentPath="/student/disclosures"
      title="My Invention Disclosures"
      subtitle="Complete repository of your intellectual property disclosures, provisional filings and drafts"
      actions={
        <Link
          href="/student/create"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Disclosure</span>
        </Link>
      }
    >
      <DataTable
        columns={columns}
        data={MOCK_DISCLOSURES}
        rowKey={(d) => d.id}
        searchPlaceholder="Search disclosures by title or tracking number..."
        searchFilter={(disc, query) =>
          disc.title.toLowerCase().includes(query) ||
          disc.trackingNumber.toLowerCase().includes(query) ||
          disc.fieldOfInvention.toLowerCase().includes(query)
        }
      />
    </PortalShell>
  );
}
