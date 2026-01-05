import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { meetingsRouter } from './meetings';
import calendarRouter from './calendar';
import { insightsRouter } from './insights';
import { apiKeysRouter } from './apiKeys';
import { speakersRouter } from './speakers';
import { vocabularyRouter } from './vocabulary';
import { voiceProfilesRouter } from './voiceProfiles';
import { audioRouter } from './audio';
import { searchRouter } from './search';
import { conversationsRouter } from './conversations';
import { helpRouter } from './help';
import { analyticsRouter } from './analytics';
import chatRouter from './chat';
import settingsRouter from './settings';
import dataExportRouter from './dataExport';
import sharingRouter from './sharing';
import meetingExportRouter from './meetingExport';
import { documentsRouter } from './documents';

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
apiRouter.use('/v1/audio', audioRouter);
apiRouter.use('/v1/search', searchRouter);
// AI Meeting Assistant Q&A
apiRouter.use('/v1', conversationsRouter);
// Help Assistant
apiRouter.use('/v1/help', helpRouter);
// Analytics & Engagement
apiRouter.use('/v1/analytics', analyticsRouter);
// Meeting AI Chat
apiRouter.use('/v1/chat', chatRouter);
// Settings (notifications, organization)
apiRouter.use('/v1/settings', settingsRouter);
// GDPR Data Export
apiRouter.use('/v1/data-export', dataExportRouter);
// Meeting Sharing
apiRouter.use('/v1/sharing', sharingRouter);
// Meeting Export (PDF, DOCX, SRT)
apiRouter.use('/v1/meetings', meetingExportRouter);
// Document Generation (from AI chat)
apiRouter.use('/v1/documents', documentsRouter);

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
