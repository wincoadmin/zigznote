/**
 * Billing API proxy route
 * Proxies billing requests to the backend with proper JWT authentication
 */

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { SignJWT } from 'jose';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function createApiToken(payload: Record<string, unknown>): Promise<string> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

async function proxyRequest(
  request: Request,
  path: string,
  method: string
): Promise<NextResponse> {
  try {
    // Get the NextAuth token
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Create a JWT for the API
    const apiToken = await createApiToken({
      id: token.id,
      email: token.email,
      name: token.name,
      role: token.role,
      organizationId: token.organizationId,
      twoFactorEnabled: token.twoFactorEnabled,
      twoFactorVerified: true, // Already verified if they have a valid session
    });

    // Prepare request options
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Include body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const body = await request.text();
      if (body) {
        fetchOptions.body = body;
      }
    }

    // Make the request to the backend
    const response = await fetch(`${API_URL}/api/v1/billing/${path}`, fetchOptions);
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Billing proxy error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: 'Failed to proxy request' } },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'), 'GET');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'), 'POST');
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'), 'PUT');
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'), 'DELETE');
}
