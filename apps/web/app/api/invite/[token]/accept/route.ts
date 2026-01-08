/**
 * Accept Invitation API Route
 * Creates user account (if needed) and adds to organization
 */

import { NextResponse } from 'next/server';
import { prisma } from '@zigznote/database';
import { hashPassword } from '@/lib/password';

export async function POST(
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
        organization: { select: { id: true, name: true } },
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
        { error: 'This invitation has expired' },
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

    let user;

    if (existingUser) {
      // User exists - just update their organization
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          organizationId: invitation.organizationId,
          role: invitation.role,
          deletedAt: null, // Restore if soft-deleted
        },
      });
    } else {
      // New user - create account
      const body = await request.json();
      const { firstName, lastName, password } = body;

      if (!firstName || typeof firstName !== 'string') {
        return NextResponse.json(
          { error: 'First name is required' },
          { status: 400 }
        );
      }

      if (!password || typeof password !== 'string') {
        return NextResponse.json(
          { error: 'Password is required' },
          { status: 400 }
        );
      }

      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        );
      }

      const hashedPassword = await hashPassword(password);

      user = await prisma.user.create({
        data: {
          email: invitation.email,
          firstName: firstName.trim(),
          lastName: lastName?.trim() || null,
          name: `${firstName.trim()} ${lastName?.trim() || ''}`.trim(),
          password: hashedPassword,
          role: invitation.role,
          organizationId: invitation.organizationId,
          emailVerified: new Date(), // Pre-verified since they came from invitation link
        },
      });
    }

    // Mark invitation as accepted
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationName: invitation.organization?.name,
      },
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
