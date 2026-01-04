import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { standardRateLimit } from './middleware/rateLimit';
import { clerkAuthMiddleware } from './middleware/auth';
import { healthRouter } from './routes/health';
import { apiRouter } from './routes/api';
import clerkWebhookRouter from './routes/webhooks/clerk';

/**
 * Creates and configures the Express application
 * @returns Configured Express application
 */
export function createApp(): Express {
  const app = express();

  // Trust proxy for rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    })
  );

  // Request parsing - webhooks need raw body for signature verification
  // so we use express.json() after the webhook routes
  app.use('/webhooks', express.raw({ type: 'application/json' }));

  // Request parsing for other routes
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // Request ID tracking
  app.use(requestIdMiddleware);

  // Logging
  if (config.nodeEnv !== 'test') {
    app.use(morgan('combined'));
  }

  // Public routes (before auth middleware)
  app.use('/health', healthRouter);

  // Webhook routes (no auth required, signature verified internally)
  app.use('/webhooks/clerk', clerkWebhookRouter);

  // Clerk auth middleware (only for API routes)
  // Skip in test environment if no Clerk key is configured
  if (config.clerk.secretKey || config.nodeEnv !== 'test') {
    app.use('/api', clerkAuthMiddleware);
  }

  // Rate limiting (applied to API routes only)
  app.use('/api', standardRateLimit);

  // Protected API routes
  app.use('/api', apiRouter);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
