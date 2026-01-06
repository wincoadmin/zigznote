/**
 * Email Verification API Route
 * GET /api/auth/verify-email?token=xxx - Verify email with token
 * POST /api/auth/verify-email - Resend verification email
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@zigznote/database';
import { generateToken } from '@/lib/password';
import { sendVerificationEmail, sendWelcomeEmail } from '@/lib/email';

/**
 * Verify email with token
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Find user with this token
    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { message: 'Email is already verified' },
        { status: 200 }
      );
    }

    // Verify the email
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
      },
    });

    // Send welcome email
    try {
      await sendWelcomeEmail(
        user.email,
        user.firstName || user.email.split('@')[0]
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    return NextResponse.json(
      { message: 'Email verified successfully. You can now sign in.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'An error occurred during email verification' },
      { status: 500 }
    );
  }
}

/**
 * Resend verification email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists
      return NextResponse.json(
        { message: 'If an account exists with this email, a verification link will be sent.' },
        { status: 200 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { message: 'Email is already verified. You can sign in.' },
        { status: 200 }
      );
    }

    // Generate new verification token
    const verificationToken = generateToken(32);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: verificationToken },
    });

    // Send verification email
    await sendVerificationEmail(
      user.email,
      user.firstName || user.email.split('@')[0],
      verificationToken
    );

    return NextResponse.json(
      { message: 'Verification email sent. Please check your inbox.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while sending verification email' },
      { status: 500 }
    );
  }
}
