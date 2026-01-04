import { Router, Request, Response } from 'express';
import type { Router as IRouter } from 'express';

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
}

/**
 * Health check endpoint
 * Used by load balancers and monitoring systems
 */
healthRouter.get('/', (_req: Request, res: Response<HealthResponse>) => {
  const health: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
    checks: {
      database: 'ok', // TODO: Implement actual database check
      redis: 'ok', // TODO: Implement actual Redis check
    },
  };

  res.json(health);
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
healthRouter.get('/ready', (_req: Request, res: Response) => {
  // TODO: Check database and Redis connections
  res.status(200).json({ status: 'ok' });
});
