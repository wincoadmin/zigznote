/**
 * Health check routes
 */

import { Router, Request, Response } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '@zigznote/database';
import { getRedisConnection, getQueueStats } from '../jobs';
import { logger } from '../utils/logger';

export const healthRouter: IRouter = Router();

interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
  queues?: Record<string, {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }>;
}

/**
 * Checks database connectivity
 */
async function checkDatabase(): Promise<'ok' | 'error'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'ok';
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return 'error';
  }
}

/**
 * Checks Redis connectivity
 */
async function checkRedis(): Promise<'ok' | 'error'> {
  try {
    const redis = getRedisConnection();
    await redis.ping();
    return 'ok';
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return 'error';
  }
}

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Comprehensive health check including database and Redis status
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                 uptime:
 *                   type: number
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       enum: [ok, error]
 *                     redis:
 *                       type: string
 *                       enum: [ok, error]
 *       503:
 *         description: API is unhealthy
 */
healthRouter.get('/', async (_req: Request, res: Response<HealthResponse>) => {
  const [databaseStatus, redisStatus] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  // Determine overall status
  let status: 'ok' | 'degraded' | 'unhealthy' = 'ok';
  if (databaseStatus === 'error' && redisStatus === 'error') {
    status = 'unhealthy';
  } else if (databaseStatus === 'error' || redisStatus === 'error') {
    status = 'degraded';
  }

  // Get queue stats if Redis is ok
  let queues: HealthResponse['queues'];
  if (redisStatus === 'ok') {
    try {
      queues = await getQueueStats();
    } catch {
      // Ignore queue stats errors
    }
  }

  const health: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
    checks: {
      database: databaseStatus,
      redis: redisStatus,
    },
    queues,
  };

  const statusCode = status === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(health);
});

/**
 * @openapi
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Simple check that confirms the server is running
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * @openapi
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Confirms the server can handle requests (database and Redis available)
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is ready to accept requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *       503:
 *         description: Server is not ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: not ready
 *                 reason:
 *                   type: string
 */
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const [databaseStatus, redisStatus] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  if (databaseStatus === 'error') {
    res.status(503).json({ status: 'not ready', reason: 'database unavailable' });
    return;
  }

  if (redisStatus === 'error') {
    res.status(503).json({ status: 'not ready', reason: 'redis unavailable' });
    return;
  }

  res.status(200).json({ status: 'ok' });
});
