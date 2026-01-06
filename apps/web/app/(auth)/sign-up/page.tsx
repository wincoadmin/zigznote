'use client';

/**
 * Sign Up Page
 * Handles user registration with email/password and OAuth
 */

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/icons';

type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export default function SignUpPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    strength: PasswordStrength;
    score: number;
    errors: string[];
  } | null>(null);

  const validatePassword = (pwd: string) => {
    const errors: string[] = [];
    let score = 0;

    if (pwd.length >= 8) score++;
    else errors.push('At least 8 characters');

    if (pwd.length >= 12) score++;
    if (pwd.length >= 16) score++;

    if (/[A-Z]/.test(pwd)) score++;
    else errors.push('One uppercase letter');

    if (/[a-z]/.test(pwd)) score++;
    else errors.push('One lowercase letter');

    if (/[0-9]/.test(pwd)) score++;
    else errors.push('One number');

    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++;
    else errors.push('One special character');

    let strength: PasswordStrength;
    if (score <= 3) strength = 'weak';
    else if (score <= 5) strength = 'fair';
    else if (score <= 6) strength = 'good';
    else strength = 'strong';

    setPasswordStrength({ strength, score, errors });
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value) {
      validatePassword(value);
    } else {
      setPasswordStrength(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error || 'Registration failed');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setFormError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(true);
    setFormError(null);

    try {
      await signIn(provider, { callbackUrl: '/dashboard' });
    } catch (err) {
      setFormError('Failed to sign in with ' + provider);
      setIsLoading(false);
    }
  };

  const strengthColors = {
    weak: 'bg-red-500',
    fair: 'bg-yellow-500',
    good: 'bg-emerald-400',
    strong: 'bg-emerald-600',
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
          <Icons.mail className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
        <p className="text-gray-600 mb-6">
          We&apos;ve sent a verification link to <strong>{email}</strong>
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Click the link in the email to verify your account and sign in.
        </p>
        <Link
          href="/sign-in"
          className="text-emerald-600 font-medium hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
        Create your account
      </h2>

      {formError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {formError}
        </div>
      )}

      {/* OAuth Buttons */}
      <div className="space-y-3 mb-6">
        <button
          onClick={() => handleOAuthSignIn('google')}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
        >
          <Icons.google className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Continue with Google</span>
        </button>

        <button
          onClick={() => handleOAuthSignIn('github')}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
        >
          <Icons.github className="w-5 h-5" />
          <span className="font-medium">Continue with GitHub</span>
        </button>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">or continue with email</span>
        </div>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="John"
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Doe"
            />
          </div>
        </div>

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

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 pr-12"
              placeholder="Create a strong password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? (
                <Icons.eyeOff className="w-5 h-5" />
              ) : (
                <Icons.eye className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Password Strength Indicator */}
          {passwordStrength && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i < Math.ceil(passwordStrength.score / 2)
                        ? strengthColors[passwordStrength.strength]
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs ${
                passwordStrength.strength === 'weak' ? 'text-red-600' :
                passwordStrength.strength === 'fair' ? 'text-yellow-600' :
                'text-emerald-600'
              }`}>
                Password strength: {passwordStrength.strength}
              </p>
              {passwordStrength.errors.length > 0 && passwordStrength.strength !== 'strong' && (
                <p className="text-xs text-gray-500 mt-1">
                  Missing: {passwordStrength.errors.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || passwordStrength?.strength === 'weak'}
          className="w-full py-3 px-4 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Icons.spinner className="w-5 h-5 animate-spin" />
              Creating account...
            </span>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      {/* Sign In Link */}
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-emerald-600 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
