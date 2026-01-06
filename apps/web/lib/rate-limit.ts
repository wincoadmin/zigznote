/**
 * Rate limiting utilities for authentication
 * Uses Redis (ioredis) for distributed rate limiting
 * Protects against brute force and credential stuffing attacks
 */

import Redis from 'ioredis';
import { prisma } from '@zigznote/database';

// Lazy Redis initialization
let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    _redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true,
    });

    _redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }
  return _redis;
}

// Rate limit configuration
const RATE_LIMITS = {
  // Per email: max 5 failed attempts in 15 minutes
  email: {
    maxAttempts: 5,
    windowSeconds: 15 * 60, // 15 minutes
    lockoutSeconds: 30 * 60, // 30 minutes
  },
  // Per IP: max 20 failed attempts in 15 minutes
  ip: {
    maxAttempts: 20,
    windowSeconds: 15 * 60, // 15 minutes
    lockoutSeconds: 60 * 60, // 1 hour
  },
  // Global: max 100 failed attempts in 5 minutes (DDoS protection)
  global: {
    maxAttempts: 100,
    windowSeconds: 5 * 60, // 5 minutes
  },
};

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

/**
 * Sliding window rate limiter using Redis sorted sets
 */
async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const redisKey = `ratelimit:${key}`;

  try {
    // Remove old entries outside the window
    await redis.zremrangebyscore(redisKey, 0, windowStart);

    // Count current entries in the window
    const count = await redis.zcard(redisKey);

    if (count >= limit) {
      // Get the oldest entry to calculate reset time
      const oldestEntry = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
      const reset = oldestEntry.length > 1
        ? Math.ceil((parseInt(oldestEntry[1]) + windowSeconds * 1000 - now) / 1000)
        : windowSeconds;

      return {
        success: false,
        remaining: 0,
        reset,
      };
    }

    // Add new entry with current timestamp as score
    await redis.zadd(redisKey, now, `${now}-${Math.random().toString(36).substring(7)}`);
    await redis.expire(redisKey, windowSeconds);

    return {
      success: true,
      remaining: limit - count - 1,
      reset: windowSeconds,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow the request if Redis is unavailable
    return {
      success: true,
      remaining: limit,
      reset: windowSeconds,
    };
  }
}

/**
 * Check if login attempt should be blocked due to brute force protection
 */
export async function checkBruteForce(
  email: string,
  ip: string
): Promise<{ blocked: boolean; reason?: string }> {
  // Check per-email rate limit
  const emailResult = await checkRateLimit(
    `login:email:${email.toLowerCase()}`,
    RATE_LIMITS.email.maxAttempts,
    RATE_LIMITS.email.windowSeconds
  );

  if (!emailResult.success) {
    return {
      blocked: true,
      reason: `Too many failed login attempts. Please try again in ${Math.ceil(emailResult.reset / 60)} minutes.`,
    };
  }

  // Check per-IP rate limit
  const ipResult = await checkRateLimit(
    `login:ip:${ip}`,
    RATE_LIMITS.ip.maxAttempts,
    RATE_LIMITS.ip.windowSeconds
  );

  if (!ipResult.success) {
    return {
      blocked: true,
      reason: `Too many requests from your IP address. Please try again in ${Math.ceil(ipResult.reset / 60)} minutes.`,
    };
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
    where: { email: email.toLowerCase() },
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

  // For failed attempts, record in Redis for rate limiting
  if (!success) {
    await recordFailedAttempt(ip, email);
  }
}

/**
 * Record a failed login attempt in Redis
 */
export async function recordFailedAttempt(ip: string, email: string): Promise<void> {
  const redis = getRedis();
  const key = `failed:${ip}:${email.toLowerCase()}`;

  try {
    await redis.incr(key);
    await redis.expire(key, 24 * 60 * 60); // Track for 24 hours
  } catch (error) {
    console.error('Failed to record failed attempt:', error);
  }
}

/**
 * Check if an IP is suspicious (many failed attempts across multiple emails)
 */
export async function isSuspiciousIP(ip: string): Promise<boolean> {
  const redis = getRedis();

  try {
    const pattern = `failed:${ip}:*`;
    const keys = await redis.keys(pattern);

    if (keys.length === 0) return false;

    const values = await Promise.all(keys.map(k => redis.get(k)));
    const totalFailures = values.reduce((sum, v) => sum + (parseInt(v || '0')), 0);

    return totalFailures > 20; // More than 20 failures across all emails
  } catch (error) {
    console.error('Failed to check suspicious IP:', error);
    return false;
  }
}

/**
 * Reset failed attempts (on successful login)
 */
export async function resetFailedAttempts(ip: string, email: string): Promise<void> {
  const redis = getRedis();

  try {
    await redis.del(`failed:${ip}:${email.toLowerCase()}`);
  } catch (error) {
    console.error('Failed to reset failed attempts:', error);
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
  const emailResult = await checkRateLimit(
    `login:email:${email.toLowerCase()}`,
    RATE_LIMITS.email.maxAttempts,
    RATE_LIMITS.email.windowSeconds
  );

  const resetAt = new Date(Date.now() + emailResult.reset * 1000);

  return {
    allowed: emailResult.success,
    remaining: emailResult.remaining,
    resetAt,
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const checkLoginRateLimit = (ip: string, email?: string) =>
  checkRateLimit(
    email ? `login:${ip}:${email.toLowerCase()}` : `login:${ip}`,
    5,
    15 * 60
  );

export const checkRegisterRateLimit = (ip: string) =>
  checkRateLimit(`register:${ip}`, 3, 60 * 60); // 3 registrations per hour

export const checkPasswordResetRateLimit = (ip: string) =>
  checkRateLimit(`password-reset:${ip}`, 3, 60 * 60); // 3 resets per hour

export const checkApiRateLimit = (userId: string) =>
  checkRateLimit(`api:${userId}`, 100, 60); // 100 requests per minute

/**
 * Graceful shutdown - close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
