/**
 * Admin Login API - Proxies to backend and sets JWT cookie
 */

import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/admin/auth/login`, {
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

    // If login successful and we got a token, set it as a cookie on the response
    if (token) {
      console.log('[Login] Setting admin_token cookie, token length:', token.length);
      res.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });
    } else {
      console.log('[Login] WARNING: No token in response from backend');
    }

    return res;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Login failed' } },
      { status: 500 }
    );
  }
}
