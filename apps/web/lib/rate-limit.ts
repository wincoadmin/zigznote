/**
 * Rate limiting utilities for authentication
 * Protects against brute force and credential stuffing attacks
 */

import { prisma } from '@zigznote/database';

// Rate limit configuration
const RATE_LIMITS = {
  // Per email: max 5 failed attempts in 15 minutes
  email: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutMs: 30 * 60 * 1000, // 30 minutes
  },
  // Per IP: max 20 failed attempts in 15 minutes
  ip: {
    maxAttempts: 20,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutMs: 60 * 60 * 1000, // 1 hour
  },
  // Global: max 100 failed attempts in 5 minutes (DDoS protection)
  global: {
    maxAttempts: 100,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },
};

// In-memory store for IP rate limiting (in production, use Redis)
const ipAttempts = new Map<string, { count: number; firstAttempt: Date }>();

/**
 * Check if login attempt should be blocked due to brute force protection
 */
export async function checkBruteForce(
  email: string,
  ip: string
): Promise<{ blocked: boolean; reason?: string }> {
  const now = new Date();

  // Check per-email rate limit from database
  const windowStart = new Date(now.getTime() - RATE_LIMITS.email.windowMs);
  const recentEmailAttempts = await prisma.loginHistory.count({
    where: {
      user: { email },
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  if (recentEmailAttempts >= RATE_LIMITS.email.maxAttempts) {
    return {
      blocked: true,
      reason: 'Too many failed login attempts. Please try again later.',
    };
  }

  // Check per-IP rate limit (in-memory for now)
  const ipData = ipAttempts.get(ip);
  if (ipData) {
    const windowExpired =
      now.getTime() - ipData.firstAttempt.getTime() > RATE_LIMITS.ip.windowMs;

    if (windowExpired) {
      // Reset window
      ipAttempts.delete(ip);
    } else if (ipData.count >= RATE_LIMITS.ip.maxAttempts) {
      return {
        blocked: true,
        reason: 'Too many requests from your IP address. Please try again later.',
      };
    }
  }

  return { blocked: false };
}

/**
 * Record a login attempt (success or failure)
 */
export async function recordLoginAttempt(
  email: string,
  ip: string,
  userAgent: string,
  success: boolean,
  reason?: string
): Promise<void> {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  // Record in database
  if (user) {
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress: ip,
        userAgent,
        success,
        reason,
      },
    });
  }

  // Update IP rate limit (for failed attempts)
  if (!success) {
    const existing = ipAttempts.get(ip);
    if (existing) {
      existing.count++;
    } else {
      ipAttempts.set(ip, { count: 1, firstAttempt: new Date() });
    }
  }
}

/**
 * Clear failed attempts for a user after successful login
 */
export async function clearFailedAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lastFailedLogin: null,
      isLocked: false,
      lockUntil: null,
    },
  });
}

/**
 * Rate limit middleware wrapper
 * Returns remaining attempts and reset time
 */
export async function getRateLimitStatus(email: string, ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMITS.email.windowMs);

  const recentAttempts = await prisma.loginHistory.count({
    where: {
      user: { email },
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  const remaining = Math.max(0, RATE_LIMITS.email.maxAttempts - recentAttempts);
  const resetAt = new Date(now.getTime() + RATE_LIMITS.email.windowMs);

  return {
    allowed: remaining > 0,
    remaining,
    resetAt,
  };
}

/**
 * Clean up old rate limit entries (run periodically)
 */
export function cleanupRateLimitCache(): void {
  const now = new Date();

  for (const [ip, data] of ipAttempts.entries()) {
    if (now.getTime() - data.firstAttempt.getTime() > RATE_LIMITS.ip.windowMs) {
      ipAttempts.delete(ip);
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitCache, 5 * 60 * 1000);
}
