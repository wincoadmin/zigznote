/**
 * Invite Member API Route
 * Send invitation to new organization member
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';
import crypto from 'crypto';

export async function POST(request: Request) {
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

    // Only admins can invite
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to invite members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role = 'member' } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "admin" or "member"' },
        { status: 400 }
      );
    }

    // Check if user already exists in this organization
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        organizationId: user.organizationId,
        deletedAt: null,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 400 }
      );
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        organizationId: user.organizationId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 400 }
      );
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        organizationId: user.organizationId,
        email,
        role,
        token,
        expiresAt,
        invitedById: user.id,
      },
      include: {
        invitedBy: {
          select: { name: true, email: true },
        },
        organization: {
          select: { name: true },
        },
      },
    });

    // TODO: Send invitation email

    return NextResponse.json({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        invitedBy: invitation.invitedBy,
        organization: invitation.organization,
        inviteUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invite/${invitation.token}`,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}
