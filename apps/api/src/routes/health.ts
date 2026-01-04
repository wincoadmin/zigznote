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
 * Health check endpoint
 * Used by load balancers and monitoring systems
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
 * Liveness probe - just confirms the server is running
 */
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Readiness probe - confirms the server can handle requests
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
