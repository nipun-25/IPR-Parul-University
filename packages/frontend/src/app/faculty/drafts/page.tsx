'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, MOCK_USERS, type MockDisclosure } from '../../../data/mock-portal-data';
import { PlusCircle } from 'lucide-react';

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

export default function FacultyDraftsPage() {
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

  const mockDrafts = MOCK_DISCLOSURES.filter((d) => d.status === 'DRAFT');

  const displayDrafts: MockDisclosure[] = realDisclosures !== null
    ? realDisclosures
        .filter((d) => d.status === 'DRAFT')
        .map((d) => ({
          id: d.id,
          trackingNumber: d.trackingNumber || 'DRAFT-IN-PROGRESS',
          title: d.title,
          status: 'DRAFT',
          fieldOfInvention: 'Academic Research & Innovation',
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          leadInventor: { ...MOCK_USERS[1], name: 'Faculty Lead' },
          department: 'Department of Renewable Energy, PIT',
          commercialPotential: '',
          priorArtDetails: '',
          clarifications: [],
          inventors: [],
          abstract: '',
          detailedDescription: '',
          attachments: []
        }))
    : mockDrafts;

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
          href={`/faculty/disclosures/${disc.id}`}
          className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
        >
          View Draft
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
      isBackendConnected={isBackendConnected}
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
        data={displayDrafts}
        rowKey={(d) => d.id}
        searchPlaceholder="Search draft inventions..."
      />
    </PortalShell>
  );
}
