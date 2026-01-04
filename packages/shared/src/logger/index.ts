/**
 * Structured logging for zigznote
 * Uses pino for high-performance JSON logging
 */

import pino from 'pino';

/**
 * Fields that should be redacted from logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'cookie',
  'creditCard',
  'ssn',
  'accessToken',
  'refreshToken',
  'privateKey',
];

/**
 * Recursively redacts sensitive fields from an object
 */
function redactSensitive(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitive);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      result[key] = redactSensitive(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Create the pino logger instance
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
    log: (obj) => redactSensitive(obj) as Record<string, unknown>,
  },
  base: {
    env: process.env.NODE_ENV,
    service: 'zigznote',
  },
});

/**
 * Creates a child logger with additional context
 * Useful for adding request-specific context (traceId, userId, etc.)
 *
 * @param context - Additional fields to include in all logs
 * @returns A child logger instance
 *
 * @example
 * ```typescript
 * const reqLogger = createLogger({ traceId: req.traceId, userId: req.user?.id });
 * reqLogger.info('Processing request');
 * ```
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export type Logger = typeof logger;
