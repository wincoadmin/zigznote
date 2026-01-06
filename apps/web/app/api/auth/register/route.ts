/**
 * User Registration API Route
 * POST /api/auth/register
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@zigznote/database';
import { hashPassword, validatePassword, generateToken } from '@/lib/password';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
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

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors.join('. ') },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate email verification token
    const verificationToken = generateToken(32);

    // Create organization for the user
    const organization = await prisma.organization.create({
      data: {
        name: `${firstName || email.split('@')[0]}'s Organization`,
      },
    });

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        name: firstName && lastName ? `${firstName} ${lastName}` : firstName || null,
        emailVerificationToken: verificationToken,
        organizationId: organization.id,
        role: 'admin', // First user in org is admin
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(
        user.email,
        user.firstName || user.email.split('@')[0],
        verificationToken
      );
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue anyway - user can request new verification email
    }

    return NextResponse.json(
      {
        message: 'Account created successfully. Please check your email to verify your account.',
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}
