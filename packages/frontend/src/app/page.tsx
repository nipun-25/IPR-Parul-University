'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    fetch(`${backendUrl}/api/v1/auth/session`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data) => {
        if (data.authenticated && data.user) {
          setIsAuthenticated(true);
          setUserName(data.user.fullName || data.user.email);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-md p-8 text-center space-y-6">
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full uppercase tracking-wider">
            Official Institutional Portal
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900">
            Parul University IPR Portal
          </h1>
          <p className="text-gray-600 text-sm max-w-lg mx-auto">
            Intellectual Property Rights Management System for Students, Faculty, and Researchers.
            Submit, track, and protect invention disclosures seamlessly.
          </p>
        </div>

        {isAuthenticated === true ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-3">
            <p className="text-sm text-blue-900 font-medium">
              Signed in as <span className="font-bold">{userName}</span>
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm text-sm transition"
              >
                Go to Student Dashboard &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Link
              href="/login"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm text-sm transition"
            >
              Institutional Login
            </Link>
            <Link
              href="/resend-verification"
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm transition"
            >
              Verify Institutional Email
            </Link>
          </div>
        )}

        <div className="border-t border-gray-100 pt-6 text-xs text-gray-400">
          Strictly restricted to authorized Parul University stakeholders (@paruluniversity.ac.in).
        </div>
      </div>
    </div>
  );
}
