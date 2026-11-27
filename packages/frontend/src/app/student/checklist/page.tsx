'use client';

import React from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/layout/PortalShell';
import { CheckCircle2, AlertCircle, Clock, ShieldCheck, ArrowRight } from 'lucide-react';

export default function StudentChecklistPage() {
  const steps = [
    {
      title: '1. Invention PIDCS Completeness',
      desc: 'Title, technical abstract, detailed description, commercial value, and prior art limitations provided.',
      done: true
    },
    {
      title: '2. All Co-Inventors Added & Consents Verified',
      desc: 'Every contributor must have valid digital signature confirmation.',
      done: true
    },
    {
      title: '3. Technical Specifications Uploaded',
      desc: 'At least one clean, antivirus-certified PDF specification or diagram.',
      done: true
    },
    {
      title: '4. Lead Inventor Institutional Sign-off',
      desc: 'Acknowledgment of Parul University institutional ownership policy.',
      done: false
    }
  ];

  return (
    <PortalShell
      role="Student"
      currentPath="/student/checklist"
      title="Submission Readiness Checklist"
      subtitle="Ensure complete compliance with institutional standards before locking disclosure for evaluation"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div className="space-y-4">
          {steps.map((st, i) => (
            <div
              key={i}
              className={`p-4 rounded-xl border flex items-start gap-4 transition ${
                st.done
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-amber-50/60 border-amber-200'
              }`}
            >
              {st.done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4
                  className={`text-sm font-bold ${
                    st.done ? 'text-emerald-900' : 'text-amber-900'
                  }`}
                >
                  {st.title}
                </h4>
                <p
                  className={`text-xs mt-0.5 leading-relaxed ${
                    st.done ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {st.desc}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  st.done
                    ? 'bg-emerald-200 text-emerald-800'
                    : 'bg-amber-200 text-amber-800'
                }`}
              >
                {st.done ? 'Ready' : 'Pending'}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">3 of 4 Readiness Criteria Fulfilled</span>
          <Link
            href="/student/disclosures"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <span>Proceed to Inventions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </PortalShell>
  );
}
