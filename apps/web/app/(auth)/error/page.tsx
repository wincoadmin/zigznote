'use client';

/**
 * Auth Error Page
 * Displays authentication errors
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icons } from '@/components/ui/icons';

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The verification link may have expired or already been used.',
  OAuthSignin: 'Error starting the OAuth sign-in flow.',
  OAuthCallback: 'Error in the OAuth callback.',
  OAuthCreateAccount: 'Could not create OAuth account.',
  EmailCreateAccount: 'Could not create account with this email.',
  Callback: 'Error in the authentication callback.',
  OAuthAccountNotLinked: 'This email is already associated with another account. Try signing in with a different method.',
  EmailSignin: 'The email could not be sent.',
  CredentialsSignin: 'Invalid email or password.',
  SessionRequired: 'You must be signed in to access this page.',
  Default: 'An unexpected error occurred.',
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessage = error
    ? errorMessages[error] || errorMessages.Default
    : errorMessages.Default;

  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
        <Icons.x className="w-8 h-8 text-red-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h2>
      <p className="text-gray-600 mb-6">{errorMessage}</p>

      {error === 'OAuthAccountNotLinked' && (
        <p className="text-sm text-gray-500 mb-4">
          Try signing in with the method you used when you first created your account.
        </p>
      )}

      <div className="space-y-3">
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center w-full py-3 px-4 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Try again
        </Link>

        <Link
          href="/"
          className="inline-flex items-center justify-center w-full py-3 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Go to homepage
        </Link>
      </div>

      <p className="mt-6 text-sm text-gray-500">
        If this problem persists, please{' '}
        <a href="mailto:support@zigznote.com" className="text-emerald-600 hover:underline">
          contact support
        </a>
        .
      </p>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="text-center py-8">
        <Icons.spinner className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
