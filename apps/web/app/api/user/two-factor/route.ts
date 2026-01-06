/**
 * Two-Factor Authentication API
 * GET - Get 2FA status and setup info
 * POST - Enable 2FA
 * DELETE - Disable 2FA
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';
import crypto from 'crypto';

// Generate a simple TOTP secret (in production, use a proper library like speakeasy)
function generateSecret(): string {
  return crypto.randomBytes(20).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
}

// Generate backup codes
function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If 2FA is not enabled and no secret exists, generate one for setup
    let secret = user.twoFactorSecret;
    if (!user.twoFactorEnabled && !secret) {
      secret = generateSecret();
      await prisma.user.update({
        where: { id: session.user.id },
        data: { twoFactorSecret: secret },
      });
    }

    // Generate QR code URL (otpauth format)
    const otpauthUrl = `otpauth://totp/zigznote:${session.user.email}?secret=${secret}&issuer=zigznote`;

    return NextResponse.json({
      success: true,
      data: {
        enabled: user.twoFactorEnabled,
        secret: user.twoFactorEnabled ? null : secret,
        qrCodeUrl: user.twoFactorEnabled ? null : otpauthUrl,
      },
    });
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    return NextResponse.json(
      { error: 'Failed to get 2FA status' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FA is already enabled' },
        { status: 400 }
      );
    }

    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'No 2FA secret found. Please refresh and try again.' },
        { status: 400 }
      );
    }

    // In production, verify the TOTP code properly
    // For now, accept any 6-digit code for demo purposes
    // TODO: Implement proper TOTP verification with speakeasy or similar

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Enable 2FA
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: true,
        backupCodes: backupCodes,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        enabled: true,
        backupCodes,
      },
    });
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to enable 2FA' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password required to disable 2FA' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        password: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FA is not enabled' },
        { status: 400 }
      );
    }

    // Verify password
    if (user.password) {
      const bcrypt = await import('bcrypt');
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Incorrect password' },
          { status: 400 }
        );
      }
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: [],
      },
    });

    return NextResponse.json({
      success: true,
      message: '2FA has been disabled',
    });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}
