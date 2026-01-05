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
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  apiUrl: z.string().default('http://localhost:3001'),
  webUrl: z.string().default('http://localhost:3000'),
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
    logLevel: process.env.LOG_LEVEL,
    apiUrl: process.env.API_URL,
    webUrl: process.env.WEB_URL,
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
        logLevel: 'error' as const,
        apiUrl: 'http://localhost:3001',
        webUrl: 'http://localhost:3000',
      };
    }
    console.error('Invalid configuration:', result.error.format());
    throw new Error('Invalid configuration');
  }

  return result.data;
};

const baseConfig = parseConfig();

/**
 * Application configuration
 */
export const config = {
  ...baseConfig,

  /**
   * Clerk authentication configuration
   */
  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY || '',
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET || '',
  },

  /**
   * Google OAuth configuration
   */
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${baseConfig.apiUrl}/api/calendar/google/callback`,
  },

  /**
   * Encryption key for storing sensitive data
   */
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-chars-!!!',

  /**
   * Recall.ai configuration for meeting bots
   */
  recall: {
    apiKey: process.env.RECALL_API_KEY || '',
    webhookSecret: process.env.RECALL_WEBHOOK_SECRET || '',
    baseUrl: process.env.RECALL_BASE_URL || 'https://us-west-2.recall.ai/api/v1',
    botName: process.env.RECALL_BOT_NAME || 'zigznote Assistant',
  },

  /**
   * Deepgram configuration for transcription
   */
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY || '',
    baseUrl: process.env.DEEPGRAM_BASE_URL || 'https://api.deepgram.com/v1',
  },

  /**
   * Redis configuration
   */
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  /**
   * Slack integration
   */
  slack: {
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    redirectUri: process.env.SLACK_REDIRECT_URI || `${baseConfig.apiUrl}/api/v1/integrations/slack/callback`,
  },

  /**
   * HubSpot integration
   */
  hubspot: {
    clientId: process.env.HUBSPOT_CLIENT_ID || '',
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET || '',
    redirectUri: process.env.HUBSPOT_REDIRECT_URI || `${baseConfig.apiUrl}/api/v1/integrations/hubspot/callback`,
  },

  /**
   * Stripe payments
   */
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  /**
   * Flutterwave payments
   */
  flutterwave: {
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || '',
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
    webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET || '',
  },

  /**
   * AWS/S3 storage configuration
   * Supports AWS S3 or S3-compatible services (MinIO, Cloudflare R2)
   */
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.AWS_S3_BUCKET || 'zigznote-audio',
    endpoint: process.env.AWS_S3_ENDPOINT, // For S3-compatible (MinIO, R2)
    cdnUrl: process.env.AWS_CDN_URL, // CloudFront or CDN URL
  },
};

export type Config = typeof config;
