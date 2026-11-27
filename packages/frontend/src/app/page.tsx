'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  GraduationCap,
  BookOpen,
  Award,
  Scale,
  Users,
  ArrowRight,
  CheckCircle2,
  Lock,
  ExternalLink
} from 'lucide-react';

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

  const portals = [
    {
      title: 'Student Portal',
      role: 'Student',
      desc: 'Submit invention disclosures, upload CAD & lab data, invite co-inventors, and track patent evaluations.',
      href: '/student/dashboard',
      color: 'blue',
      badge: 'Undergrad & Postgrad',
      icon: GraduationCap,
      btnClass: 'bg-blue-600 hover:bg-blue-700 text-white'
    },
    {
      title: 'Faculty Portal',
      role: 'Faculty',
      desc: 'Manage scientific lab disclosures, mentor student researchers, verify co-author shares, and track R&D subsidies.',
      href: '/faculty/dashboard',
      color: 'emerald',
      badge: 'Principal Investigators',
      icon: BookOpen,
      btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white'
    },
    {
      title: 'Reviewer Portal',
      role: 'Reviewer',
      desc: 'Conduct statutory novelty evaluations, non-obviousness scoring, and issue technical clarification requests.',
      href: '/reviewer/dashboard',
      color: 'purple',
      badge: 'Technical Panel',
      icon: Award,
      btnClass: 'bg-purple-600 hover:bg-purple-700 text-white'
    },
    {
      title: 'Legal & Patent Portal',
      role: 'Legal',
      desc: 'Form 1 & 2 IPO e-filing, advance statutory prosecution stages, manage FER notices, and oversee patent grants.',
      href: '/legal/dashboard',
      color: 'amber',
      badge: 'Patent Attorneys',
      icon: Scale,
      btnClass: 'bg-amber-600 hover:bg-amber-700 text-white'
    },
    {
      title: 'Admin Governance',
      role: 'Administrator',
      desc: 'University-wide user management, reviewer assignments, consent verification oversight, and NIRF / NAAC reports.',
      href: '/admin/dashboard',
      color: 'rose',
      badge: 'Dean & IPR Cell',
      icon: Shield,
      btnClass: 'bg-rose-600 hover:bg-rose-700 text-white'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Top University Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 text-white font-bold flex items-center justify-center text-lg shadow-sm">
              PU
            </div>
            <div>
              <span className="font-extrabold text-gray-900 text-base block leading-none">
                Parul University
              </span>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mt-0.5">
                IPR & Patent Cell &bull; Research & Development Directorate
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {isAuthenticated === true ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-600 hidden sm:inline">Signed in as <strong>{userName}</strong></span>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition"
                >
                  My Dashboard
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 font-semibold transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition"
                >
                  Student Registration
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-4">
        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full uppercase tracking-wider">
          Official Institutional Intellectual Property Repository
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight max-w-3xl mx-auto leading-tight">
          Protecting & Commercializing Parul University Innovations
        </h1>
        <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
          An integrated, role-based platform empowering students, faculty researchers, technical reviewers, and patent attorneys across all stages from initial disclosure to Indian Patent Office (IPO) grant.
        </p>

        {/* Quick Stats Pill */}
        <div className="pt-4 flex flex-wrap justify-center gap-6 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span><strong>100%</strong> Subsidized Patent E-Filing</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span><strong>ClamAV</strong> Antivirus Quarantine</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
            <span><strong>5 Role-Based</strong> Isolated Portals</span>
          </div>
        </div>
      </section>

      {/* 5 Portals Grid Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-gray-900">Select an Institutional Portal Workspace</h2>
          <p className="text-xs text-gray-500 mt-1">Explore live role-tailored dashboards and workflows</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portals.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.role}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md hover:border-gray-300 transition space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {p.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{p.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.desc}</p>
                </div>

                <div className="pt-2">
                  <Link
                    href={p.href}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition ${p.btnClass}`}
                  >
                    <span>Open {p.title}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-500">
        <p>&copy; {new Date().getFullYear()} Parul University. All Rights Reserved. Directorate of Research & Development.</p>
        <div className="mt-2 flex justify-center gap-4 text-[11px]">
          <Link href="/unauthorized" className="hover:text-gray-900">Security Policy</Link>
          <Link href="/account-status" className="hover:text-gray-900">Account Helpdesk</Link>
          <Link href="/login" className="hover:text-gray-900">Institutional Login</Link>
        </div>
      </footer>
    </div>
  );
}
