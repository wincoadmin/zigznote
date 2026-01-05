/**
 * Audio upload and recording routes
 * All routes require authentication (session or API key)
 */

import { Router } from 'express';
import type { Router as IRouter, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { audioProcessingService } from '../services/audioProcessingService';
import { inlineTranscriptionService } from '../services/inlineTranscriptionService';
import {
  requireAuth,
  optionalApiKeyAuth,
  requireScope,
  asyncHandler,
  validateRequest,
  type AuthenticatedRequest,
} from '../middleware';

export const audioRouter: IRouter = Router();

// Check for API key first, then fall back to session auth
audioRouter.use(optionalApiKeyAuth);
audioRouter.use(requireAuth);

// Multer config for direct uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// Validation schemas
const getUploadUrlSchema = {
  body: z.object({
    fileName: z.string().min(1).max(255),
    mimeType: z.string().min(1),
    fileSize: z.number().int().positive().max(500 * 1024 * 1024),
  }),
};

const finalizeUploadSchema = {
  body: z.object({
    title: z.string().min(1).max(500),
    fileUrl: z.string().url(),
    fileName: z.string().min(1).max(255),
    fileSize: z.number().int().positive(),
    audioDuration: z.number().int().positive().optional(),
  }),
};

/**
 * @route POST /api/v1/audio/upload-url
 * @description Get a presigned URL for direct upload to S3
 * This is the recommended approach for large files
 */
audioRouter.post(
  '/upload-url',
  requireScope('meetings:write'),
  validateRequest(getUploadUrlSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const result = await audioProcessingService.getUploadUrl(
      authReq.auth!.organizationId,
      req.body.fileName,
      req.body.mimeType,
      req.body.fileSize
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route POST /api/v1/audio/finalize
 * @description After uploading to S3 via presigned URL, call this to create the meeting
 */
audioRouter.post(
  '/finalize',
  requireScope('meetings:write'),
  validateRequest(finalizeUploadSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const result = await audioProcessingService.finalizeUpload(
      authReq.auth!.organizationId,
      authReq.auth!.userId,
      req.body.title,
      req.body.fileUrl,
      req.body.fileName,
      req.body.fileSize,
      req.body.audioDuration
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Audio uploaded. Processing will begin shortly.',
    });
  })
);

/**
 * @route POST /api/v1/audio/upload
 * @description Direct upload through our server (for smaller files or fallback)
 */
audioRouter.post(
  '/upload',
  requireScope('meetings:write'),
  upload.single('audio'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No audio file provided' },
      });
      return;
    }

    const title = req.body.title || file.originalname.replace(/\.[^.]+$/, '');

    const result = await audioProcessingService.createFromRecording({
      organizationId: authReq.auth!.organizationId,
      userId: authReq.auth!.userId,
      title,
      audioBlob: file.buffer,
      mimeType: file.mimetype,
      duration: parseInt(req.body.duration) || 0,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Audio uploaded. Processing will begin shortly.',
    });
  })
);

/**
 * @route POST /api/v1/audio/recording
 * @description Save a browser recording
 */
audioRouter.post(
  '/recording',
  requireScope('meetings:write'),
  upload.single('audio'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No audio file provided' },
      });
      return;
    }

    const title = req.body.title;
    if (!title) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_TITLE', message: 'Title is required' },
      });
      return;
    }

    const duration = parseInt(req.body.duration);
    if (isNaN(duration) || duration <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_DURATION', message: 'Valid duration is required' },
      });
      return;
    }

    const result = await audioProcessingService.createFromRecording({
      organizationId: authReq.auth!.organizationId,
      userId: authReq.auth!.userId,
      title,
      audioBlob: file.buffer,
      mimeType: file.mimetype,
      duration,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Recording saved. Processing will begin shortly.',
    });
  })
);

/**
 * @route POST /api/v1/audio/transcribe-inline
 * @description Transcribe audio file directly without creating a meeting
 * Used for chat attachments - synchronous transcription
 */
audioRouter.post(
  '/transcribe-inline',
  requireScope('meetings:write'),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No audio file provided' },
      });
      return;
    }

    // Validate audio type
    if (!file.mimetype.startsWith('audio/')) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TYPE', message: 'File must be an audio file' },
      });
      return;
    }

    // Check if service is configured
    if (!inlineTranscriptionService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: { code: 'NOT_CONFIGURED', message: 'Transcription service not configured' },
      });
      return;
    }

    const result = await inlineTranscriptionService.transcribe(file.buffer, file.mimetype);

    res.json({
      success: true,
      data: {
        text: result.text,
        duration: result.duration,
        wordCount: result.wordCount,
      },
    });
  })
);
