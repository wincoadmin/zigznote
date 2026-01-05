import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { meetingsRouter } from './meetings';
import calendarRouter from './calendar';
import { insightsRouter } from './insights';
import { apiKeysRouter } from './apiKeys';
import { speakersRouter } from './speakers';
import { vocabularyRouter } from './vocabulary';
import { voiceProfilesRouter } from './voiceProfiles';

export const apiRouter: IRouter = Router();

/**
 * API version prefix - v1 routes
 */
apiRouter.use('/v1/meetings', meetingsRouter);
apiRouter.use('/v1/calendar', calendarRouter);
apiRouter.use('/v1/insights', insightsRouter);
apiRouter.use('/v1/api-keys', apiKeysRouter);
apiRouter.use('/v1/speakers', speakersRouter);
apiRouter.use('/v1/vocabulary', vocabularyRouter);
apiRouter.use('/v1/voice-profiles', voiceProfilesRouter);

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
