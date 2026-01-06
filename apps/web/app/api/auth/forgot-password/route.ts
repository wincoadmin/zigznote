/**
 * Forgot Password API Route
 * POST /api/auth/forgot-password - Request password reset
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@zigznote/database';
import { generateToken } from '@/lib/password';
import { sendPasswordResetEmail } from '@/lib/email';

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

    // Always return success to prevent email enumeration
    const successResponse = {
      message: 'If an account exists with this email, a password reset link will be sent.',
    };

    if (!user) {
      return NextResponse.json(successResponse, { status: 200 });
    }

    // Check if user has a password (not OAuth-only)
    if (!user.password) {
      // User signed up with OAuth
      return NextResponse.json(
        {
          message: 'This account uses social login. Please sign in with Google, GitHub, or Microsoft.',
        },
        { status: 200 }
      );
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return NextResponse.json(
        {
          message: 'Please verify your email first before resetting your password.',
        },
        { status: 200 }
      );
    }

    // Generate reset token
    const resetToken = generateToken(32);
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Send reset email
    try {
      await sendPasswordResetEmail(
        user.email,
        user.firstName || user.email.split('@')[0],
        resetToken
      );
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send password reset email' },
        { status: 500 }
      );
    }

    return NextResponse.json(successResponse, { status: 200 });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
