/**
 * Direct User Creation API Route
 * Admin creates user with temporary password
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';
import { hashPassword, generateRandomPassword } from '@/lib/password';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only admins can create users
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to create users' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      email,
      firstName,
      lastName,
      role = 'member',
      temporaryPassword,
    } = body;

    // Validate required fields
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!firstName || typeof firstName !== 'string') {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate role
    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "admin" or "member"' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    // Generate or use provided temporary password
    const password = temporaryPassword || generateRandomPassword(16);
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName || ''}`.trim(),
        password: hashedPassword,
        role,
        organizationId: user.organizationId,
        emailVerified: new Date(), // Admin-created users are pre-verified
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // TODO: Send welcome email with credentials if sendWelcomeEmail is true
    // await sendWelcomeEmail({
    //   to: email,
    //   firstName,
    //   organizationName: user.organization?.name,
    //   temporaryPassword: password,
    //   loginUrl: `${process.env.NEXTAUTH_URL}/sign-in`,
    // });

    return NextResponse.json({
      success: true,
      data: {
        ...newUser,
        temporaryPassword: password, // Return so admin can share with user
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
