'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalShell } from '../../../components/layout/PortalShell';
import { Scale, Save, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function LegalFilingPage() {
  const router = useRouter();
  const [appNumber, setAppNumber] = useState('');
  const [cbrNumber, setCbrNumber] = useState('');
  const [title, setTitle] = useState('');
  const [leadInventor, setLeadInventor] = useState('');
  const [jurisdiction, setJurisdiction] = useState('Indian Patent Office (Mumbai)');
  const [filingDate, setFilingDate] = useState(new Date().toISOString().split('T')[0]);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => {
      router.push('/legal/patents');
    }, 1000);
  };

  return (
    <PortalShell
      role="Legal"
      currentPath="/legal/filing"
      title="Prepare Official Patent Filing (Form 1 & 2)"
      subtitle="E-filing record creation for the Controller General of Patents, Designs and Trade Marks (IPO)"
      actions={
        <Link
          href="/legal/patents"
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
            <span>Official patent filing entry created! Redirecting to portfolio...</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
            1. IPO Statutory Identification Numbers
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Official Application Number *</label>
              <input
                type="text"
                required
                value={appNumber}
                onChange={(e) => setAppNumber(e.target.value)}
                placeholder="e.g. 202621004821"
                className="w-full px-3 py-2 font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">CBR (Cash Book Receipt) Number *</label>
              <input
                type="text"
                required
                value={cbrNumber}
                onChange={(e) => setCbrNumber(e.target.value)}
                placeholder="e.g. CBR-2026-MUM-89124"
                className="w-full px-3 py-2 font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
            2. Invention & Jurisdictional Registry
          </h3>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Patent Title as Filed *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Smart Solar Thermal Energy Harvester..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Lead Inventor *</label>
              <input
                type="text"
                required
                value={leadInventor}
                onChange={(e) => setLeadInventor(e.target.value)}
                placeholder="e.g. Nipun Kulshrestha"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Filing Jurisdiction</label>
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option>Indian Patent Office (Mumbai)</option>
                <option>Indian Patent Office (Delhi)</option>
                <option>PCT / International WIPO Filing</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Filing Date</label>
              <input
                type="date"
                required
                value={filingDate}
                onChange={(e) => setFilingDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <Save className="w-4 h-4" />
            <span>Record Patent Filing</span>
          </button>
        </div>
      </form>
    </PortalShell>
  );
}
