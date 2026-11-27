'use client';

import React from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, type MockInventor } from '../../../data/mock-portal-data';
import { Users, Plus } from 'lucide-react';

export default function FacultyInventorsPage() {
  const inventors: (MockInventor & { disclosureTitle: string })[] = [];
  MOCK_DISCLOSURES.forEach((d) => {
    d.inventors.forEach((inv) => {
      inventors.push({ ...inv, disclosureTitle: d.title });
    });
  });

  const columns = [
    {
      key: 'name',
      header: 'Inventor',
      render: (inv: (typeof inventors)[0]) => (
        <div>
          <span className="font-bold text-gray-900">{inv.name}</span>
          <p className="text-xs text-gray-400">{inv.email}</p>
        </div>
      )
    },
    {
      key: 'affiliation',
      header: 'Affiliation & Lab',
      className: 'text-xs text-gray-600'
    },
    {
      key: 'role',
      header: 'Role',
      className: 'text-xs font-semibold text-gray-700'
    },
    {
      key: 'consentStatus',
      header: 'Consent Verification',
      render: (inv: (typeof inventors)[0]) => <StatusBadge status={inv.consentStatus} size="sm" />
    },
    {
      key: 'disclosureTitle',
      header: 'Research Project',
      render: (inv: (typeof inventors)[0]) => (
        <span className="text-xs text-gray-600 font-medium line-clamp-1">{inv.disclosureTitle}</span>
      )
    }
  ];

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/inventors"
      title="Research Co-Inventors & Students"
      subtitle="Authorship and contribution shares across faculty labs and student researchers"
    >
      <DataTable
        columns={columns}
        data={inventors}
        rowKey={(inv) => `${inv.id}-${inv.disclosureTitle}`}
        searchPlaceholder="Search research collaborators..."
      />
    </PortalShell>
  );
}
