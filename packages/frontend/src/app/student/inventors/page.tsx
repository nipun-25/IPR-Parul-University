'use client';

import React, { useState } from 'react';
import { PortalShell } from '../../../components/layout/PortalShell';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, type MockInventor } from '../../../data/mock-portal-data';
import { Users, Plus, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function StudentInventorsPage() {
  const allInventors: (MockInventor & { disclosureTitle: string })[] = [];
  MOCK_DISCLOSURES.forEach((d) => {
    d.inventors.forEach((inv) => {
      allInventors.push({ ...inv, disclosureTitle: d.title });
    });
  });

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invited, setInvited] = useState(false);

  const columns = [
    {
      key: 'name',
      header: 'Inventor',
      render: (inv: (typeof allInventors)[0]) => (
        <div>
          <span className="font-bold text-gray-900">{inv.name}</span>
          <p className="text-xs text-gray-400">{inv.email}</p>
        </div>
      )
    },
    {
      key: 'affiliation',
      header: 'Affiliation',
      className: 'text-xs text-gray-600'
    },
    {
      key: 'role',
      header: 'Inventor Role',
      className: 'text-xs font-semibold text-gray-700'
    },
    {
      key: 'consentStatus',
      header: 'Consent Verification',
      render: (inv: (typeof allInventors)[0]) => <StatusBadge status={inv.consentStatus} size="sm" />
    },
    {
      key: 'disclosureTitle',
      header: 'Associated Disclosure',
      render: (inv: (typeof allInventors)[0]) => (
        <span className="text-xs text-gray-600 font-medium line-clamp-1">{inv.disclosureTitle}</span>
      )
    }
  ];

  return (
    <PortalShell
      role="Student"
      currentPath="/student/inventors"
      title="Inventor Management"
      subtitle="Manage lead and co-inventors across Parul University institutes and external academic collaborators"
      actions={
        <button
          onClick={() => setInviteModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Invite Co-Inventor</span>
        </button>
      }
    >
      <DataTable
        columns={columns}
        data={allInventors}
        rowKey={(inv) => `${inv.id}-${inv.disclosureTitle}`}
        searchPlaceholder="Search inventors by name or email..."
        searchFilter={(inv, q) =>
          inv.name.toLowerCase().includes(q) ||
          inv.email.toLowerCase().includes(q) ||
          inv.disclosureTitle.toLowerCase().includes(q)
        }
      />

      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Invite Co-Inventor</h3>
            <p className="text-xs text-gray-500">
              Co-inventors will receive a secure tokenized email invitation to verify their authorship consent.
            </p>

            {invited ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Invitation dispatched to {inviteEmail}!</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Verma"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Institutional Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@paruluniversity.ac.in"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setInviteModalOpen(false);
                  setInvited(false);
                }}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
              {!invited && (
                <button
                  type="button"
                  onClick={() => setInvited(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Send Invitation
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
