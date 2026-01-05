/**
 * Meeting Export API Routes
 * Export meetings as PDF, DOCX, or SRT files
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zigznote/database';
import { AppError } from '@zigznote/shared';

export const meetingExportRouter = Router();

// Validation schemas
const exportSchema = z.object({
  format: z.enum(['pdf', 'docx', 'srt', 'txt', 'json']),
  includeTranscript: z.boolean().default(true),
  includeSummary: z.boolean().default(true),
  includeActionItems: z.boolean().default(true),
  includeSpeakerNames: z.boolean().default(true),
  includeTimestamps: z.boolean().default(true),
});

/**
 * Format time in seconds to SRT timestamp format (HH:MM:SS,mmm)
 */
function formatSrtTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Generate SRT subtitle content
 */
function generateSrt(
  segments: Array<{ speaker?: string; text: string; start_ms: number; end_ms: number }>,
  includeSpeakers: boolean
): string {
  return segments
    .map((segment, index) => {
      const startTime = formatSrtTime(segment.start_ms);
      const endTime = formatSrtTime(segment.end_ms);
      const speaker = includeSpeakers && segment.speaker ? `${segment.speaker}: ` : '';

      return `${index + 1}\n${startTime} --> ${endTime}\n${speaker}${segment.text}\n`;
    })
    .join('\n');
}

/**
 * Generate plain text transcript
 */
function generateTxt(
  segments: Array<{ speaker?: string; text: string; start_ms: number }>,
  includeSpeakers: boolean,
  includeTimestamps: boolean
): string {
  return segments
    .map((segment) => {
      const parts: string[] = [];

      if (includeTimestamps) {
        const minutes = Math.floor(segment.start_ms / 60000);
        const seconds = Math.floor((segment.start_ms % 60000) / 1000);
        parts.push(`[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`);
      }

      if (includeSpeakers && segment.speaker) {
        parts.push(`${segment.speaker}:`);
      }

      parts.push(segment.text);

      return parts.join(' ');
    })
    .join('\n\n');
}

/**
 * Generate JSON export
 */
function generateJson(
  meeting: {
    id: string;
    title: string;
    startTime: Date | null;
    endTime: Date | null;
    durationSeconds: number | null;
    transcript?: { segments: unknown; fullText: string } | null;
    summary?: { content: unknown } | null;
    actionItems: Array<{ text: string; assignee: string | null; dueDate: Date | null; completed: boolean }>;
  },
  options: z.infer<typeof exportSchema>
): string {
  const result: Record<string, unknown> = {
    id: meeting.id,
    title: meeting.title,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    durationSeconds: meeting.durationSeconds,
    exportedAt: new Date().toISOString(),
  };

  if (options.includeTranscript && meeting.transcript) {
    result.transcript = {
      fullText: meeting.transcript.fullText,
      segments: meeting.transcript.segments,
    };
  }

  if (options.includeSummary && meeting.summary) {
    result.summary = meeting.summary.content;
  }

  if (options.includeActionItems) {
    result.actionItems = meeting.actionItems.map((item) => ({
      text: item.text,
      assignee: item.assignee,
      dueDate: item.dueDate,
      completed: item.completed,
    }));
  }

  return JSON.stringify(result, null, 2);
}

/**
 * Generate simple HTML for PDF/DOCX conversion
 */
function generateHtml(
  meeting: {
    title: string;
    startTime: Date | null;
    transcript?: { segments: unknown; fullText: string } | null;
    summary?: { content: unknown } | null;
    actionItems: Array<{ text: string; assignee: string | null; dueDate: Date | null; completed: boolean }>;
  },
  options: z.infer<typeof exportSchema>
): string {
  const summaryContent = meeting.summary?.content as Record<string, unknown> | undefined;
  const segments = meeting.transcript?.segments as Array<{ speaker?: string; text: string; start_ms: number }> | undefined;

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${meeting.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
    h1 { color: #111; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .meta { color: #64748b; margin-bottom: 30px; }
    .action-item { padding: 12px; background: #f8fafc; border-left: 4px solid #6366f1; margin: 10px 0; }
    .action-item.completed { opacity: 0.6; text-decoration: line-through; }
    .segment { margin: 16px 0; }
    .speaker { font-weight: 600; color: #6366f1; }
    .timestamp { color: #64748b; font-size: 12px; }
    .summary-section { background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>${meeting.title}</h1>
  <p class="meta">${meeting.startTime?.toLocaleDateString() || 'Date not available'}</p>
`;

  if (options.includeSummary && summaryContent) {
    html += `
  <div class="summary-section">
    <h2>Summary</h2>
    <p>${summaryContent.executive_summary || ''}</p>
`;

    if (summaryContent.topics && Array.isArray(summaryContent.topics)) {
      html += `<h3>Topics Discussed</h3><ul>`;
      for (const topic of summaryContent.topics as string[]) {
        html += `<li>${topic}</li>`;
      }
      html += `</ul>`;
    }

    if (summaryContent.decisions && Array.isArray(summaryContent.decisions)) {
      html += `<h3>Key Decisions</h3><ul>`;
      for (const decision of summaryContent.decisions as string[]) {
        html += `<li>${decision}</li>`;
      }
      html += `</ul>`;
    }

    html += `</div>`;
  }

  if (options.includeActionItems && meeting.actionItems.length > 0) {
    html += `<h2>Action Items</h2>`;
    for (const item of meeting.actionItems) {
      const className = item.completed ? 'action-item completed' : 'action-item';
      html += `
      <div class="${className}">
        <strong>${item.text}</strong>
        ${item.assignee ? `<br><small>Assigned to: ${item.assignee}</small>` : ''}
        ${item.dueDate ? `<br><small>Due: ${item.dueDate.toLocaleDateString()}</small>` : ''}
      </div>`;
    }
  }

  if (options.includeTranscript && segments) {
    html += `<h2>Transcript</h2>`;
    for (const segment of segments) {
      const minutes = Math.floor((segment.start_ms || 0) / 60000);
      const seconds = Math.floor(((segment.start_ms || 0) % 60000) / 1000);
      const timestamp = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

      html += `<div class="segment">`;
      if (options.includeTimestamps) {
        html += `<span class="timestamp">[${timestamp}]</span> `;
      }
      if (options.includeSpeakerNames && segment.speaker) {
        html += `<span class="speaker">${segment.speaker}:</span> `;
      }
      html += `${segment.text}</div>`;
    }
  }

  html += `
</body>
</html>`;

  return html;
}

/**
 * POST /api/v1/meetings/:meetingId/export
 * Export a meeting in the specified format
 */
meetingExportRouter.post(
  '/:meetingId/export',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).auth?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const { meetingId } = req.params;

      const validationResult = exportSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR', { errors: validationResult.error.errors });
      }

      const options = validationResult.data;

      // Get user from database
      const user = await prisma.user.findFirst({
        where: { clerkId: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Get meeting with all related data
      const meeting = await prisma.meeting.findFirst({
        where: {
          id: meetingId,
          organizationId: user.organizationId,
          deletedAt: null,
        },
        include: {
          transcript: options.includeTranscript,
          summary: options.includeSummary,
          actionItems: options.includeActionItems,
        },
      });

      if (!meeting) {
        throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
      }

      let content: string;
      let contentType: string;
      let filename: string;

      const safeTitle = meeting.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);

      switch (options.format) {
        case 'srt': {
          if (!meeting.transcript) {
            throw new AppError('No transcript available for this meeting', 400, 'NO_TRANSCRIPT');
          }
          const segments = meeting.transcript.segments as Array<{ speaker?: string; text: string; start_ms: number; end_ms: number }>;
          content = generateSrt(segments, options.includeSpeakerNames);
          contentType = 'application/x-subrip';
          filename = `${safeTitle}.srt`;
          break;
        }

        case 'txt': {
          if (!meeting.transcript) {
            throw new AppError('No transcript available for this meeting', 400, 'NO_TRANSCRIPT');
          }
          const segments = meeting.transcript.segments as Array<{ speaker?: string; text: string; start_ms: number }>;
          content = generateTxt(segments, options.includeSpeakerNames, options.includeTimestamps);
          contentType = 'text/plain';
          filename = `${safeTitle}.txt`;
          break;
        }

        case 'json': {
          content = generateJson(meeting, options);
          contentType = 'application/json';
          filename = `${safeTitle}.json`;
          break;
        }

        case 'pdf':
        case 'docx': {
          // For PDF/DOCX, we return HTML that can be converted client-side
          // or via a separate service. For now, return HTML.
          content = generateHtml(meeting, options);
          contentType = 'text/html';
          filename = `${safeTitle}.html`;
          break;
        }

        default:
          throw new AppError(`Unsupported format: ${options.format}`, 400, 'UNSUPPORTED_FORMAT');
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error) {
      next(error);
    }
  }
);

export default meetingExportRouter;
