/**
 * Admin Logout API - Invalidates session on backend and clears cookie
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export async function POST() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token')?.value;

  // Call backend to invalidate the session
  if (adminToken) {
    try {
      await fetch(`${API_URL}/api/admin/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Backend logout error:', error);
      // Continue with cookie deletion even if backend call fails
    }
  }

  // Clear the cookie
  cookieStore.delete('admin_token');

  return NextResponse.json({ success: true });
}
