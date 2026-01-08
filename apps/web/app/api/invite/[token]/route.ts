/**
 * Invitation Validation API Route
 * Validates invitation token and returns invitation details
 */

import { NextResponse } from 'next/server';
import { prisma } from '@zigznote/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: { select: { name: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: 'This invitation has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `This invitation has already been ${invitation.status}` },
        { status: 400 }
      );
    }

    // Check if user already exists with this email
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        organizationName: invitation.organization?.name || 'Unknown Organization',
        inviterName: invitation.invitedBy?.name || 'A team member',
        expiresAt: invitation.expiresAt.toISOString(),
        existingUser: !!existingUser,
      },
    });
  } catch (error) {
    console.error('Error validating invitation:', error);
    return NextResponse.json(
      { error: 'Failed to validate invitation' },
      { status: 500 }
    );
  }
}
