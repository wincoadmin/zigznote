/**
 * Admin authentication service
 * Handles password hashing, session management, and 2FA
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { adminUserRepository, adminSessionRepository } from '@zigznote/database';
import type { AdminUser, AdminSession } from '@prisma/client';
import { UnauthorizedError, ForbiddenError } from '@zigznote/shared';
import { config } from '../config';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 12;
const SESSION_DURATION_HOURS = 8;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export interface LoginResult {
  success: boolean;
  requiresTwoFactor?: boolean;
  session?: {
    token: string;
    expiresAt: Date;
  };
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface AdminAuthContext {
  adminId: string;
  email: string;
  name: string;
  role: string;
  sessionId: string;
}

class AdminAuthService {
  /**
   * Hash a password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify a password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a session token
   */
  generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash a session token for storage
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Login step 1: Validate credentials
   */
  async login(
    email: string,
    password: string,
    ipAddress: string,
    userAgent: string
  ): Promise<LoginResult> {
    const user = await adminUserRepository.findByEmail(email);

    if (!user) {
      logger.warn({ email, ip: ipAddress }, 'Admin login attempt for unknown email');
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000
      );
      logger.warn({ email, ip: ipAddress }, 'Admin login attempt for locked account');
      throw new ForbiddenError(
        `Account is locked. Try again in ${remainingMinutes} minutes.`
      );
    }

    // Check if account is active
    if (!user.isActive) {
      logger.warn({ email, ip: ipAddress }, 'Admin login attempt for deactivated account');
      throw new UnauthorizedError('Account is deactivated');
    }

    // Verify password
    const validPassword = await this.verifyPassword(password, user.passwordHash);

    if (!validPassword) {
      await this.handleFailedLogin(user, ipAddress);
      throw new UnauthorizedError('Invalid credentials');
    }

    // Reset failed attempts on successful password
    if (user.failedLoginAttempts > 0) {
      await adminUserRepository.update(user.id, {
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    }

    // Check if 2FA is required
    if (user.twoFactorEnabled) {
      // Store partial auth state (will complete after 2FA)
      return {
        success: true,
        requiresTwoFactor: true,
      };
    }

    // No 2FA - create session directly
    const session = await this.createSession(user, ipAddress, userAgent);

    logger.info({ adminId: user.id, ip: ipAddress }, 'Admin login successful');

    return {
      success: true,
      session: {
        token: session.plainToken,
        expiresAt: session.session.expiresAt,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Login step 2: Verify 2FA code
   */
  async verify2FA(
    email: string,
    code: string,
    ipAddress: string,
    userAgent: string
  ): Promise<LoginResult> {
    const user = await adminUserRepository.findByEmail(email);

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedError('Invalid verification attempt');
    }

    // Verify TOTP code
    const isValid = await this.verifyTOTP(user.twoFactorSecret, code);

    if (!isValid) {
      // Check backup codes
      const isBackupCode = await this.verifyBackupCode(user, code);
      if (!isBackupCode) {
        logger.warn({ adminId: user.id, ip: ipAddress }, 'Invalid 2FA code');
        throw new UnauthorizedError('Invalid verification code');
      }
    }

    // Create session
    const session = await this.createSession(user, ipAddress, userAgent);

    logger.info({ adminId: user.id, ip: ipAddress }, 'Admin 2FA verification successful');

    return {
      success: true,
      session: {
        token: session.plainToken,
        expiresAt: session.session.expiresAt,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Generate 2FA secret and QR code data
   */
  async setup2FA(adminId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const admin = await adminUserRepository.findById(adminId);
    if (!admin) {
      throw new UnauthorizedError('Admin not found');
    }

    // Generate secret
    const secret = crypto.randomBytes(20).toString('hex').toUpperCase();

    // Store secret (not enabled yet)
    await adminUserRepository.update(adminId, {
      twoFactorSecret: this.encryptSecret(secret),
    });

    // Generate otpauth URL for QR code
    const issuer = config.admin?.twoFactorIssuer || 'zigznote';
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(admin.email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

    return { secret, otpauthUrl };
  }

  /**
   * Enable 2FA after verifying code
   */
  async enable2FA(adminId: string, code: string): Promise<{ backupCodes: string[] }> {
    const admin = await adminUserRepository.findById(adminId);
    if (!admin || !admin.twoFactorSecret) {
      throw new UnauthorizedError('2FA setup not started');
    }

    const secret = this.decryptSecret(admin.twoFactorSecret);
    const isValid = await this.verifyTOTP(secret, code);

    if (!isValid) {
      throw new UnauthorizedError('Invalid verification code');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => this.hashPassword(code))
    );

    await adminUserRepository.update(adminId, {
      twoFactorEnabled: true,
      backupCodes: hashedBackupCodes,
    });

    logger.info({ adminId }, 'Admin 2FA enabled');

    return { backupCodes };
  }

  /**
   * Disable 2FA
   */
  async disable2FA(adminId: string, code: string): Promise<void> {
    const admin = await adminUserRepository.findById(adminId);
    if (!admin || !admin.twoFactorEnabled || !admin.twoFactorSecret) {
      throw new UnauthorizedError('2FA is not enabled');
    }

    const secret = this.decryptSecret(admin.twoFactorSecret);
    const isValid = await this.verifyTOTP(secret, code);

    if (!isValid) {
      throw new UnauthorizedError('Invalid verification code');
    }

    await adminUserRepository.update(adminId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      backupCodes: [],
    });

    logger.info({ adminId }, 'Admin 2FA disabled');
  }

  /**
   * Validate session token
   */
  async validateSession(token: string): Promise<AdminAuthContext | null> {
    const tokenHash = this.hashToken(token);
    const session = await adminSessionRepository.validateSession(tokenHash, {
      adminUser: true,
    });

    if (!session) {
      return null;
    }

    const adminUser = session.adminUser as AdminUser;

    if (!adminUser.isActive) {
      await adminSessionRepository.delete(session.id);
      return null;
    }

    return {
      adminId: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      sessionId: session.id,
    };
  }

  /**
   * Logout - delete session
   */
  async logout(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await adminSessionRepository.deleteByToken(tokenHash);
  }

  /**
   * Logout from all sessions
   */
  async logoutAll(adminId: string): Promise<number> {
    return adminSessionRepository.deleteAllForUser(adminId);
  }

  /**
   * Create initial super admin (first-time setup)
   */
  async createInitialAdmin(
    email: string,
    password: string,
    name: string
  ): Promise<AdminUser> {
    // Check if any admins exist
    const hasAdmins = await adminUserRepository.hasAnyAdmins();
    if (hasAdmins) {
      throw new ForbiddenError('Initial admin already created');
    }

    const passwordHash = await this.hashPassword(password);

    const admin = await adminUserRepository.create({
      email,
      passwordHash,
      name,
      role: 'super_admin',
    });

    logger.info({ adminId: admin.id }, 'Initial super admin created');

    return admin;
  }

  /**
   * Check if initial setup is needed
   */
  async needsInitialSetup(): Promise<boolean> {
    return !(await adminUserRepository.hasAnyAdmins());
  }

  // Private methods

  private async handleFailedLogin(user: AdminUser, ipAddress: string): Promise<void> {
    const newFailedAttempts = user.failedLoginAttempts + 1;
    let lockUntil: Date | null = null;

    if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      logger.warn(
        { adminId: user.id, ip: ipAddress, attempts: newFailedAttempts },
        'Admin account locked due to failed attempts'
      );
    }

    await adminUserRepository.incrementFailedAttempts(user.id, lockUntil);
  }

  private async createSession(
    user: AdminUser,
    ipAddress: string,
    userAgent: string
  ): Promise<{ session: AdminSession; plainToken: string }> {
    const plainToken = this.generateSessionToken();
    const tokenHash = this.hashToken(plainToken);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

    const session = await adminSessionRepository.create({
      adminUserId: user.id,
      token: tokenHash,
      ipAddress,
      userAgent,
      expiresAt,
    });

    // Update last login
    await adminUserRepository.recordSuccessfulLogin(user.id, ipAddress);

    return { session, plainToken };
  }

  private async verifyTOTP(encryptedSecret: string, code: string): Promise<boolean> {
    const secret = this.decryptSecret(encryptedSecret);

    // Simple TOTP verification (30-second window, allow 1 step tolerance)
    const now = Math.floor(Date.now() / 1000 / 30);

    for (let i = -1; i <= 1; i++) {
      const counter = now + i;
      const expectedCode = this.generateTOTPCode(secret, counter);
      if (expectedCode === code) {
        return true;
      }
    }

    return false;
  }

  private generateTOTPCode(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex'));
    hmac.update(buffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0x0f;
    const code =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    return (code % 1000000).toString().padStart(6, '0');
  }

  private async verifyBackupCode(user: AdminUser, code: string): Promise<boolean> {
    for (let i = 0; i < user.backupCodes.length; i++) {
      const isMatch = await this.verifyPassword(code, user.backupCodes[i]);
      if (isMatch) {
        // Remove used backup code
        const newCodes = [...user.backupCodes];
        newCodes.splice(i, 1);
        await adminUserRepository.update(user.id, { backupCodes: newCodes });
        logger.info({ adminId: user.id }, 'Backup code used for 2FA');
        return true;
      }
    }
    return false;
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  private encryptSecret(secret: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptSecret(encrypted: string): string {
    const key = this.getEncryptionKey();
    const [ivHex, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private getEncryptionKey(): Buffer {
    const key = config.admin?.jwtSecret || config.encryption?.key || 'default-key-change-me';
    return crypto.createHash('sha256').update(key).digest();
  }
}

export const adminAuthService = new AdminAuthService();
