/**
 * Two-Factor Authentication API Routes
 * GET /api/auth/2fa - Get 2FA status
 * POST /api/auth/2fa - Setup 2FA (returns QR code)
 * PUT /api/auth/2fa - Enable 2FA (verify code)
 * DELETE /api/auth/2fa - Disable 2FA
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';
import { setup2FA, enable2FA, disable2FA, regenerateBackupCodes } from '@/lib/two-factor';
import { send2FAEnabledEmail, send2FADisabledEmail } from '@/lib/email';

/**
 * Get 2FA status
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        twoFactorEnabled: true,
        backupCodes: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      enabled: user.twoFactorEnabled,
      backupCodesRemaining: user.backupCodes.length,
    });
  } catch (error) {
    console.error('Get 2FA status error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

/**
 * Setup 2FA - returns QR code
 */
export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await setup2FA(session.user.id);

    return NextResponse.json({
      qrCode: result.qrCode,
      secret: result.secret, // For manual entry
      otpauthUrl: result.otpauthUrl,
    });
  } catch (error: any) {
    console.error('Setup 2FA error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 400 }
    );
  }
}

/**
 * Enable 2FA - verify code and enable
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      );
    }

    const result = await enable2FA(session.user.id, code);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Get user email for notification
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, firstName: true },
    });

    // Send notification email
    if (user) {
      try {
        await send2FAEnabledEmail(user.email, user.firstName || user.email.split('@')[0]);
      } catch (emailError) {
        console.error('Failed to send 2FA enabled email:', emailError);
      }
    }

    return NextResponse.json({
      message: 'Two-factor authentication enabled successfully',
      backupCodes: result.backupCodes,
    });
  } catch (error: any) {
    console.error('Enable 2FA error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 400 }
    );
  }
}

/**
 * Disable 2FA
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to disable 2FA' },
        { status: 400 }
      );
    }

    const result = await disable2FA(session.user.id, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to disable 2FA' },
        { status: 400 }
      );
    }

    // Get user email for notification
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, firstName: true },
    });

    // Send notification email
    if (user) {
      try {
        await send2FADisabledEmail(user.email, user.firstName || user.email.split('@')[0]);
      } catch (emailError) {
        console.error('Failed to send 2FA disabled email:', emailError);
      }
    }

    return NextResponse.json({
      message: 'Two-factor authentication disabled successfully',
    });
  } catch (error: any) {
    console.error('Disable 2FA error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 400 }
    );
  }
}
