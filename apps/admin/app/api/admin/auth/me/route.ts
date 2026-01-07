/**
 * Admin Auth Check API - Returns current admin user info
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token')?.value;

    if (!adminToken) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_URL}/api/admin/auth/me`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Auth check failed' } },
      { status: 500 }
    );
  }
}
