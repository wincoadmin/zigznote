/**
 * Admin 2FA Verification API - Proxies to backend and sets JWT cookie
 */

import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/admin/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Return response without token (it's in the cookie now)
    const { token, ...responseWithoutToken } = data;
    const res = NextResponse.json(responseWithoutToken);

    // If verification successful and we got a token, set it as a cookie
    if (token) {
      res.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });
    }

    return res;
  } catch (error) {
    console.error('2FA verification error:', error);
    return NextResponse.json(
      { success: false, error: { message: '2FA verification failed' } },
      { status: 500 }
    );
  }
}
