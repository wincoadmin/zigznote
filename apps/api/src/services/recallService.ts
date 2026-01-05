/**
 * Recall.ai service for meeting bot management
 * Handles bot creation, status tracking, and webhook processing
 */

import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { BadRequestError, RecallApiError, ConflictError } from '@zigznote/shared';
import { meetingRepository, prisma } from '@zigznote/database';
import { addTranscriptionJob } from '../jobs';
import { emitBotStatus, emitTranscriptChunk } from '../websocket';

/**
 * Bot creation parameters
 */
export interface CreateBotParams {
  meetingId: string;
  meetingUrl: string;
  organizationId: string;
  botName?: string;
  joinAt?: Date;
  transcriptionEnabled?: boolean;
}

/**
 * Bot status from Recall.ai
 */
export interface BotStatus {
  id: string;
  status: 'ready' | 'joining' | 'in_call' | 'leaving' | 'ended' | 'error';
  meetingUrl: string;
  joinedAt?: Date;
  leftAt?: Date;
  errorMessage?: string;
  recordingAvailable: boolean;
}

/**
 * Recording information
 */
export interface RecordingInfo {
  url: string;
  durationMs: number;
  format: string;
  expiresAt: Date;
}

/**
 * Recall.ai webhook event types
 */
export type RecallWebhookEventType =
  | 'bot.join_call'
  | 'bot.leave_call'
  | 'bot.media_ready'
  | 'bot.transcription'
  | 'bot.error'
  | 'bot.waiting_room'
  | 'bot.kicked';

/**
 * Recall.ai webhook event
 */
export interface RecallWebhookEvent {
  event: RecallWebhookEventType;
  data: {
    bot_id: string;
    meeting_url?: string;
    recording_url?: string;
    transcript_url?: string;
    transcript?: TranscriptChunk[];
    error_message?: string;
    reason?: string;
    timestamp?: string;
  };
}

/**
 * Real-time transcript chunk
 */
export interface TranscriptChunk {
  speaker: string;
  text: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
}

/**
 * Parsed meeting URL info
 */
export interface ParsedMeetingUrl {
  platform: 'zoom' | 'meet' | 'teams' | 'webex' | 'other';
  meetingId?: string;
  password?: string;
}

/**
 * Service for interacting with Recall.ai API
 */
class RecallService {
  private baseUrl: string;
  private apiKey: string;
  private webhookSecret: string;
  private botName: string;

  constructor() {
    this.baseUrl = config.recall.baseUrl;
    this.apiKey = config.recall.apiKey;
    this.webhookSecret = config.recall.webhookSecret;
    this.botName = config.recall.botName;
  }

  /**
   * Parse a meeting URL to extract platform and meeting ID
   */
  parseJoinUrl(url: string): ParsedMeetingUrl {
    // Handle zoommtg:// protocol first (before URL parsing which would fail)
    if (url.startsWith('zoommtg://')) {
      const confnoMatch = url.match(/confno=(\d+)/);
      const meetingId = confnoMatch ? confnoMatch[1] : undefined;
      const pwdMatch = url.match(/pwd=([^&]+)/);
      const password = pwdMatch ? pwdMatch[1] : undefined;
      return { platform: 'zoom', meetingId, password };
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Zoom URLs
      if (hostname.includes('zoom.us') || hostname.includes('zoom.com')) {
        const match = url.match(/\/j\/(\d+)/);
        const meetingId = match ? match[1] : undefined;
        const pwdMatch = url.match(/pwd=([^&]+)/);
        const password = pwdMatch ? pwdMatch[1] : undefined;
        return { platform: 'zoom', meetingId, password };
      }

      // Google Meet URLs
      if (hostname.includes('meet.google.com')) {
        const match = url.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);
        const meetingId = match ? match[1] : undefined;
        return { platform: 'meet', meetingId };
      }

      // Microsoft Teams URLs
      if (hostname.includes('teams.microsoft.com') || hostname.includes('teams.live.com')) {
        // Teams URLs are complex with tenant IDs
        return { platform: 'teams' };
      }

      // Webex URLs
      if (hostname.includes('webex.com')) {
        return { platform: 'webex' };
      }

      return { platform: 'other' };
    } catch {
      return { platform: 'other' };
    }
  }

  /**
   * Extract password from calendar event body
   */
  extractPasswordFromBody(body: string): string | undefined {
    const patterns = [
      /Password:\s*([^\s\n]+)/i,
      /Passcode:\s*([^\s\n]+)/i,
      /Meeting password is:\s*([^\s\n]+)/i,
      /Pin:\s*([^\s\n]+)/i,
      /Access code:\s*([^\s\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Create a bot to join a meeting
   * Includes duplicate prevention to avoid multiple bots for the same meeting
   */
  async createBot(params: CreateBotParams): Promise<BotStatus> {
    const { meetingId, meetingUrl, organizationId, botName, joinAt, transcriptionEnabled = false } = params;

    logger.info({ meetingId, meetingUrl, joinAt }, 'Creating Recall.ai bot');

    // Phase 8.95: Duplicate bot prevention
    // Check 1: Existing active bot for this meeting record
    const existingBot = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        status: { in: ['joining', 'in_progress', 'recording'] },
        botId: { not: null },
      },
    });

    if (existingBot) {
      logger.warn({ meetingId, existingBotId: existingBot.botId }, 'Duplicate bot creation attempt blocked');
      throw new ConflictError(
        'A recording is already in progress for this meeting. ' +
        'Please wait for it to complete or stop it first.'
      );
    }

    // Check 2: Active bot for same meeting URL (different meeting record in same org)
    const duplicateUrl = await prisma.meeting.findFirst({
      where: {
        meetingUrl,
        organizationId,
        status: { in: ['joining', 'in_progress', 'recording'] },
        botId: { not: null },
        id: { not: meetingId },
      },
    });

    if (duplicateUrl) {
      logger.warn({ meetingId, meetingUrl, duplicateMeetingId: duplicateUrl.id }, 'Duplicate URL bot creation attempt blocked');
      throw new ConflictError(
        'This meeting URL is already being recorded in another session.'
      );
    }

    const body: Record<string, unknown> = {
      meeting_url: meetingUrl,
      bot_name: botName || this.botName,
    };

    // Add join time if specified (scheduled join)
    if (joinAt) {
      body.join_at = joinAt.toISOString();
    }

    // Configure recording options
    body.recording_config = {
      transcript: transcriptionEnabled
        ? { provider: { meeting_captions: {} } }
        : undefined,
    };

    try {
      const response = await fetch(`${this.baseUrl}/bot`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, error: errorText }, 'Recall.ai bot creation failed');
        throw new RecallApiError(`Bot creation failed: ${errorText}`);
      }

      const data = (await response.json()) as { id: string; status?: string };

      return {
        id: data.id,
        status: (data.status as BotStatus['status']) || 'ready',
        meetingUrl,
        recordingAvailable: false,
      };
    } catch (error) {
      if (error instanceof RecallApiError) {
        throw error;
      }
      logger.error({ error }, 'Failed to create Recall.ai bot');
      throw new RecallApiError('Failed to create meeting bot');
    }
  }

  /**
   * Get current bot status
   */
  async getBotStatus(botId: string): Promise<BotStatus> {
    logger.debug({ botId }, 'Getting Recall.ai bot status');

    try {
      const response = await fetch(`${this.baseUrl}/bot/${botId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new BadRequestError('Bot not found');
        }
        const errorText = await response.text();
        throw new RecallApiError(`Failed to get bot status: ${errorText}`);
      }

      const data = (await response.json()) as {
        id: string;
        status: string;
        meeting_url: string;
        joined_at?: string;
        left_at?: string;
        error_message?: string;
        recording?: boolean;
      };

      return {
        id: data.id,
        status: this.mapRecallStatus(data.status),
        meetingUrl: data.meeting_url,
        joinedAt: data.joined_at ? new Date(data.joined_at) : undefined,
        leftAt: data.left_at ? new Date(data.left_at) : undefined,
        errorMessage: data.error_message,
        recordingAvailable: !!data.recording,
      };
    } catch (error) {
      if (error instanceof BadRequestError || error instanceof RecallApiError) {
        throw error;
      }
      logger.error({ error, botId }, 'Failed to get bot status');
      throw new RecallApiError('Failed to get bot status');
    }
  }

  /**
   * Stop a bot and have it leave the meeting
   */
  async stopBot(botId: string): Promise<void> {
    logger.info({ botId }, 'Stopping Recall.ai bot');

    try {
      const response = await fetch(`${this.baseUrl}/bot/${botId}/leave_call`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        throw new RecallApiError(`Failed to stop bot: ${errorText}`);
      }
    } catch (error) {
      if (error instanceof RecallApiError) {
        throw error;
      }
      logger.error({ error, botId }, 'Failed to stop bot');
      throw new RecallApiError('Failed to stop meeting bot');
    }
  }

  /**
   * Get recording URL for a completed bot session
   */
  async getRecording(botId: string): Promise<RecordingInfo | null> {
    logger.debug({ botId }, 'Getting Recall.ai recording');

    try {
      const response = await fetch(`${this.baseUrl}/bot/${botId}/recording`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorText = await response.text();
        throw new RecallApiError(`Failed to get recording: ${errorText}`);
      }

      const data = (await response.json()) as {
        url: string;
        duration_ms?: number;
        format?: string;
        expires_at?: string;
      };

      return {
        url: data.url,
        durationMs: data.duration_ms || 0,
        format: data.format || 'mp4',
        expiresAt: new Date(data.expires_at || Date.now() + 24 * 60 * 60 * 1000),
      };
    } catch (error) {
      if (error instanceof RecallApiError) {
        throw error;
      }
      logger.error({ error, botId }, 'Failed to get recording');
      return null;
    }
  }

  /**
   * Verify webhook signature from Recall.ai
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.warn('Recall.ai webhook secret not configured');
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Handle incoming webhook event from Recall.ai
   */
  async handleWebhookEvent(event: RecallWebhookEvent): Promise<void> {
    const { event: eventType, data } = event;
    const botId = data.bot_id;

    logger.info({ eventType, botId }, 'Processing Recall.ai webhook event');

    // Find meeting by botId
    const meeting = await meetingRepository.findByBotId(botId);
    if (!meeting) {
      logger.warn({ botId }, 'Meeting not found for bot');
      return;
    }

    switch (eventType) {
      case 'bot.join_call':
        await this.handleBotJoinCall(meeting.id, botId);
        break;

      case 'bot.leave_call':
        await this.handleBotLeaveCall(meeting.id, botId, data.reason);
        break;

      case 'bot.media_ready':
        await this.handleMediaReady(meeting.id, botId, data.recording_url);
        break;

      case 'bot.transcription':
        if (data.transcript) {
          await this.handleTranscriptChunk(meeting.id, data.transcript);
        }
        break;

      case 'bot.error':
        await this.handleBotError(meeting.id, botId, data.error_message);
        break;

      case 'bot.waiting_room':
        await this.handleWaitingRoom(meeting.id, botId);
        break;

      case 'bot.kicked':
        await this.handleBotKicked(meeting.id, botId);
        break;

      default:
        logger.warn({ eventType }, 'Unknown Recall.ai webhook event');
    }
  }

  /**
   * Handle bot.join_call event - bot has joined the meeting
   */
  private async handleBotJoinCall(meetingId: string, botId: string): Promise<void> {
    logger.info({ meetingId, botId }, 'Bot joined call');

    await meetingRepository.update(meetingId, {
      status: 'recording',
      startTime: new Date(),
    });

    // Emit WebSocket event (will be implemented in WebSocket service)
    this.emitBotStatusChange(meetingId, 'recording');
  }

  /**
   * Handle bot.leave_call event - bot has left the meeting
   */
  private async handleBotLeaveCall(meetingId: string, botId: string, reason?: string): Promise<void> {
    logger.info({ meetingId, botId, reason }, 'Bot left call');

    const status = reason === 'kicked_by_host' ? 'failed' : 'processing';

    await meetingRepository.update(meetingId, {
      status,
      endTime: new Date(),
    });

    this.emitBotStatusChange(meetingId, status);
  }

  /**
   * Handle bot.media_ready event - recording is available
   */
  private async handleMediaReady(meetingId: string, botId: string, recordingUrl?: string): Promise<void> {
    logger.info({ meetingId, botId }, 'Media ready');

    if (recordingUrl) {
      await meetingRepository.update(meetingId, {
        recordingUrl,
      });

      // Queue transcription job
      await addTranscriptionJob({
        meetingId,
        audioUrl: recordingUrl,
      });
    }

    this.emitBotStatusChange(meetingId, 'processing');
  }

  /**
   * Handle real-time transcript chunks
   */
  private async handleTranscriptChunk(meetingId: string, chunks: TranscriptChunk[]): Promise<void> {
    // Emit to WebSocket for real-time display
    this.emitTranscriptChunks(meetingId, chunks);
  }

  /**
   * Handle bot error
   */
  private async handleBotError(meetingId: string, botId: string, errorMessage?: string): Promise<void> {
    logger.error({ meetingId, botId, errorMessage }, 'Bot error');

    await meetingRepository.update(meetingId, {
      status: 'failed',
      metadata: {
        error: errorMessage || 'Unknown bot error',
        errorAt: new Date().toISOString(),
      },
    });

    this.emitBotStatusChange(meetingId, 'failed');
  }

  /**
   * Handle bot waiting room
   */
  private async handleWaitingRoom(meetingId: string, botId: string): Promise<void> {
    logger.info({ meetingId, botId }, 'Bot in waiting room');
    this.emitBotStatusChange(meetingId, 'waiting');
  }

  /**
   * Handle bot kicked
   */
  private async handleBotKicked(meetingId: string, botId: string): Promise<void> {
    logger.warn({ meetingId, botId }, 'Bot was kicked from meeting');

    await meetingRepository.update(meetingId, {
      status: 'failed',
      metadata: {
        error: 'Bot was removed by host',
        kickedAt: new Date().toISOString(),
      },
    });

    this.emitBotStatusChange(meetingId, 'kicked');
  }

  /**
   * Map Recall.ai status to our status
   */
  private mapRecallStatus(status: string): BotStatus['status'] {
    const statusMap: Record<string, BotStatus['status']> = {
      ready: 'ready',
      joining: 'joining',
      in_waiting_room: 'joining',
      in_call_not_recording: 'in_call',
      in_call_recording: 'in_call',
      call_ended: 'ended',
      done: 'ended',
      error: 'error',
      fatal: 'error',
    };

    return statusMap[status] || 'ready';
  }

  /**
   * Emit bot status change to WebSocket
   */
  private emitBotStatusChange(meetingId: string, status: string): void {
    emitBotStatus({
      meetingId,
      botId: '', // Will be set by the webhook handler
      status: status as 'ready' | 'joining' | 'in_call' | 'recording' | 'leaving' | 'ended' | 'error' | 'waiting' | 'kicked',
      timestamp: new Date().toISOString(),
    });
    logger.debug({ meetingId, status }, 'Bot status change event emitted');
  }

  /**
   * Emit transcript chunks to WebSocket
   */
  private emitTranscriptChunks(meetingId: string, chunks: TranscriptChunk[]): void {
    emitTranscriptChunk({
      meetingId,
      chunks: chunks.map((c) => ({
        speaker: c.speaker,
        text: c.text,
        startMs: c.start_ms,
        endMs: c.end_ms,
        confidence: c.confidence,
      })),
      timestamp: new Date().toISOString(),
    });
    logger.debug({ meetingId, chunkCount: chunks.length }, 'Transcript chunks event emitted');
  }
}

// Export singleton instance
export const recallService = new RecallService();
