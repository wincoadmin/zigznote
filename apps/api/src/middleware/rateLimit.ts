/**
 * Rate limiting middleware
 */

import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { config } from '../config';

/**
 * Standard rate limit for API endpoints
 * 100 requests per minute per IP
 */
export const standardRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.nodeEnv === 'test',
  keyGenerator: (req: Request) => {
    // Use X-Forwarded-For for proxied requests, fallback to IP
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || 'unknown';
  },
});

/**
 * Strict rate limit for sensitive endpoints (auth, webhooks)
 * 20 requests per minute per IP
 */
export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests to this endpoint',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.nodeEnv === 'test',
});

/**
 * Very strict rate limit for expensive operations (AI, search)
 * 10 requests per minute per IP
 */
export const expensiveRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests for this resource-intensive operation',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.nodeEnv === 'test',
});
