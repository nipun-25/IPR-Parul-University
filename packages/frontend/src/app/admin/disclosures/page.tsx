'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, MOCK_USERS, type MockDisclosure } from '../../../data/mock-portal-data';
import { Database, AlertCircle } from 'lucide-react';

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

export default function AdminDisclosuresPage() {
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
              setRealDisclosures(discData.disclosures || []);
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
      fieldOfInvention: 'Campus Innovation',
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      leadInventor: {
        ...MOCK_USERS[0],
        id: d.primaryInventorId,
        name: `Inventor (${d.primaryInventorId.slice(0, 8)})`,
        email: 'inventor@paruluniversity.ac.in',
        role: 'Student' as const,
        department: 'Academic Faculty'
      },
      department: 'Parul University Campus',
      commercialPotential: '',
      priorArtDetails: '',
      clarifications: [],
      inventors: [{
        id: d.primaryInventorId,
        name: `Lead (${d.primaryInventorId.slice(0, 8)})`,
        email: 'inventor@paruluniversity.ac.in',
        affiliation: 'Parul University (Internal)',
        role: 'Primary Inventor',
        consentStatus: 'VERIFIED' as const
      }],
      abstract: '',
      detailedDescription: '',
      attachments: [],
      reviewStatus: d.reviewStatus,
      legalClearanceStatus: d.legalClearanceStatus,
      assignedReviewer: d.assignedReviewerId ? {
        ...MOCK_USERS[4],
        id: d.assignedReviewerId,
        name: `Reviewer (${d.assignedReviewerId.slice(0, 8)}...)`,
        email: 'reviewer@paruluniversity.ac.in',
        role: 'Reviewer' as const,
        department: 'Expert Review Committee'
      } : undefined
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
      render: () => (
        <Link
          href={`/admin/assignments`}
          className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
        >
          Assign Reviewer
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
      <div className="space-y-4">
        {/* Connection status indicator */}
        {isBackendConnected && realDisclosures !== null ? (
          <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Live Database Connected:</strong> Displaying {realDisclosures.length} live institutional invention disclosure(s) from PostgreSQL.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px] font-bold">
              LIVE DATA
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>UI Preview Mode:</strong> Showing sample institutional disclosures. Log in as an Administrator to query live campus disclosures.
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
          searchPlaceholder="Search all disclosures by title or tracking number..."
        />
      </div>
    </PortalShell>
  );
}
