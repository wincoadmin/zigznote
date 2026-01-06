'use client';

/**
 * Verify Email Page
 * Handles email verification via token
 */

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icons } from '@/components/ui/icons';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'resend'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('resend');
        setMessage('No verification token provided');
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message);
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed');
        }
      } catch (err) {
        setStatus('error');
        setMessage('An error occurred during verification');
      }
    };

    verifyEmail();
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResending(true);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      setMessage(data.message);
      setStatus('success');
    } catch (err) {
      setMessage('Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="text-center py-8">
        <Icons.spinner className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
        <p className="text-gray-600">Verifying your email...</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
          <Icons.check className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Email verified!</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center py-3 px-6 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Sign in to your account
        </Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <Icons.x className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification failed</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <button
          onClick={() => setStatus('resend')}
          className="text-emerald-600 font-medium hover:underline"
        >
          Resend verification email
        </button>
      </div>
    );
  }

  // Resend form
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
        Resend verification email
      </h2>
      <p className="text-gray-600 text-center mb-6">
        Enter your email address and we&apos;ll send you a new verification link.
      </p>

      <form onSubmit={handleResend} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="you@example.com"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isResending}
          className="w-full py-3 px-4 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isResending ? (
            <span className="flex items-center justify-center gap-2">
              <Icons.spinner className="w-5 h-5 animate-spin" />
              Sending...
            </span>
          ) : (
            'Resend verification email'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        <Link href="/sign-in" className="text-emerald-600 font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="text-center py-8">
        <Icons.spinner className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
