'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PortalShell } from '../../../../../components/layout/PortalShell';
import { MOCK_DISCLOSURES } from '../../../../../data/mock-portal-data';
import { Save, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function EditDraftPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const disclosure = MOCK_DISCLOSURES.find((d) => d.id === id) || MOCK_DISCLOSURES[3];

  const [title, setTitle] = useState(disclosure.title);
  const [field, setField] = useState(disclosure.fieldOfInvention);
  const [abstract, setAbstract] = useState(disclosure.abstract);
  const [description, setDescription] = useState(disclosure.detailedDescription);
  const [commercial, setCommercial] = useState(disclosure.commercialPotential);
  const [priorArt, setPriorArt] = useState(disclosure.priorArtDetails);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => {
      router.push(`/student/disclosures/${disclosure.id}`);
    }, 900);
  };

  return (
    <PortalShell
      role="Student"
      currentPath="/student/disclosures"
      title={`Edit Draft: ${disclosure.trackingNumber}`}
      subtitle="Update draft invention specifications before final submission"
      actions={
        <Link
          href={`/student/disclosures/${disclosure.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Discard Changes</span>
        </Link>
      }
    >
      <form onSubmit={handleSave} className="space-y-6">
        {saved && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Draft revisions saved! Redirecting to workspace...</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Invention Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Technical Field *</label>
            <input
              type="text"
              required
              value={field}
              onChange={(e) => setField(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Technical Abstract *</label>
            <textarea
              rows={4}
              required
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Detailed Description *</label>
            <textarea
              rows={6}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Commercial Potential</label>
              <textarea
                rows={3}
                value={commercial}
                onChange={(e) => setCommercial(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Prior Art Limitations</label>
              <textarea
                rows={3}
                value={priorArt}
                onChange={(e) => setPriorArt(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <Save className="w-4 h-4" />
            <span>Update Draft</span>
          </button>
        </div>
      </form>
    </PortalShell>
  );
}
