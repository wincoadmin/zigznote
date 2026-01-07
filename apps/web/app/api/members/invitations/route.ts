/**
 * Invitations API Route
 * List pending invitations
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only admins can view invitations
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to view invitations' },
        { status: 403 }
      );
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: user.organizationId,
        status: 'pending',
      },
      include: {
        invitedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mark expired invitations
    const now = new Date();
    const result = invitations.map((inv) => ({
      ...inv,
      isExpired: inv.expiresAt < now,
    }));

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}
