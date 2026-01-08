/**
 * Reset Password API Route
 * Admin-only endpoint to reset a member's password
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';
import { hashPassword, generateRandomPassword } from '@/lib/password';

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

    // Only admins can reset passwords
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to reset passwords' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Can't reset own password through this endpoint
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Use the profile settings to change your own password' },
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

    // Generate a temporary password
    const tempPassword = generateRandomPassword(16);

    // Hash the password
    const hashedPassword = await hashPassword(tempPassword);

    // Update user's password
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password has been reset',
      data: {
        email: member.email,
        temporaryPassword: tempPassword,
        note: 'Please share this temporary password securely with the user. They should change it immediately after logging in.',
      },
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
