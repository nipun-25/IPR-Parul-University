'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalShell } from '../../../components/layout/PortalShell';
import { FileText, Save, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function CreateDisclosurePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [fieldOfInvention, setFieldOfInvention] = useState('');
  const [abstract, setAbstract] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [commercialPotential, setCommercialPotential] = useState('');
  const [priorArtDetails, setPriorArtDetails] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setStatus('error');
      return;
    }
    setStatus('saving');
    setTimeout(() => {
      setStatus('saved');
      setTimeout(() => {
        router.push('/student/disclosures');
      }, 1000);
    }, 700);
  };

  return (
    <PortalShell
      role="Student"
      currentPath="/student/create"
      title="Create Invention Disclosure"
      subtitle="Parul Institute of Technology • Provisional Invention Disclosure Form (PIDCS)"
      actions={
        <Link
          href="/student/disclosures"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </Link>
      }
    >
      <form onSubmit={handleSaveDraft} className="space-y-6">
        {status === 'saved' && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Draft invention disclosure saved successfully! Redirecting to repository...</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-gray-900">1. Invention General Identification</h2>
            <p className="text-xs text-gray-500">Provide a clear, descriptive title and technical domain</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Title of Invention *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Smart Solar Thermal Energy Harvester with Integrated Phase Change Materials"
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Technical Field of Invention *
            </label>
            <input
              type="text"
              required
              value={fieldOfInvention}
              onChange={(e) => setFieldOfInvention(e.target.value)}
              placeholder="e.g. Renewable Energy, Nanotechnology, IoT Edge Computing"
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-gray-900">2. Technical Disclosure Specification</h2>
            <p className="text-xs text-gray-500">Detailed PIDCS technical disclosure parameters</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Technical Abstract *
            </label>
            <textarea
              rows={4}
              required
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Concise technical summary describing the problem and your novel technical solution..."
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Detailed Description & Working Principle *
            </label>
            <textarea
              rows={6}
              required
              value={detailedDescription}
              onChange={(e) => setDetailedDescription(e.target.value)}
              placeholder="Complete structural, chemical, or algorithmic description enabling a person skilled in the art to replicate..."
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Commercial & Industrial Potential
              </label>
              <textarea
                rows={4}
                value={commercialPotential}
                onChange={(e) => setCommercialPotential(e.target.value)}
                placeholder="Target industry, market applications, cost benefits..."
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Prior Art Details & Deficiencies
              </label>
              <textarea
                rows={4}
                value={priorArtDetails}
                onChange={(e) => setPriorArtDetails(e.target.value)}
                placeholder="Existing patents or published papers, and how your invention overcomes their limitations..."
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/student/disclosures"
            className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={status === 'saving'}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{status === 'saving' ? 'Saving Draft...' : 'Save Invention Draft'}</span>
          </button>
        </div>
      </form>
    </PortalShell>
  );
}
