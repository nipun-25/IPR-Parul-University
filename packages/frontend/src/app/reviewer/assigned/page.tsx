'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, MOCK_USERS, type MockDisclosure } from '../../../data/mock-portal-data';
import { Award, Database, AlertCircle } from 'lucide-react';

interface DisclosureListItemDto {
  id: string;
  trackingNumber: string | null;
  title: string;
  status: string;
  primaryInventorId: string;
  assignedReviewerId: string | null;
  reviewStatus: string;
  legalClearanceStatus: string;
  createdAt: string;
  updatedAt: string;
}

export default function ReviewerAssignedPage() {
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [realDisclosures, setRealDisclosures] = useState<DisclosureListItemDto[] | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    async function fetchDisclosures() {
      try {
        const sessRes = await fetch(`${backendUrl}/api/v1/auth/session`, {
          credentials: 'include'
        });

        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (sessData.authenticated && sessData.user) {
            setIsBackendConnected(true);
            const discRes = await fetch('/api/bff/disclosures', {
              credentials: 'include'
            });
            if (discRes.ok) {
              const discData = await discRes.json();
              const list: DisclosureListItemDto[] = discData.disclosures || [];
              const assignedOnly = list.filter(
                (d) => d.assignedReviewerId === sessData.user.id || !d.assignedReviewerId
              );
              setRealDisclosures(assignedOnly);
            }
          }
        }
      } catch {
        // Fallback to preview data
      }
    }

    fetchDisclosures();
  }, [backendUrl]);

  const displayData: MockDisclosure[] = realDisclosures !== null
    ? realDisclosures.map((d) => ({
        id: d.id,
        trackingNumber: d.trackingNumber || 'DRAFT-PENDING',
        title: d.title,
        status: d.status as any,
        fieldOfInvention: 'Assigned Research',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        leadInventor: {
          ...MOCK_USERS[0],
          id: d.primaryInventorId,
          name: `Inventor (${d.primaryInventorId.slice(0, 8)})`
        },
        department: 'Parul University',
        commercialPotential: '',
        priorArtDetails: '',
        clarifications: [],
        inventors: [],
        abstract: '',
        detailedDescription: '',
        attachments: [],
        reviewStatus: d.reviewStatus,
        legalClearanceStatus: d.legalClearanceStatus
      }))
    : MOCK_DISCLOSURES;

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
          <p className="text-xs text-gray-400 mt-0.5">Lead: {disc.leadInventor.name}</p>
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
      key: 'reviewStatus',
      header: 'Review Status',
      className: 'w-36 text-xs',
      render: (disc: MockDisclosure) => (
        <span className="font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
          {(disc as any).reviewStatus || 'ASSIGNED'}
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
      <div className="space-y-4">
        {isBackendConnected && realDisclosures !== null ? (
          <div className="flex items-center justify-between p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-700 shrink-0" />
              <span>
                <strong>Live Reviewer Portfolio:</strong> Showing {realDisclosures.length} assigned disclosure(s) from PostgreSQL.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-mono text-[10px] font-bold">
              LIVE DATA
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>UI Preview Mode:</strong> Showing demonstration portfolio. Sign in as a Reviewer to view live records.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold">
              PREVIEW
            </span>
          </div>
        )}

        <DataTable
          columns={columns}
          data={displayData}
          rowKey={(d) => d.id}
          searchPlaceholder="Search assigned disclosures by title or tracking number..."
        />
      </div>
    </PortalShell>
  );
}
