/**
 * Resend Invitation API Route
 * Resend an invitation email with new token
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';
import crypto from 'crypto';
import { sendInvitationEmail } from '@/lib/email';

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

    // Only admins can resend invitations
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to resend invitations' },
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
      include: {
        organization: { select: { name: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Generate new token and extend expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.invitation.update({
      where: { id },
      data: { token, expiresAt },
    });

    // Send invitation email
    try {
      await sendInvitationEmail(
        invitation.email,
        user.name || 'A team member',
        invitation.organization?.name || 'the organization',
        invitation.role,
        token
      );
    } catch (emailError) {
      console.error('Failed to resend invitation email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation resent',
      data: {
        inviteUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invite/${token}`,
      },
    });
  } catch (error) {
    console.error('Error resending invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resend invitation' },
      { status: 500 }
    );
  }
}
