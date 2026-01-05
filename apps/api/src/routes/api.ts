import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { meetingsRouter } from './meetings';
import calendarRouter from './calendar';
import { insightsRouter } from './insights';
import { apiKeysRouter } from './apiKeys';

export const apiRouter: IRouter = Router();

/**
 * API version prefix - v1 routes
 */
apiRouter.use('/v1/meetings', meetingsRouter);
apiRouter.use('/v1/calendar', calendarRouter);
apiRouter.use('/v1/insights', insightsRouter);
apiRouter.use('/v1/api-keys', apiKeysRouter);

/**
 * API root - returns API information
 */
apiRouter.get('/', (_req, res) => {
  res.json({
    name: 'zigznote API',
    version: '1.0.0',
    documentation: '/api/docs',
  });
});
