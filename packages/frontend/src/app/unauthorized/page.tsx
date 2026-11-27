'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Home, Lock } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 px-3 py-1 rounded-full border border-rose-200">
            HTTP 403 &bull; Access Forbidden
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Unauthorized Access
          </h1>
          <p className="text-xs text-gray-600 leading-relaxed">
            You do not possess the required institutional role privileges to access this sector of the Parul University IPR Portal.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 text-left border border-gray-100 space-y-2 text-xs text-gray-600">
          <p className="font-semibold text-gray-800 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-gray-500" /> Role Boundary Protection
          </p>
          <p>
            Under university intellectual property policy:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-500">
            <li>Reviewers cannot sign institutional consents or alter legal stages.</li>
            <li>Students cannot access privileged administrative panels.</li>
            <li>Legal filing updates require authorized Legal Team credentials.</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/student/dashboard"
            className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm text-center transition"
          >
            Go to Student Portal
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-sm text-center transition"
          >
            <Home className="w-3.5 h-3.5 text-gray-500" /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
