'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalShell } from '../../../components/layout/PortalShell';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function FacultyCreateDisclosurePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [field, setField] = useState('');
  const [grantDetails, setGrantDetails] = useState('');
  const [abstract, setAbstract] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [isBackendConnected, setIsBackendConnected] = useState(false);

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
            setCsrfToken(data.csrfToken || '');
          }
        }
      } catch {
        // Fallback to preview mode
      }
    }
    checkSession();
  }, [backendUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    if (isBackendConnected) {
      try {
        const res = await fetch('/api/bff/drafts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          credentials: 'include',
          body: JSON.stringify({
            title: title.trim(),
            pidcsData: {
              fieldOfInvention: field.trim(),
              grantDetails: grantDetails.trim(),
              abstract: abstract.trim(),
              detailedDescription: description.trim()
            }
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || errData.title || 'Failed to submit draft disclosure');
        }

        setSaved(true);
        setTimeout(() => {
          router.push('/faculty/disclosures');
        }, 1200);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Submission failed');
        setSubmitting(false);
      }
    } else {
      // Preview mode simulation
      setSaved(true);
      setTimeout(() => {
        router.push('/faculty/disclosures');
      }, 1000);
    }
  };

  return (
    <PortalShell
      role="Faculty"
      currentPath="/faculty/create"
      title="Submit Faculty Research Disclosure"
      subtitle="Parul University R&D Directorate • Academic Invention & Patent Specification"
      isBackendConnected={isBackendConnected}
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
            <span>Research disclosure draft recorded. Redirecting to disclosures...</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-xs text-red-700">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
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
              placeholder="Provide a concise summary of the scientific problem addressed and technical advancement..."
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Detailed Technical Description & Working Principle *</label>
            <textarea
              rows={6}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Elaborate structural design, chemistry, circuitry, or algorithmic implementation enabling technical reproducibility..."
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/faculty/disclosures"
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || saved}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
          >
            {submitting ? 'Saving Draft...' : 'Save Research Draft'}
          </button>
        </div>
      </form>
    </PortalShell>
  );
}
