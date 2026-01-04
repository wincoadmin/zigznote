import pino from 'pino';
import { config } from '../config';

/**
 * Configured pino logger instance
 */
export const logger = pino({
  level: config.logLevel,
  transport:
    config.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    env: config.nodeEnv,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

/**
 * Creates a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
