/**
 * Single Invitation API Route
 * Cancel a pending invitation
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';

export async function DELETE(
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

    // Only admins can cancel invitations
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to cancel invitations' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const invitation = await prisma.invitation.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        status: 'pending',
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    await prisma.invitation.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation cancelled',
    });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel invitation' },
      { status: 500 }
    );
  }
}
