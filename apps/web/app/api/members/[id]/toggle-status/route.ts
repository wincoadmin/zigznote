/**
 * Toggle Status API Route
 * Admin-only endpoint to enable/disable a member
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Only admins can toggle member status
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to change member status' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Can't disable yourself
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Cannot disable your own account' },
        { status: 400 }
      );
    }

    // Check member exists in same org
    const member = await prisma.user.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        deletedAt: null,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Toggle the isActive status
    const newStatus = !member.isActive;

    const updatedMember = await prisma.user.update({
      where: { id },
      data: { isActive: newStatus },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: newStatus ? 'Member has been enabled' : 'Member has been disabled',
      data: updatedMember,
    });
  } catch (error) {
    console.error('Error toggling member status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle member status' },
      { status: 500 }
    );
  }
}
