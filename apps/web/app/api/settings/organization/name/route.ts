/**
 * Organization Name Update API
 * Direct database access (following Next.js API route pattern)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';

export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and check admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to update organization name' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Organization name must be 100 characters or less' },
        { status: 400 }
      );
    }

    // Update organization name
    const organization = await prisma.organization.update({
      where: { id: user.organizationId },
      data: { name: name.trim() },
    });

    return NextResponse.json({
      success: true,
      data: {
        name: organization.name,
      },
    });
  } catch (error) {
    console.error('Error updating organization name:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update organization name' },
      { status: 500 }
    );
  }
}
