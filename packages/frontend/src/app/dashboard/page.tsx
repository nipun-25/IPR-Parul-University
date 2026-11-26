'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DisclosureListItemDto } from '@ipr/shared';

interface UserSession {
  id: string;
  email: string;
  fullName: string;
  activeRoles: string[];
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [disclosures, setDisclosures] = useState<DisclosureListItemDto[]>([]);
  const [error, setError] = useState<string>('');

  // New Draft Creation modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError('');
      try {
        // 1. Resolve authentic session and session-bound CSRF token
        const sessRes = await fetch(`${backendUrl}/api/v1/auth/session`, {
          credentials: 'include'
        });

        if (!sessRes.ok) {
          router.push('/login');
          return;
        }

        const sessData = await sessRes.json();
        if (!sessData.authenticated || !sessData.user) {
          router.push('/login');
          return;
        }

        setUser(sessData.user);
        setCsrfToken(sessData.csrfToken || '');

        // 2. Query student disclosures list via BFF
        const discRes = await fetch('/api/bff/disclosures', {
          credentials: 'include'
        });

        if (discRes.ok) {
          const discData = await discRes.json();
          setDisclosures(discData.disclosures || []);
        } else {
          setError('Failed to load disclosure records from portal backend.');
        }
      } catch {
        setError('Network error while communicating with IPR Portal services.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [backendUrl, router]);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError('Please enter an invention disclosure title.');
      return;
    }

    setCreating(true);
    setCreateError('');

    try {
      const res = await fetch('/api/bff/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ title: newTitle.trim(), pidcsData: {} })
      });

      const data = await res.json();
      if (res.ok && data.success && data.draftId) {
        setShowCreateModal(false);
        router.push(`/disclosures/${data.draftId}`);
      } else {
        setCreateError(data.detail || data.message || 'Failed to initialize draft disclosure.');
      }
    } catch {
      setCreateError('Network error while creating draft disclosure.');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${backendUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });
    } finally {
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-gray-600 font-medium animate-pulse" data-testid="dashboard-loading">
          Loading student workspace...
        </div>
      </div>
    );
  }

  const draftCount = disclosures.filter((d) => d.status === 'DRAFT').length;
  const submittedCount = disclosures.filter((d) => d.status === 'SUBMITTED').length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-blue-700 font-semibold">Parul University IPR Portal</span>
          <h1 className="text-xl font-bold text-gray-900">Student Innovation Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-800" data-testid="user-name">{user?.fullName}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition"
            data-testid="dashboard-logout"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Inventions</p>
            <p className="text-3xl font-extrabold text-blue-600 mt-1" data-testid="metric-total">{disclosures.length}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Drafts</p>
            <p className="text-3xl font-extrabold text-amber-500 mt-1" data-testid="metric-drafts">{draftCount}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted Disclosures</p>
            <p className="text-3xl font-extrabold text-green-600 mt-1" data-testid="metric-submitted">{submittedCount}</p>
          </div>
        </div>

        {/* Disclosures Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Your Disclosures</h2>
              <p className="text-sm text-gray-500">Track and manage your submitted inventions and in-progress drafts.</p>
            </div>
            <button
              onClick={() => {
                setNewTitle('');
                setCreateError('');
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition inline-flex items-center gap-2"
              data-testid="create-draft-btn"
            >
              <span>+</span> New Disclosure Draft
            </button>
          </div>

          {/* List or Empty State */}
          {disclosures.length === 0 ? (
            <div className="text-center py-12 px-4" data-testid="empty-disclosures">
              <p className="text-gray-500 font-medium">No disclosure drafts or submissions found.</p>
              <p className="text-xs text-gray-400 mt-1">Click &ldquo;New Disclosure Draft&rdquo; above to start your invention disclosure.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" data-testid="disclosures-table">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3">Invention Title</th>
                    <th className="px-6 py-3">Tracking Number</th>
                    <th className="px-6 py-3">Lifecycle Status</th>
                    <th className="px-6 py-3">Review Status</th>
                    <th className="px-6 py-3">Last Modified</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {disclosures.map((disc) => (
                    <tr key={disc.id} className="hover:bg-gray-50 transition" data-testid={`disclosure-row-${disc.id}`}>
                      <td className="px-6 py-4 font-semibold text-gray-900">{disc.title}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">
                        {disc.trackingNumber || (
                          <span className="text-gray-400 italic">Pending Submission</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            disc.status === 'SUBMITTED'
                              ? 'bg-green-100 text-green-800'
                              : disc.status === 'DRAFT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {disc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">{disc.reviewStatus || 'UNASSIGNED'}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {new Date(disc.updatedAt || disc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/disclosures/${disc.id}`}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded text-xs transition"
                          data-testid={`manage-btn-${disc.id}`}
                        >
                          {disc.status === 'DRAFT' ? 'Edit Draft' : 'View Details'} &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create Draft Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" data-testid="create-modal">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">Create New Disclosure Draft</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="space-y-4">
              <div>
                <label htmlFor="new-title" className="block text-sm font-medium text-gray-700 mb-1">
                  Invention Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="new-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Autonomous Robotic Weed Harvester with Optical Recognition"
                  required
                  disabled={creating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100"
                  data-testid="modal-title-input"
                />
              </div>

              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-md" data-testid="modal-error">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-sm shadow-sm transition disabled:bg-blue-300"
                  data-testid="modal-submit-btn"
                >
                  {creating ? 'Initializing...' : 'Create Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
