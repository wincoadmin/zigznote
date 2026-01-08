/**
 * Admin API Proxy - Forwards all /api/admin/* requests to backend with auth token
 */

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;

    // Debug: Log all cookies and headers
    const cookieHeader = request.headers.get('cookie');
    const allCookies = request.cookies.getAll();
    console.log('[Admin Proxy] Path:', path.join('/'));
    console.log('[Admin Proxy] Cookie header:', cookieHeader);
    console.log('[Admin Proxy] All cookies:', JSON.stringify(allCookies));

    // Read token from request cookies
    const adminToken = request.cookies.get('admin_token')?.value;

    if (!adminToken) {
      console.log('[Admin Proxy] No token found in cookies');
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Build the backend URL
    const pathString = path.join('/');
    const url = new URL(request.url);
    const backendUrl = `${API_URL}/api/admin/${pathString}${url.search}`;

    // Forward the request
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${adminToken}`,
    };

    // Add content-type for requests with body
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
    }

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    // Add body for non-GET requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const body = await request.text();
        if (body) {
          fetchOptions.body = body;
        }
      } catch {
        // No body
      }
    }

    const response = await fetch(backendUrl, fetchOptions);
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Admin Proxy] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Request failed' } },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}
