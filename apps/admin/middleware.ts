/**
 * Admin Panel Authentication Middleware
 * Redirects unauthenticated users to login page
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  const { pathname } = request.nextUrl;

  // Debug logging
  console.log('[Middleware] Path:', pathname, '| Token present:', !!token);

  // Allow access to login page and API routes without auth
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/admin/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!token) {
    console.log('[Middleware] No token, redirecting to login');
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
