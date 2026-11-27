'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, ShieldX, PhoneCall, Mail, ArrowLeft } from 'lucide-react';

export default function AccountStatusPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Clock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Account Status & Verification
          </h1>
          <p className="text-xs text-gray-600 max-w-sm mx-auto leading-relaxed">
            Information regarding pending verification, administrative approval, or institutional status.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Faculty / Reviewer Approval Pending
            </h3>
            <p className="text-xs text-amber-800 leading-relaxed">
              Faculty and Reviewer accounts require manual institutional validation by the Dean of Research & Development before full evaluation privileges are unlocked.
            </p>
          </div>

          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Student Email Activation
            </h3>
            <p className="text-xs text-blue-800 leading-relaxed">
              If your student account has not yet been activated, please check your student email for the activation link, or request a new one via the resend tool.
            </p>
            <div className="pt-1">
              <Link
                href="/resend-verification"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
              >
                Resend student email verification link &rarr;
              </Link>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-xs text-gray-600">
            <h4 className="font-bold text-gray-800">IPR Cell Helpdesk & Contact:</h4>
            <div className="space-y-1 text-gray-500">
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gray-400" /> ipr.cell@paruluniversity.ac.in
              </p>
              <p className="flex items-center gap-2">
                <PhoneCall className="w-3.5 h-3.5 text-gray-400" /> +91 (02668) 260300 (Ext. 402)
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
