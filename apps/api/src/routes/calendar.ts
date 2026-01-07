/**
 * Calendar routes for OAuth and sync
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { Router as IRouter } from 'express';
import { z } from 'zod';
import { googleCalendarService } from '../services/googleCalendarService';
import { calendarRepository } from '@zigznote/database';
import { requireAuth, validateRequest, type AuthenticatedRequest } from '../middleware';
import { config } from '../config';
import { logger } from '../utils/logger';
import { NotFoundError, BadRequestError } from '@zigznote/shared';

const router: IRouter = Router();

/**
 * GET /calendar/google/connect
 * Initiates Google OAuth flow
 */
router.get(
  '/google/connect',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth!.userId;

      const authUrl = googleCalendarService.getAuthUrl(userId);

      res.json({ authUrl });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /calendar/google/callback
 * Handles Google OAuth callback
 */
router.get(
  '/google/callback',
  async (req: Request, res: Response): Promise<void> => {
    const { code, state, error } = req.query;

    if (error) {
      logger.warn({ error }, 'Google OAuth error');
      res.redirect(`${config.webUrl}/settings/calendar?error=oauth_denied`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.redirect(`${config.webUrl}/settings/calendar?error=missing_code`);
      return;
    }

    if (!state || typeof state !== 'string') {
      res.redirect(`${config.webUrl}/settings/calendar?error=missing_state`);
      return;
    }

    try {
      // State contains the user ID
      await googleCalendarService.handleCallback(code, state);

      res.redirect(`${config.webUrl}/settings/calendar?success=connected`);
    } catch (err) {
      logger.error({ error: err }, 'Failed to handle Google OAuth callback');
      res.redirect(`${config.webUrl}/settings/calendar?error=callback_failed`);
    }
  }
);

/**
 * POST /calendar/sync
 * Triggers manual calendar sync
 */
router.post(
  '/sync',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth!.userId;
      const organizationId = authReq.auth!.organizationId;

      const connections = await calendarRepository.findByUserId(userId);

      if (connections.length === 0) {
        throw new BadRequestError('No calendar connections found');
      }

      const results = [];

      for (const connection of connections) {
        if (!connection.syncEnabled) {
          continue;
        }

        try {
          const result = await googleCalendarService.syncCalendar(
            connection.id,
            organizationId
          );
          results.push({
            connectionId: connection.id,
            provider: connection.provider,
            ...result,
          });
        } catch (error) {
          logger.error({ error, connectionId: connection.id }, 'Sync failed');
          results.push({
            connectionId: connection.id,
            provider: connection.provider,
            error: 'Sync failed',
          });
        }
      }

      res.json({ results });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /calendar/events
 * Lists synced calendar events
 */
router.get(
  '/events',
  requireAuth,
  validateRequest({
    query: z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      connectionId: z.string().uuid().optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth!.userId;
      const { startDate, endDate, connectionId } = req.query;

      // Default to next 7 days
      const timeMin = startDate ? new Date(startDate as string) : new Date();
      const timeMax = endDate
        ? new Date(endDate as string)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      let connections = await calendarRepository.findByUserId(userId);

      if (connectionId) {
        connections = connections.filter((c) => c.id === connectionId);
      }

      if (connections.length === 0) {
        res.json({ events: [] });
        return;
      }

      const allEvents = [];

      for (const connection of connections) {
        if (!connection.syncEnabled) {
          continue;
        }

        try {
          const events = await googleCalendarService.listEvents(
            connection.id,
            timeMin,
            timeMax
          );
          allEvents.push(
            ...events.map((e) => ({
              ...e,
              connectionId: connection.id,
              provider: connection.provider,
            }))
          );
        } catch (error) {
          logger.error({ error, connectionId: connection.id }, 'Failed to list events');
        }
      }

      // Sort by start time
      allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

      res.json({ events: allEvents });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /calendar/status
 * Gets calendar connection status for the current user
 */
router.get(
  '/status',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth!.userId;

      const connections = await calendarRepository.findByUserId(userId);

      // Return first connection (typically only one per provider)
      const connection = connections[0];

      if (!connection) {
        res.json({ connection: null });
        return;
      }

      res.json({
        connection: {
          id: connection.id,
          provider: connection.provider,
          email: connection.email,
          calendarId: connection.calendarId,
          syncEnabled: connection.syncEnabled,
          autoRecord: connection.autoRecord,
          lastSyncedAt: connection.lastSyncedAt,
          createdAt: connection.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /calendar/connections
 * Lists calendar connections for the user
 */
router.get(
  '/connections',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth!.userId;

      const connections = await calendarRepository.findByUserId(userId);

      // Don't expose tokens
      const safeConnections = connections.map((c) => ({
        id: c.id,
        provider: c.provider,
        email: c.email,
        calendarId: c.calendarId,
        syncEnabled: c.syncEnabled,
        autoRecord: c.autoRecord,
        lastSyncedAt: c.lastSyncedAt,
        createdAt: c.createdAt,
      }));

      res.json({ connections: safeConnections });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /calendar/connections/:id
 * Disconnects a calendar
 */
router.delete(
  '/connections/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth!.userId;
      const { id } = req.params;

      if (!id) {
        throw new BadRequestError('Connection ID is required');
      }

      const connection = await calendarRepository.findById(id);

      if (!connection) {
        throw new NotFoundError('Calendar connection');
      }

      // Ensure user owns this connection
      if (connection.userId !== userId) {
        throw new NotFoundError('Calendar connection');
      }

      await calendarRepository.delete(id);

      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /calendar/connections/:id
 * Updates connection settings
 */
router.patch(
  '/connections/:id',
  requireAuth,
  validateRequest({
    body: z.object({
      syncEnabled: z.boolean().optional(),
      calendarId: z.string().optional(),
      autoRecord: z.boolean().optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth!.userId;
      const { id } = req.params;
      const { syncEnabled, calendarId, autoRecord } = req.body;

      if (!id) {
        throw new BadRequestError('Connection ID is required');
      }

      const connection = await calendarRepository.findById(id);

      if (!connection) {
        throw new NotFoundError('Calendar connection');
      }

      // Ensure user owns this connection
      if (connection.userId !== userId) {
        throw new NotFoundError('Calendar connection');
      }

      const updated = await calendarRepository.update(id, {
        syncEnabled,
        calendarId,
        autoRecord,
      });

      res.json({
        id: updated.id,
        provider: updated.provider,
        email: updated.email,
        calendarId: updated.calendarId,
        syncEnabled: updated.syncEnabled,
        autoRecord: updated.autoRecord,
        lastSyncedAt: updated.lastSyncedAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /calendar/auto-record
 * Toggle auto-record for all calendar connections
 */
router.put(
  '/auto-record',
  requireAuth,
  validateRequest({
    body: z.object({
      enabled: z.boolean(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth!.userId;
      const { enabled } = req.body;

      const connections = await calendarRepository.findByUserId(userId);

      if (connections.length === 0) {
        throw new BadRequestError('No calendar connections found. Please connect a calendar first.');
      }

      // Update all connections
      for (const connection of connections) {
        await calendarRepository.update(connection.id, {
          autoRecord: enabled,
        });
      }

      res.json({ success: true, autoRecord: enabled });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
