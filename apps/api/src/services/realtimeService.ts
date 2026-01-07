/**
 * @ownership
 * @domain Team Collaboration
 * @description Service for real-time updates using Redis pub/sub
 * @single-responsibility YES - handles all real-time messaging operations
 * @last-reviewed 2026-01-07
 */

import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Real-time event types
 */
export type RealtimeEventType =
  | 'comment:created'
  | 'comment:updated'
  | 'comment:deleted'
  | 'comment:resolved'
  | 'comment:unresolved'
  | 'comment:reaction'
  | 'annotation:created'
  | 'annotation:updated'
  | 'annotation:deleted'
  | 'notification:new'
  | 'notification:all-read'
  | 'meeting:updated'
  | 'share:created'
  | 'share:revoked'
  | 'user:typing';

/**
 * Real-time message structure
 */
export interface RealtimeMessage {
  event: RealtimeEventType;
  channel: string;
  data: unknown;
  timestamp: number;
}

/**
 * Channel types for real-time updates
 */
const CHANNEL_PREFIXES = {
  MEETING: 'meeting:',
  USER: 'user:',
  ORGANIZATION: 'org:',
} as const;

/**
 * Service for real-time pub/sub messaging
 */
export class RealtimeService {
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private messageHandlers: Map<string, Set<(message: RealtimeMessage) => void>> = new Map();
  private isInitialized = false;

  /**
   * Initialize Redis connections
   */
  initialize(): void {
    if (this.isInitialized) return;

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.publisher = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.subscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.subscriber.on('message', (channel: string, message: string) => {
        try {
          const parsed = JSON.parse(message) as RealtimeMessage;
          this.handleMessage(channel, parsed);
        } catch (error) {
          logger.error({ channel, error }, 'Failed to parse real-time message');
        }
      });

      this.subscriber.on('error', (error: Error) => {
        logger.error({ error }, 'Redis subscriber error');
      });

      this.publisher.on('error', (error: Error) => {
        logger.error({ error }, 'Redis publisher error');
      });

      this.isInitialized = true;
      logger.info('Real-time service initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize real-time service');
    }
  }

  /**
   * Connect to Redis (lazy connection)
   */
  async connect(): Promise<void> {
    if (!this.isInitialized) {
      this.initialize();
    }

    if (this.publisher && this.subscriber) {
      try {
        await Promise.all([
          this.publisher.connect(),
          this.subscriber.connect(),
        ]);
        logger.info('Real-time service connected to Redis');
      } catch (error) {
        // May already be connected
        logger.debug({ error }, 'Redis connection attempt');
      }
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.publisher) {
      await this.publisher.quit();
    }
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    this.isInitialized = false;
    logger.info('Real-time service disconnected');
  }

  /**
   * Publish a message to a channel
   */
  private async publish(channel: string, message: RealtimeMessage): Promise<void> {
    if (!this.publisher) {
      logger.debug({ channel }, 'Publisher not initialized, skipping message');
      return;
    }

    try {
      await this.publisher.publish(channel, JSON.stringify(message));
      logger.debug({ channel, event: message.event }, 'Published real-time message');
    } catch (error) {
      logger.error({ channel, error }, 'Failed to publish real-time message');
    }
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channel: string, handler: (message: RealtimeMessage) => void): Promise<void> {
    if (!this.subscriber) {
      logger.debug({ channel }, 'Subscriber not initialized');
      return;
    }

    if (!this.messageHandlers.has(channel)) {
      this.messageHandlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
      logger.debug({ channel }, 'Subscribed to channel');
    }

    this.messageHandlers.get(channel)!.add(handler);
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel: string, handler?: (message: RealtimeMessage) => void): Promise<void> {
    if (!this.subscriber) return;

    const handlers = this.messageHandlers.get(channel);
    if (!handlers) return;

    if (handler) {
      handlers.delete(handler);
    } else {
      handlers.clear();
    }

    if (handlers.size === 0) {
      this.messageHandlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
      logger.debug({ channel }, 'Unsubscribed from channel');
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(channel: string, message: RealtimeMessage): void {
    const handlers = this.messageHandlers.get(channel);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message);
        } catch (error) {
          logger.error({ channel, error }, 'Error in message handler');
        }
      }
    }
  }

  /**
   * Broadcast to all users viewing a meeting
   */
  broadcastToMeeting(meetingId: string, event: RealtimeEventType, data: unknown): void {
    const channel = `${CHANNEL_PREFIXES.MEETING}${meetingId}`;
    const message: RealtimeMessage = {
      event,
      channel,
      data,
      timestamp: Date.now(),
    };
    this.publish(channel, message);
  }

  /**
   * Send to a specific user
   */
  sendToUser(userId: string, event: RealtimeEventType, data: unknown): void {
    const channel = `${CHANNEL_PREFIXES.USER}${userId}`;
    const message: RealtimeMessage = {
      event,
      channel,
      data,
      timestamp: Date.now(),
    };
    this.publish(channel, message);
  }

  /**
   * Broadcast to all users in an organization
   */
  broadcastToOrganization(organizationId: string, event: RealtimeEventType, data: unknown): void {
    const channel = `${CHANNEL_PREFIXES.ORGANIZATION}${organizationId}`;
    const message: RealtimeMessage = {
      event,
      channel,
      data,
      timestamp: Date.now(),
    };
    this.publish(channel, message);
  }

  /**
   * Get channel name for a meeting
   */
  getMeetingChannel(meetingId: string): string {
    return `${CHANNEL_PREFIXES.MEETING}${meetingId}`;
  }

  /**
   * Get channel name for a user
   */
  getUserChannel(userId: string): string {
    return `${CHANNEL_PREFIXES.USER}${userId}`;
  }

  /**
   * Get channel name for an organization
   */
  getOrganizationChannel(organizationId: string): string {
    return `${CHANNEL_PREFIXES.ORGANIZATION}${organizationId}`;
  }

  /**
   * Broadcast typing indicator
   */
  broadcastTyping(
    meetingId: string,
    userId: string,
    userName: string,
    isTyping: boolean
  ): void {
    this.broadcastToMeeting(meetingId, 'user:typing', {
      userId,
      userName,
      isTyping,
    });
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();

// Auto-initialize on import (but don't connect)
realtimeService.initialize();
