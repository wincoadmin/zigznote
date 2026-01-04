import dotenv from 'dotenv';
import { z } from 'zod';

// Only load .env in development (not in test mode to avoid conflicts)
if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3001),
  databaseUrl: z.string().optional(),
  redisUrl: z.string().optional(),
  corsOrigins: z.array(z.string()).default(['http://localhost:3000']),
  jwtSecret: z.string().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parseConfig = () => {
  const corsOriginsRaw = process.env.CORS_ORIGINS;
  const corsOrigins = corsOriginsRaw
    ? corsOriginsRaw.split(',').map((s) => s.trim())
    : undefined;

  const result = configSchema.safeParse({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.API_PORT || process.env.PORT,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    corsOrigins,
    jwtSecret: process.env.JWT_SECRET,
    logLevel: process.env.LOG_LEVEL,
  });

  if (!result.success) {
    // In test mode, use defaults instead of throwing
    if (process.env.NODE_ENV === 'test') {
      return {
        nodeEnv: 'test' as const,
        port: 3099,
        databaseUrl: undefined,
        redisUrl: undefined,
        corsOrigins: ['http://localhost:3000'],
        jwtSecret: undefined,
        logLevel: 'error' as const,
      };
    }
    console.error('Invalid configuration:', result.error.format());
    throw new Error('Invalid configuration');
  }

  return result.data;
};

export const config = parseConfig();

export type Config = typeof config;
