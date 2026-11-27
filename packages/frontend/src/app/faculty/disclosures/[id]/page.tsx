'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PortalShell } from '../../../../components/layout/PortalShell';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { MOCK_DISCLOSURES, MOCK_USERS, type MockDisclosure } from '../../../../data/mock-portal-data';
import { ArrowLeft, Users, Paperclip, Download } from 'lucide-react';

export default function FacultyDisclosureDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [liveDisclosure, setLiveDisclosure] = useState<MockDisclosure | null>(null);

  const mockDisclosure = MOCK_DISCLOSURES.find((d) => d.id === id) || MOCK_DISCLOSURES[2];
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    async function fetchLiveDetail() {
      if (!id) return;
      try {
        const sessionRes = await fetch(`${backendUrl}/api/v1/auth/session`, {
          credentials: 'include'
        });
        if (sessionRes.ok) {
          const sessData = await sessionRes.json();
          if (sessData.authenticated) {
            setIsBackendConnected(true);

            // Fetch live disclosure
            const discRes = await fetch(`/api/bff/disclosures/${id}`, {
              credentials: 'include'
            });
            if (discRes.ok) {
              const d = await discRes.json();
              const discData = d.disclosure || d;

              // Also fetch consents and attachments
              let consents = [];
              let attachments = [];
              const [cRes, aRes] = await Promise.all([
                fetch(`/api/bff/disclosures/${id}/consents`, { credentials: 'include' }),
                fetch(`/api/bff/disclosures/${id}/attachments`, { credentials: 'include' })
              ]);
              if (cRes.ok) {
                const cData = await cRes.json();
                consents = cData.consents || [];
              }
              if (aRes.ok) {
                const aData = await aRes.json();
                attachments = aData.attachments || [];
              }

              setLiveDisclosure({
                id: discData.id,
                trackingNumber: discData.trackingNumber || 'DRAFT-IN-PROGRESS',
                title: discData.title,
                status: discData.status,
                fieldOfInvention: discData.pidcsData?.fieldOfInvention || 'Scientific Research',
                abstract: discData.pidcsData?.abstract || 'No abstract provided in draft.',
                detailedDescription: discData.pidcsData?.detailedDescription || 'No detailed specifications entered.',
                leadInventor: {
                  ...MOCK_USERS[1],
                  name: sessData.user.fullName || 'Faculty Lead',
                  email: sessData.user.email || 'faculty@paruluniversity.ac.in',
                  role: 'Faculty' as const
                },
                department: 'Department of Renewable Energy, PIT',
                commercialPotential: '',
                priorArtDetails: '',
                clarifications: [],
                inventors: consents.length > 0
                  ? consents.map((c: { id: string; userId: string; status: string; shareBasisPoints: number; externalName?: string; externalEmail?: string }) => ({
                      id: c.id,
                      name: c.externalName || 'Co-Inventor',
                      email: c.externalEmail || 'co.inventor@paruluniversity.ac.in',
                      role: 'Faculty' as const,
                      consentStatus: (c.status || 'PENDING') as 'PENDING' | 'VERIFIED' | 'REVOKED',
                      basisPoints: c.shareBasisPoints || 5000
                    }))
                  : [{ id: discData.primaryInventorId, name: sessData.user.fullName, email: sessData.user.email, role: 'Faculty', consentStatus: 'VERIFIED', basisPoints: 10000 }],
                attachments: attachments.map((a: { id: string; fileName: string; scanStatus: string; fileSizeBytes: number; createdAt: string }) => ({
                  id: a.id,
                  filename: a.fileName,
                  fileSize: `${Math.round((a.fileSizeBytes || 1024) / 1024)} KB`,
                  uploadedAt: a.createdAt || new Date().toISOString(),
                  scanStatus: (a.scanStatus || 'CLEAN') as 'CLEAN' | 'QUARANTINED' | 'SCANNED_INFECTED'
                })),
                createdAt: discData.createdAt,
                updatedAt: discData.updatedAt
              });
            }
          }
        }
      } catch {
        // Fallback to mock
      }
    }
    fetchLiveDetail();
  }, [id, backendUrl]);

  const disclosure = liveDisclosure || mockDisclosure;

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/disclosures"
      title={disclosure.title}
      subtitle={`Tracking No: ${disclosure.trackingNumber} • Lead: ${disclosure.leadInventor.name}`}
      isBackendConnected={isBackendConnected}
      actions={
        <Link
          href="/faculty/disclosures"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Disclosures</span>
        </Link>
      }
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Stage:</span>
          <StatusBadge status={disclosure.status} />
        </div>
        <div className="text-gray-400">
          Created: {new Date(disclosure.createdAt).toLocaleDateString()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
              Abstract & Novelty
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">{disclosure.abstract}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
              Specification & Experimental Data
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
              {disclosure.detailedDescription}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <Users className="w-4 h-4 text-emerald-600" /> Research Co-Authors
            </h3>
            <div className="space-y-2">
              {disclosure.inventors.map((inv) => (
                <div key={inv.id} className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">{inv.name}</span>
                    <StatusBadge status={inv.consentStatus} size="sm" />
                  </div>
                  <p className="text-[11px] text-gray-400">{inv.email}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <Paperclip className="w-4 h-4 text-emerald-600" /> Uploaded Schematics
            </h3>
            <div className="space-y-2">
              {disclosure.attachments.map((att) => (
                <div key={att.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-gray-900">{att.filename}</p>
                    <StatusBadge status={att.scanStatus} size="sm" className="mt-1" />
                  </div>
                  <Download className="w-4 h-4 text-gray-400" />
                </div>
              ))}
              {disclosure.attachments.length === 0 && (
                <p className="text-xs text-gray-400 italic">No attachments uploaded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
