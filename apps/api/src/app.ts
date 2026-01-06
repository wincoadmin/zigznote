import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { standardRateLimit } from './middleware/rateLimit';
import { healthRouter } from './routes/health';
import { apiRouter } from './routes/api';
import { adminRouter } from './routes/admin';
import recallWebhookRouter from './routes/webhooks/recall';
import { metricsCollector } from './middleware/metricsCollector';
import { initializeAlertService } from './monitoring/alertService';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/openapi';

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

  // Cookie parsing (for admin sessions)
  app.use(cookieParser());

  // Compression
  app.use(compression());

  // Request ID tracking
  app.use(requestIdMiddleware);

  // Logging
  if (config.nodeEnv !== 'test') {
    app.use(morgan('combined'));
  }

  // Metrics collection (before routes, after logging)
  if (config.nodeEnv !== 'test') {
    app.use(metricsCollector);

    // Initialize alerting service
    if (config.alerts?.enabled) {
      initializeAlertService(config.alerts.checkIntervalMs);
    }
  }

  // Swagger UI documentation
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'zigznote API Documentation',
    })
  );

  // OpenAPI spec as JSON
  app.get('/api/docs/openapi.json', (_req, res) => {
    res.json(swaggerSpec);
  });

  // Public routes (before auth middleware)
  app.use('/health', healthRouter);

  // Webhook routes (no auth required, signature verified internally)
  app.use('/webhooks/recall', recallWebhookRouter);

  // Admin panel routes (separate auth system)
  app.use('/api/admin', adminRouter);

  // Rate limiting (applied to API routes only)
  // Note: Authentication is handled per-route using requireAuth middleware
  app.use('/api', standardRateLimit);

  // Protected API routes
  app.use('/api', apiRouter);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
