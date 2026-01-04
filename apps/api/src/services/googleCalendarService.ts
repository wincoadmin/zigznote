/**
 * @ownership
 * @domain Calendar Integration
 * @description Google Calendar OAuth and sync operations
 * @single-responsibility YES — Google Calendar API interactions
 * @last-reviewed 2026-01-04
 */

import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { calendarRepository, meetingRepository } from '@zigznote/database';
import type { CalendarConnection } from '@zigznote/database';
import { config } from '../config';
import { logger } from '../utils/logger';
import { encrypt, decrypt } from '../utils/encryption';

/**
 * Calendar event from Google
 */
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendees: Array<{
    email: string;
    displayName?: string;
    organizer?: boolean;
    responseStatus?: string;
  }>;
  meetingLink?: string;
  platform?: string;
  hangoutLink?: string;
}

/**
 * Meeting link extracted from event
 */
export interface MeetingLink {
  url: string;
  platform: 'zoom' | 'meet' | 'teams' | 'webex' | 'other';
  password?: string;
}

/**
 * Sync result
 */
export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: number;
}

/**
 * Service for Google Calendar operations
 */
export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
  }

  /**
   * Gets OAuth authorization URL
   * @param userId - User ID for state verification
   * @param redirectUri - Optional custom redirect URI
   */
  getAuthUrl(userId: string, redirectUri?: string): string {
    const client = redirectUri
      ? new google.auth.OAuth2(
          config.google.clientId,
          config.google.clientSecret,
          redirectUri
        )
      : this.oauth2Client;

    return client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events.readonly',
      ],
      state: userId,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Handles OAuth callback and stores tokens
   * @param code - Authorization code from Google
   * @param userId - User ID
   */
  async handleCallback(code: string, userId: string): Promise<CalendarConnection> {
    const { tokens } = await this.oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }

    // Check if connection already exists
    const existing = await calendarRepository.findByUserAndProvider(userId, 'google');

    const tokenExpires = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Encrypt tokens before storage
    const encryptedAccessToken = encrypt(tokens.access_token, config.encryptionKey);
    const encryptedRefreshToken = tokens.refresh_token
      ? encrypt(tokens.refresh_token, config.encryptionKey)
      : null;

    if (existing) {
      // Update existing connection
      return calendarRepository.update(existing.id, {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken || existing.refreshToken || undefined,
        tokenExpires,
        syncEnabled: true,
      });
    }

    // Create new connection
    return calendarRepository.create({
      userId,
      provider: 'google',
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken || undefined,
      tokenExpires,
    });
  }

  /**
   * Refreshes access token for a connection
   * @param connectionId - Calendar connection ID
   */
  async refreshToken(connectionId: string): Promise<void> {
    const connection = await calendarRepository.findById(connectionId);

    if (!connection || !connection.refreshToken) {
      throw new Error('Connection not found or no refresh token');
    }

    const refreshToken = decrypt(connection.refreshToken, config.encryptionKey);

    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await this.oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    const encryptedAccessToken = encrypt(credentials.access_token, config.encryptionKey);
    const tokenExpires = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await calendarRepository.updateTokens(
      connectionId,
      encryptedAccessToken,
      credentials.refresh_token ? encrypt(credentials.refresh_token, config.encryptionKey) : null,
      tokenExpires
    );

    logger.info({ connectionId }, 'Refreshed Google OAuth token');
  }

  /**
   * Lists calendar events for a connection
   * @param connectionId - Calendar connection ID
   * @param timeMin - Start of time range
   * @param timeMax - End of time range
   */
  async listEvents(
    connectionId: string,
    timeMin: Date,
    timeMax: Date
  ): Promise<CalendarEvent[]> {
    const connection = await calendarRepository.findById(connectionId);

    if (!connection || !connection.accessToken) {
      throw new Error('Connection not found or no access token');
    }

    // Check if token needs refresh
    if (connection.tokenExpires && connection.tokenExpires < new Date()) {
      await this.refreshToken(connectionId);
      // Re-fetch connection with new token
      const refreshed = await calendarRepository.findById(connectionId);
      if (!refreshed?.accessToken) {
        throw new Error('Failed to refresh token');
      }
      connection.accessToken = refreshed.accessToken;
    }

    const accessToken = decrypt(connection.accessToken, config.encryptionKey);

    this.oauth2Client.setCredentials({
      access_token: accessToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const events: CalendarEvent[] = [];
    let pageToken: string | undefined;

    do {
      const response = await calendar.events.list({
        calendarId: connection.calendarId || 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
        pageToken,
      });

      for (const event of response.data.items || []) {
        // Skip all-day events
        if (!event.start?.dateTime || !event.end?.dateTime) {
          continue;
        }

        const meetingLink = this.extractMeetingLink(event);

        events.push({
          id: event.id || '',
          summary: event.summary || 'Untitled Event',
          description: event.description || undefined,
          start: new Date(event.start.dateTime),
          end: new Date(event.end.dateTime),
          attendees: (event.attendees || []).map((a) => ({
            email: a.email || '',
            displayName: a.displayName || undefined,
            organizer: a.organizer || false,
            responseStatus: a.responseStatus || undefined,
          })),
          meetingLink: meetingLink?.url,
          platform: meetingLink?.platform,
          hangoutLink: event.hangoutLink || undefined,
        });
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return events;
  }

  /**
   * Extracts meeting link from calendar event
   * @param event - Google Calendar event
   */
  extractMeetingLink(event: calendar_v3.Schema$Event): MeetingLink | null {
    // Check hangout/meet link first
    if (event.hangoutLink) {
      return {
        url: event.hangoutLink,
        platform: 'meet',
      };
    }

    // Check conference data
    if (event.conferenceData?.entryPoints) {
      for (const entry of event.conferenceData.entryPoints) {
        if (entry.entryPointType === 'video' && entry.uri) {
          const platform = this.detectPlatform(entry.uri);
          if (platform) {
            return {
              url: entry.uri,
              platform,
            };
          }
        }
      }
    }

    // Check description for meeting links
    const description = event.description || '';
    const linkMatch = this.extractLinkFromText(description);

    if (linkMatch) {
      return linkMatch;
    }

    // Check location field
    const location = event.location || '';
    return this.extractLinkFromText(location);
  }

  /**
   * Extracts meeting link from text
   */
  private extractLinkFromText(text: string): MeetingLink | null {
    // Zoom patterns
    const zoomMatch = text.match(
      /https?:\/\/[\w.-]*zoom\.us\/[jw]\/(\d+)(\?pwd=[\w-]+)?/i
    );
    if (zoomMatch) {
      const passwordMatch = text.match(/Password:\s*(\S+)/i) ||
        text.match(/Passcode:\s*(\S+)/i);
      return {
        url: zoomMatch[0],
        platform: 'zoom',
        password: passwordMatch?.[1],
      };
    }

    // Google Meet patterns
    const meetMatch = text.match(
      /https?:\/\/meet\.google\.com\/[\w-]+/i
    );
    if (meetMatch) {
      return {
        url: meetMatch[0],
        platform: 'meet',
      };
    }

    // Microsoft Teams patterns
    const teamsMatch = text.match(
      /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[\w%/-]+/i
    );
    if (teamsMatch) {
      return {
        url: teamsMatch[0],
        platform: 'teams',
      };
    }

    // Webex patterns
    const webexMatch = text.match(
      /https?:\/\/[\w.-]*webex\.com\/[\w./]+/i
    );
    if (webexMatch) {
      return {
        url: webexMatch[0],
        platform: 'webex',
      };
    }

    return null;
  }

  /**
   * Detects platform from URL
   */
  private detectPlatform(url: string): 'zoom' | 'meet' | 'teams' | 'webex' | 'other' | null {
    if (url.includes('zoom.us')) return 'zoom';
    if (url.includes('meet.google.com')) return 'meet';
    if (url.includes('teams.microsoft.com')) return 'teams';
    if (url.includes('webex.com')) return 'webex';
    return null;
  }

  /**
   * Syncs calendar events to meetings for a connection
   * @param connectionId - Calendar connection ID
   * @param organizationId - Organization ID for the meetings
   */
  async syncCalendar(connectionId: string, organizationId: string): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: 0,
    };

    try {
      // Get connection
      const connection = await calendarRepository.findById(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Sync events for next 14 days
      const timeMin = new Date();
      const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const events = await this.listEvents(connectionId, timeMin, timeMax);
      result.synced = events.length;

      for (const event of events) {
        try {
          // Skip events without meeting links
          if (!event.meetingLink) {
            continue;
          }

          // Check if meeting already exists
          const existing = await meetingRepository.findMany({
            calendarEventId: event.id,
          });

          if (existing.length > 0) {
            // Update existing meeting
            const existingMeeting = existing[0];
            if (existingMeeting) {
              await meetingRepository.update(existingMeeting.id, {
                title: event.summary,
                startTime: event.start,
                endTime: event.end,
                meetingUrl: event.meetingLink,
                platform: event.platform,
              });
              result.updated++;
            }
          } else {
            // Create new meeting
            await meetingRepository.create({
              organizationId,
              createdById: connection.userId,
              title: event.summary,
              platform: event.platform,
              meetingUrl: event.meetingLink,
              startTime: event.start,
              endTime: event.end,
              calendarEventId: event.id,
            });
            result.created++;
          }
        } catch (error) {
          logger.error({ error, eventId: event.id }, 'Failed to sync calendar event');
          result.errors++;
        }
      }

      // Update last synced
      await calendarRepository.updateLastSynced(connectionId);

      logger.info({ connectionId, result }, 'Calendar sync completed');
    } catch (error) {
      logger.error({ error, connectionId }, 'Calendar sync failed');
      throw error;
    }

    return result;
  }
}

// Export singleton instance
export const googleCalendarService = new GoogleCalendarService();
