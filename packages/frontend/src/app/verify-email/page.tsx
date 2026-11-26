'use client';

import React, { useEffect, useState, useRef } from 'react';
import { consumeVerificationToken } from '../../utils/token-scrubber';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate submission in React StrictMode or multiple re-renders
    if (hasRequestedRef.current) {
      return;
    }
    hasRequestedRef.current = true;

    // 1. Consume token from in-memory cache (scrubbed before hydration in <head>)
    const token = consumeVerificationToken();

    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification token. Please check your institutional email link.');
      return;
    }

    setStatus('verifying');

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

    // 2. Submit token strictly in the POST request body
    fetch(`${backendUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully. Your student account is now active.');
        } else {
          setStatus('error');
          setMessage(data.detail || 'The verification token is invalid, expired, or has already been used.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Network error. Unable to verify token at this time. Please try again.');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Email Verification</h2>
        {status === 'verifying' && (
          <p className="text-blue-600" data-testid="status-verifying">Verifying your institutional email...</p>
        )}
        {status === 'success' && (
          <div className="text-green-600" data-testid="status-success">
            <p className="font-semibold">{message}</p>
            <p className="mt-4 text-sm text-gray-600">You may now proceed to log in.</p>
          </div>
        )}
        {status === 'error' && (
          <div className="text-red-600" data-testid="status-error">
            <p className="font-semibold">{message}</p>
          </div>
        )}
        {status === 'idle' && (
          <p className="text-gray-500" data-testid="status-idle">Initializing verification...</p>
        )}
      </div>
    </div>
  );
}
