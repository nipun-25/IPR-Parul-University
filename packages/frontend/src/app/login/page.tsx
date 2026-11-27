'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const STUDENT_EMAIL_REGEX = /^[^@]+@paruluniversity\.ac\.in$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<{
    fullName: string;
    email: string;
    activeRoles: string[];
  } | null>(null);
  const [activeCsrfToken, setActiveCsrfToken] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!STUDENT_EMAIL_REGEX.test(normalizedEmail)) {
      setStatus('error');
      setErrorMessage('Please enter a valid @paruluniversity.ac.in institutional email address.');
      return;
    }

    if (!password) {
      setStatus('error');
      setErrorMessage('Password is required.');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

    try {
      // 1. Obtain short-lived pre-auth CSRF token and HttpOnly cookie
      const csrfRes = await fetch(`${backendUrl}/api/v1/auth/csrf`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!csrfRes.ok) {
        throw new Error('CSRF_BOOTSTRAP_FAILED');
      }

      const csrfData = await csrfRes.json();
      const csrfToken = csrfData?.csrfToken;
      if (!csrfToken || typeof csrfToken !== 'string') {
        throw new Error('INVALID_CSRF_TOKEN');
      }
      setActiveCsrfToken(csrfToken);

      // 2. Submit credentials with CSRF token in memory and credentials: 'include'
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ email: normalizedEmail, password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('success');
        setLoggedInUser(data.user);
        if (data.csrfToken) {
          setActiveCsrfToken(data.csrfToken);
        }
        // Redirect to Student Dashboard immediately upon successful login
        router.push('/dashboard');
      } else if (res.status === 429) {
        setStatus('error');
        setErrorMessage(data.detail || 'Too many login attempts from this IP. Please try again after 15 minutes.');
      } else {
        // Generic invalid credentials message (never reveals account existence or lockout state)
        setStatus('error');
        setErrorMessage(data.detail || 'Invalid institutional email or password.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Unable to contact authentication service. Please check your connection and try again.');
    }
  };

  const handleLogout = async () => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    try {
      let token = activeCsrfToken;
      if (!token) {
        const csrfRes = await fetch(`${backendUrl}/api/v1/auth/csrf`, {
          method: 'GET',
          credentials: 'include'
        });
        if (csrfRes.ok) {
          const csrfData = await csrfRes.json();
          token = csrfData.csrfToken;
        }
      }

      await fetch(`${backendUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-CSRF-Token': token } : {})
        },
        credentials: 'include'
      });
    } finally {
      setStatus('idle');
      setLoggedInUser(null);
      setPassword('');
      setActiveCsrfToken('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      {/* Top Portal Navigation */}
      <nav className="w-full max-w-md flex justify-between items-center text-xs text-gray-500 mb-4 px-2" aria-label="Portal Navigation">
        <Link href="/" className="hover:text-blue-600 transition flex items-center gap-1 font-medium">
          &larr; IPR Home
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-800 font-semibold transition"
            data-testid="nav-dashboard-link"
          >
            Dashboard
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/resend-verification" className="hover:text-blue-600 transition">
            Resend Email
          </Link>
        </div>
      </nav>

      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">IPR Portal Login</h2>
        <p className="text-sm text-gray-600 mb-6 text-center">
          Sign in using your Parul University institutional account.
        </p>

        {status === 'success' && loggedInUser ? (
          <div className="text-center space-y-4" data-testid="login-success">
            <div className="text-green-700 bg-green-50 p-4 rounded-md">
              <p className="font-semibold">Login Successful</p>
              <p className="text-sm mt-1">Welcome back, {loggedInUser.fullName}!</p>
              <p className="text-xs text-gray-500 mt-1">Active Roles: {loggedInUser.activeRoles.join(', ')}</p>
            </div>
            <div className="flex justify-center space-x-3">
              <Link
                href="/dashboard"
                className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow text-sm inline-block"
                data-testid="dashboard-link"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-md shadow text-sm"
                data-testid="logout-button"
              >
                Log Out
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Institutional Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@paruluniversity.ac.in"
                required
                disabled={status === 'submitting'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                data-testid="email-input"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={status === 'submitting'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                data-testid="password-input"
              />
            </div>

            {status === 'error' && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md" data-testid="status-error">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              data-testid="submit-button"
            >
              {status === 'submitting' ? 'Signing in...' : 'Log In'}
            </button>

            <div className="pt-2 text-center text-xs text-gray-500 space-y-1">
              <p>
                Need to verify your email?{' '}
                <a href="/verify-email" className="text-blue-600 underline">
                  Verify here
                </a>
              </p>
              <p>
                Didn&apos;t receive verification email?{' '}
                <a href="/resend-verification" className="text-blue-600 underline">
                  Resend link
                </a>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
