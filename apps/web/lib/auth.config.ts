/**
 * NextAuth.js Edge-compatible Configuration
 * This config is used by middleware and doesn't include Node.js-only modules
 */

import type { NextAuthConfig } from 'next-auth';

// Public routes that don't require authentication
export const publicRoutes = [
  '/',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/error',
  '/terms',
  '/privacy',
  '/cookies',
  '/help',
];

// Routes that require authentication
export const protectedRoutes = [
  '/dashboard',
  '/meetings',
  '/settings',
  '/integrations',
  '/billing',
  '/search',
];

// API routes that are public
export const publicApiRoutes = [
  '/api/auth',
  '/api/health',
];

/**
 * Edge-compatible NextAuth configuration
 * Used by middleware - no Node.js-only modules allowed
 */
export const authConfig: NextAuthConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/sign-in',
    error: '/error',
    verifyRequest: '/verify-email',
  },
  providers: [], // Providers are added in auth.ts
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Allow public API routes
      if (publicApiRoutes.some(route => pathname.startsWith(route))) {
        return true;
      }

      // Check if this is a public route
      const isPublicRoute = publicRoutes.some(route =>
        pathname === route || pathname.startsWith(route + '/')
      );

      // Check if this is a protected route
      const isProtectedRoute = protectedRoutes.some(route =>
        pathname === route || pathname.startsWith(route + '/')
      );

      // Redirect logged-in users away from auth pages
      if (isLoggedIn && isPublicRoute) {
        const authPages = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password'];
        if (authPages.some(page => pathname.startsWith(page))) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
      }

      // Redirect unauthenticated users to sign-in for protected routes
      if (!isLoggedIn && isProtectedRoute) {
        const signInUrl = new URL('/sign-in', nextUrl);
        signInUrl.searchParams.set('callbackUrl', pathname);
        return Response.redirect(signInUrl);
      }

      // Check if 2FA is required
      if (isLoggedIn && auth?.requiresTwoFactor && isProtectedRoute) {
        return Response.redirect(new URL('/sign-in?2fa=required', nextUrl));
      }

      return true;
    },
  },
};
