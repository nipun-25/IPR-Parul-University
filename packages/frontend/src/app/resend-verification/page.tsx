'use client';

import React, { useState } from 'react';

const STUDENT_EMAIL_REGEX = /^[^@]+@paruluniversity\.ac\.in$/;

export default function ResendVerificationPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!STUDENT_EMAIL_REGEX.test(normalizedEmail)) {
      setStatus('error');
      setMessage('Please enter a valid @paruluniversity.ac.in student email address.');
      return;
    }

    setStatus('submitting');
    setMessage('');

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

    try {
      // 1. Obtain short-lived pre-auth CSRF token and HttpOnly cookie into memory
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

      // 2. Submit resend request with CSRF token in memory
      const res = await fetch(`${backendUrl}/api/v1/auth/resend-verification`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ email: normalizedEmail })
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(
          data.message ||
            'If an unverified account exists for this email, a verification link has been sent to your institutional inbox.'
        );
      } else if (res.status === 429) {
        setStatus('error');
        setMessage(
          data.detail ||
            'Too many requests. Please wait a few moments before requesting another verification email.'
        );
      } else if (res.status === 400 && data.code === 'INVALID_STUDENT_EMAIL') {
        setStatus('error');
        setMessage('Verification email resend is restricted strictly to @paruluniversity.ac.in student emails.');
      } else {
        setStatus('error');
        setMessage('Unable to process your request at this time. Please try again later.');
      }
    } catch (err: unknown) {
      setStatus('error');
      setMessage('Network error. Unable to contact authentication service. Please check your connection and try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Resend Verification Email</h2>
        <p className="text-sm text-gray-600 mb-6 text-center">
          Enter your institutional student email address to receive a new verification link.
        </p>

        {status === 'success' ? (
          <div className="text-green-700 bg-green-50 p-4 rounded-md text-center" data-testid="status-success">
            <p className="font-semibold">{message}</p>
            <p className="mt-3 text-xs text-gray-500">
              Please check your institutional inbox (and spam folder) for the verification email.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="resend-form">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Student Email
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

            {status === 'error' && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md" data-testid="status-error">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              data-testid="submit-button"
            >
              {status === 'submitting' ? 'Submitting...' : 'Resend Verification Email'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
