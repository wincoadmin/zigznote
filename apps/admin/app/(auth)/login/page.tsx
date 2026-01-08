'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      if (data.requiresTwoFactor) {
        setStep('2fa');
      } else {
        // Force a hard navigation to ensure cookie is applied
        window.location.href = '/';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: twoFactorCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Invalid code');
      }

      // Force a hard navigation to ensure cookie is applied
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
          <Shield className="w-8 h-8 text-primary-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Portal</h1>
        <p className="text-slate-500 mt-1">zigznote Administration</p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {step === 'credentials' ? (
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="admin@zigznote.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
          <div className="text-center mb-4">
            <p className="text-sm text-slate-600">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-1">
              Verification Code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-2xl tracking-widest px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="000000"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || twoFactorCode.length !== 6}
            className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep('credentials');
              setTwoFactorCode('');
              setError('');
            }}
            className="w-full py-2 px-4 text-slate-600 hover:text-slate-800 text-sm"
          >
            Back to login
          </button>
        </form>
      )}

      <div className="mt-8 pt-6 border-t border-slate-200 text-center">
        <p className="text-xs text-slate-400">
          Restricted access. All actions are logged.
        </p>
      </div>
    </div>
  );
}
