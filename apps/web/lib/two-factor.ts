/**
 * Two-Factor Authentication utilities
 * Handles TOTP generation, verification, and backup codes
 */

import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '@zigznote/database';
import { hashPassword, verifyPassword } from './password';

// Configure authenticator
authenticator.options = {
  window: 1, // Allow 1 step before/after for time drift
  step: 30, // 30 second window
};

const APP_NAME = 'zigznote';

/**
 * Generate a new TOTP secret
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate a TOTP key URI for QR code
 */
export function generateTOTPKeyUri(email: string, secret: string): string {
  return authenticator.keyuri(email, APP_NAME, secret);
}

/**
 * Generate a QR code as a data URL
 */
export async function generateQRCode(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 2,
    color: {
      dark: '#10b981', // Emerald green
      light: '#ffffff',
    },
  });
}

/**
 * Verify a TOTP code
 */
export function verifyTOTP(code: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}

/**
 * Generate current TOTP (for testing)
 */
export function generateTOTP(secret: string): string {
  return authenticator.generate(secret);
}

/**
 * Generate backup codes (10 codes, 8 characters each)
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  for (let i = 0; i < count; i++) {
    let code = '';
    for (let j = 0; j < 8; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }

  return codes;
}

/**
 * Hash backup codes for storage
 */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(
    codes.map((code) => hashPassword(code.replace('-', '')))
  );
}

/**
 * Verify a backup code against stored hashes
 */
export async function verifyBackupCode(
  userId: string,
  code: string
): Promise<{ valid: boolean; remainingCodes: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { backupCodes: true },
  });

  if (!user || !user.backupCodes.length) {
    return { valid: false, remainingCodes: 0 };
  }

  const normalizedCode = code.replace('-', '').toUpperCase();

  // Check each backup code
  for (let i = 0; i < user.backupCodes.length; i++) {
    const isValid = await verifyPassword(normalizedCode, user.backupCodes[i]);

    if (isValid) {
      // Remove the used backup code
      const remainingCodes = [...user.backupCodes];
      remainingCodes.splice(i, 1);

      await prisma.user.update({
        where: { id: userId },
        data: { backupCodes: remainingCodes },
      });

      return { valid: true, remainingCodes: remainingCodes.length };
    }
  }

  return { valid: false, remainingCodes: user.backupCodes.length };
}

/**
 * Setup 2FA for a user
 * Returns the secret and QR code data URL
 */
export async function setup2FA(userId: string): Promise<{
  secret: string;
  qrCode: string;
  otpauthUrl: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, twoFactorEnabled: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.twoFactorEnabled) {
    throw new Error('Two-factor authentication is already enabled');
  }

  const secret = generateTOTPSecret();
  const otpauthUrl = generateTOTPKeyUri(user.email, secret);
  const qrCode = await generateQRCode(otpauthUrl);

  // Store secret temporarily (not enabled yet)
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret },
  });

  return { secret, qrCode, otpauthUrl };
}

/**
 * Verify and enable 2FA
 * User must provide a valid TOTP code to confirm setup
 */
export async function enable2FA(
  userId: string,
  code: string
): Promise<{ success: boolean; backupCodes?: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user || !user.twoFactorSecret) {
    throw new Error('2FA setup not initiated');
  }

  if (user.twoFactorEnabled) {
    throw new Error('Two-factor authentication is already enabled');
  }

  // Verify the code
  if (!verifyTOTP(code, user.twoFactorSecret)) {
    return { success: false };
  }

  // Generate backup codes
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = await hashBackupCodes(backupCodes);

  // Enable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      backupCodes: hashedBackupCodes,
    },
  });

  return { success: true, backupCodes };
}

/**
 * Disable 2FA for a user
 * Requires current password for security
 */
export async function disable2FA(
  userId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, twoFactorEnabled: true },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (!user.twoFactorEnabled) {
    return { success: false, error: 'Two-factor authentication is not enabled' };
  }

  if (!user.password) {
    return { success: false, error: 'Cannot disable 2FA for OAuth-only accounts' };
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) {
    return { success: false, error: 'Invalid password' };
  }

  // Disable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      backupCodes: [],
    },
  });

  return { success: true };
}

/**
 * Regenerate backup codes
 * Invalidates all previous backup codes
 */
export async function regenerateBackupCodes(
  userId: string,
  password: string
): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, twoFactorEnabled: true },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (!user.twoFactorEnabled) {
    return { success: false, error: 'Two-factor authentication is not enabled' };
  }

  if (!user.password) {
    return { success: false, error: 'Cannot regenerate codes for OAuth-only accounts' };
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) {
    return { success: false, error: 'Invalid password' };
  }

  // Generate new backup codes
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = await hashBackupCodes(backupCodes);

  // Update backup codes
  await prisma.user.update({
    where: { id: userId },
    data: { backupCodes: hashedBackupCodes },
  });

  return { success: true, backupCodes };
}
