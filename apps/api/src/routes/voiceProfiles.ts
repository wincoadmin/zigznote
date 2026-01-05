/**
 * Voice profile routes
 * Manages voice profiles for cross-meeting speaker recognition
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response, NextFunction } from 'express';
import { voiceProfileService } from '../services/voiceProfileService';
import { speakerRecognitionService } from '../../../../services/transcription/src/speakerRecognition';
import { requireAuth, optionalApiKeyAuth, requireScope, type AuthenticatedRequest } from '../middleware';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '@zigznote/shared';

export const voiceProfilesRouter: IRouter = Router();

// Check for API key first, then fall back to session auth
voiceProfilesRouter.use(optionalApiKeyAuth);
voiceProfilesRouter.use(requireAuth);

/**
 * Validation schemas
 */
const createProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  email: z.string().email().optional(),
});

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().nullable(),
});

const mergeProfilesSchema = z.object({
  keepId: z.string().uuid(),
  mergeId: z.string().uuid(),
});

const confirmSpeakerSchema = z.object({
  confirmed: z.boolean(),
});

/**
 * @route GET /api/v1/voice-profiles
 * @description List all voice profiles for the organization
 */
voiceProfilesRouter.get(
  '/',
  requireScope('transcripts:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const profiles = await voiceProfileService.getOrgProfiles(
        authReq.auth!.organizationId
      );
      res.json({ success: true, data: profiles, total: profiles.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/voice-profiles
 * @description Create a new voice profile
 */
voiceProfilesRouter.post(
  '/',
  requireScope('transcripts:write'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const validation = createProfileSchema.safeParse(req.body);

      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      const profile = await voiceProfileService.createProfile({
        organizationId: authReq.auth!.organizationId,
        displayName: validation.data.displayName,
        email: validation.data.email,
      });
      res.status(201).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/voice-profiles/:id
 * @description Get a specific voice profile with recent matches
 */
voiceProfilesRouter.get(
  '/:id',
  requireScope('transcripts:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const profile = await voiceProfileService.getProfileWithMatches(req.params.id);

      if (!profile) {
        throw new NotFoundError('Voice profile not found');
      }

      // Verify the profile belongs to the user's organization
      if (profile.organizationId !== authReq.auth!.organizationId) {
        throw new NotFoundError('Voice profile not found');
      }

      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PATCH /api/v1/voice-profiles/:id
 * @description Update a voice profile
 */
voiceProfilesRouter.patch(
  '/:id',
  requireScope('transcripts:write'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const validation = updateProfileSchema.safeParse(req.body);

      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      // Verify the profile belongs to the user's organization
      const existing = await voiceProfileService.getProfile(req.params.id);
      if (!existing || existing.organizationId !== authReq.auth!.organizationId) {
        throw new NotFoundError('Voice profile not found');
      }

      const profile = await voiceProfileService.updateProfile(req.params.id, validation.data);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route DELETE /api/v1/voice-profiles/:id
 * @description Delete a voice profile
 */
voiceProfilesRouter.delete(
  '/:id',
  requireScope('transcripts:write'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      // Verify the profile belongs to the user's organization
      const existing = await voiceProfileService.getProfile(req.params.id);
      if (!existing || existing.organizationId !== authReq.auth!.organizationId) {
        throw new NotFoundError('Voice profile not found');
      }

      await voiceProfileService.deleteProfile(req.params.id);
      res.json({ success: true, message: 'Voice profile deleted' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/voice-profiles/merge
 * @description Merge two voice profiles (when we discover they're the same person)
 */
voiceProfilesRouter.post(
  '/merge',
  requireScope('transcripts:write'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const validation = mergeProfilesSchema.safeParse(req.body);

      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      // Verify both profiles belong to the user's organization
      const [keep, merge] = await Promise.all([
        voiceProfileService.getProfile(validation.data.keepId),
        voiceProfileService.getProfile(validation.data.mergeId),
      ]);

      if (!keep || keep.organizationId !== authReq.auth!.organizationId) {
        throw new NotFoundError('Keep profile not found');
      }
      if (!merge || merge.organizationId !== authReq.auth!.organizationId) {
        throw new NotFoundError('Merge profile not found');
      }

      const merged = await voiceProfileService.mergeProfiles(
        validation.data.keepId,
        validation.data.mergeId
      );
      res.json({ success: true, data: merged });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/voice-profiles/meetings/:meetingId/speakers
 * @description Get identified speakers for a meeting
 */
voiceProfilesRouter.get(
  '/meetings/:meetingId/speakers',
  requireScope('transcripts:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const speakers = await voiceProfileService.getMeetingSpeakers(req.params.meetingId);
      res.json({ success: true, data: speakers, total: speakers.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/voice-profiles/meetings/:meetingId/speakers/reprocess
 * @description Re-run speaker recognition for a meeting
 */
voiceProfilesRouter.post(
  '/meetings/:meetingId/speakers/reprocess',
  requireScope('transcripts:write'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await speakerRecognitionService.reprocessMeeting(req.params.meetingId);
      res.json({
        success: true,
        data: {
          identifiedSpeakers: Object.fromEntries(result.speakerMap),
          newProfiles: result.newProfiles.length,
          matchedProfiles: result.matchedProfiles.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/voice-profiles/meetings/:meetingId/speakers/:speakerLabel/confirm
 * @description Confirm or reject a speaker identification
 */
voiceProfilesRouter.post(
  '/meetings/:meetingId/speakers/:speakerLabel/confirm',
  requireScope('transcripts:write'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = confirmSpeakerSchema.safeParse(req.body);

      if (!validation.success) {
        throw new ValidationError(validation.error.message);
      }

      const match = await voiceProfileService.getSpeakerMatch(
        req.params.meetingId,
        req.params.speakerLabel
      );

      if (!match) {
        throw new NotFoundError('Speaker match not found');
      }

      await voiceProfileService.confirmMatch(match.voiceProfileId, validation.data.confirmed);

      res.json({
        success: true,
        message: validation.data.confirmed ? 'Match confirmed' : 'Match rejected',
      });
    } catch (error) {
      next(error);
    }
  }
);
