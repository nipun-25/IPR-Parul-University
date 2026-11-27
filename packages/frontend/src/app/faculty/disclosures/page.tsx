'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, MOCK_USERS, type MockDisclosure } from '../../../data/mock-portal-data';
import { PlusCircle, Eye, Users } from 'lucide-react';

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

export default function FacultyDisclosuresPage() {
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [realDisclosures, setRealDisclosures] = useState<DisclosureListItemDto[] | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch(`${backendUrl}/api/v1/auth/session`, {
          credentials: 'include'
        });

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
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

    checkSession();
  }, [backendUrl]);

  const displayData: MockDisclosure[] = realDisclosures !== null
    ? realDisclosures.map((d) => ({
        id: d.id,
        trackingNumber: d.trackingNumber || 'DRAFT-PENDING',
        title: d.title,
        status: d.status as any,
        fieldOfInvention: 'Renewable Energy & Materials Science',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        leadInventor: { ...MOCK_USERS[1], name: 'Faculty Lead' },
        department: 'Department of Renewable Energy, PIT',
        commercialPotential: '',
        priorArtDetails: '',
        clarifications: [],
        inventors: [{
          id: d.primaryInventorId,
          name: 'Faculty Inventor',
          email: 'faculty@paruluniversity.ac.in',
          affiliation: 'Parul University (Internal)',
          role: 'Primary Inventor',
          consentStatus: 'VERIFIED' as const
        }],
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
      isBackendConnected={isBackendConnected}
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
        data={displayData}
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
