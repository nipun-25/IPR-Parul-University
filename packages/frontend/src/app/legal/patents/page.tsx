'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_PATENT_APPLICATIONS, type MockPatentApplication } from '../../../data/mock-portal-data';
import { Scale, PlusCircle, Eye, AlertCircle, Search, ArrowRight } from 'lucide-react';

export default function LegalPatentsPage() {
  const router = useRouter();
  const [lookupId, setLookupId] = useState('');

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (lookupId.trim()) {
      router.push(`/legal/patents/${lookupId.trim()}`);
    }
  };

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
      <div className="space-y-6">
        {/* Pending Migration Banner */}
        <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Gateway Status (Pending Migration):</strong> Comprehensive patent application portfolio listing gateway (<code>list_patent_applications_v1</code>) is pending migration approval. Direct individual docket inspection and stage advancement are live via <code>public.get_patent_application_v1</code>.
            </span>
          </div>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
            PREVIEW / PENDING GATEWAY
          </span>
        </div>

        {/* Direct Docket UUID Lookup Bar */}
        <form onSubmit={handleLookup} className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3 text-xs">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Inspect Live Patent Docket by UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)..."
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            className="flex-1 font-mono text-xs focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition flex items-center gap-1 shrink-0"
          >
            <span>Open Docket</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <DataTable
          columns={columns}
          data={MOCK_PATENT_APPLICATIONS}
          rowKey={(a) => a.id}
          searchPlaceholder="Search demonstration portfolio by application number or title..."
        />
      </div>
    </PortalShell>
  );
}
