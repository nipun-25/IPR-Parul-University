'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalShell } from '../../../components/layout/PortalShell';
import { Save, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function FacultyCreateDisclosurePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [field, setField] = useState('');
  const [grantDetails, setGrantDetails] = useState('');
  const [abstract, setAbstract] = useState('');
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => {
      router.push('/faculty/disclosures');
    }, 1000);
  };

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/create"
      title="Submit Faculty Research Disclosure"
      subtitle="Parul University R&D Directorate • Academic Invention & Patent Specification"
      actions={
        <Link
          href="/faculty/disclosures"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {saved && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Research disclosure draft recorded. Redirecting...</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
            1. Research Identification & Grant Sponsorship
          </h3>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Invention Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Autonomous Drone-Assisted Precision Irrigation with Multi-Spectral Soil Moisture Sensing"
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Scientific Domain *</label>
              <input
                type="text"
                required
                value={field}
                onChange={(e) => setField(e.target.value)}
                placeholder="e.g. Agricultural Robotics, Nanotechnology"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Grant / Funding Source (Optional)</label>
              <input
                type="text"
                value={grantDetails}
                onChange={(e) => setGrantDetails(e.target.value)}
                placeholder="e.g. DST-SERB, GUJCOST, Institutional Seed Grant"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
            2. Scientific Specification & Claims Outline
          </h3>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Technical Abstract *</label>
            <textarea
              rows={4}
              required
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Summary of scientific methodology and experimental validation..."
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Detailed Working Formulation *</label>
            <textarea
              rows={6}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Full reproducibility protocol and thermodynamic/chemical/algorithmic specifications..."
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 leading-relaxed"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <Save className="w-4 h-4" />
            <span>Save Research Disclosure</span>
          </button>
        </div>
      </form>
    </PortalShell>
  );
}
