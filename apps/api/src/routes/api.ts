import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { meetingsRouter } from './meetings';

export const apiRouter: IRouter = Router();

/**
 * API version prefix
 */
apiRouter.use('/v1/meetings', meetingsRouter);

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
