/**
 * Document Generation Routes
 * Generate downloadable documents from AI chat content
 */

import { Router } from 'express';
import type { Router as RouterType, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { documentGeneratorService } from '../services/documentGeneratorService';
import { BadRequestError } from '@zigznote/shared';

export const documentsRouter: RouterType = Router();

// Validation schema for document generation
const generateDocumentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(100000, 'Content too long'),
  format: z.enum(['pdf', 'docx', 'md', 'csv'], {
    errorMap: () => ({ message: 'Format must be one of: pdf, docx, md, csv' }),
  }),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  meetingId: z.string().uuid().optional(),
  contentType: z.enum(['summary', 'action_items', 'decisions', 'transcript_excerpt', 'custom']).optional(),
});

/**
 * POST /documents/generate
 * Generate a downloadable document from content
 */
documentsRouter.post(
  '/generate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = req.auth;
      if (!auth?.userId || !auth?.organizationId) {
        throw new BadRequestError('Authentication required');
      }

      const parseResult = generateDocumentSchema.safeParse(req.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0];
        throw new BadRequestError(firstError?.message || 'Invalid request');
      }

      const { content, format, title, meetingId, contentType } = parseResult.data;

      const result = await documentGeneratorService.generate({
        content,
        format,
        title,
        meetingId,
        contentType,
        userId: auth.userId,
        organizationId: auth.organizationId,
      });

      res.json({
        success: true,
        data: {
          downloadUrl: result.downloadUrl,
          fileName: result.fileName,
          fileSize: result.fileSize,
          expiresAt: result.expiresAt.toISOString(),
          mimeType: result.mimeType,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default documentsRouter;
