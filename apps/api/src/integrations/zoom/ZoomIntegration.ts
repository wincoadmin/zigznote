/**
 * ZoomIntegration
 * OAuth-based Zoom integration for syncing meetings and user data
 */

import type { PrismaClient } from '@zigznote/database';
import { OAuthIntegration } from '../base/OAuthIntegration';
import {
  OAuthConfig,
  IntegrationResult,
  IntegrationCredentials,
  OAuthTokenResponse,
  MeetingSummaryPayload,
} from '../base/types';
import { config } from '../../config';

interface ZoomUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  type: number;
  pmi: number;
  timezone: string;
  dept: string;
  created_at: string;
  last_login_time: string;
  pic_url: string;
  account_id: string;
}

interface ZoomMeeting {
  uuid: string;
  id: number;
  host_id: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  join_url: string;
  agenda?: string;
}

interface ZoomMeetingsResponse {
  page_count: number;
  page_number: number;
  page_size: number;
  total_records: number;
  meetings: ZoomMeeting[];
}

export class ZoomIntegration extends OAuthIntegration {
  protected oauthConfig: OAuthConfig = {
    clientId: config.zoom?.clientId || '',
    clientSecret: config.zoom?.clientSecret || '',
    redirectUri: config.zoom?.redirectUri || `${config.apiUrl}/api/v1/integrations/zoom/callback`,
    scopes: [
      'user:read',
      'meeting:read',
    ],
    authorizationUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
  };

  private readonly apiBase = 'https://api.zoom.us/v2';

  constructor(prisma: PrismaClient) {
    super(prisma, 'zoom');
  }

  /**
   * Override token exchange for Zoom (uses Basic Auth)
   */
  async exchangeCodeForTokens(code: string): Promise<IntegrationResult<OAuthTokenResponse>> {
    try {
      const credentials = Buffer.from(
        `${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`
      ).toString('base64');

      const response = await fetch(this.oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.oauthConfig.redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.log('error', 'Zoom OAuth failed', { status: response.status, error: errorData });
        return {
          success: false,
          error: `Zoom OAuth failed: ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: this.parseTokenResponse(data),
      };
    } catch (error) {
      this.log('error', 'Zoom OAuth error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Override refresh token for Zoom (uses Basic Auth)
   */
  async refreshAccessToken(refreshToken: string): Promise<IntegrationResult<OAuthTokenResponse>> {
    try {
      const credentials = Buffer.from(
        `${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`
      ).toString('base64');

      const response = await fetch(this.oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.log('error', 'Zoom token refresh failed', { status: response.status, error: errorData });
        return {
          success: false,
          error: `Token refresh failed: ${response.status}`,
          requiresReconfiguration: response.status === 401 || response.status === 400,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: this.parseTokenResponse(data),
      };
    } catch (error) {
      this.log('error', 'Zoom token refresh error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(organizationId: string): Promise<IntegrationResult<ZoomUser>> {
    return this.authenticatedRequest<ZoomUser>(organizationId, `${this.apiBase}/users/me`);
  }

  /**
   * Save Zoom connection with user info
   */
  async saveZoomConnection(
    organizationId: string,
    tokenResponse: OAuthTokenResponse,
    user: ZoomUser
  ): Promise<IntegrationResult> {
    const credentials: IntegrationCredentials = {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      tokenExpires: tokenResponse.expiresIn
        ? new Date(Date.now() + tokenResponse.expiresIn * 1000)
        : undefined,
      userId: user.id,
      email: user.email,
      accountId: user.account_id,
    };

    const settings = {
      enabled: true,
      autoSync: false,
      userName: `${user.first_name} ${user.last_name}`,
    };

    await this.saveConnection(organizationId, credentials, settings);

    return { success: true };
  }

  /**
   * Get upcoming scheduled meetings
   */
  async getUpcomingMeetings(organizationId: string): Promise<IntegrationResult<ZoomMeeting[]>> {
    const result = await this.authenticatedRequest<ZoomMeetingsResponse>(
      organizationId,
      `${this.apiBase}/users/me/meetings?type=upcoming&page_size=50`
    );

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error,
        requiresReconfiguration: result.requiresReconfiguration,
      };
    }

    return {
      success: true,
      data: result.data.meetings,
    };
  }

  /**
   * Get scheduled meetings within a date range
   */
  async getScheduledMeetings(
    organizationId: string,
    from?: Date,
    to?: Date
  ): Promise<IntegrationResult<ZoomMeeting[]>> {
    let url = `${this.apiBase}/users/me/meetings?type=scheduled&page_size=100`;

    if (from) {
      url += `&from=${from.toISOString().split('T')[0]}`;
    }
    if (to) {
      url += `&to=${to.toISOString().split('T')[0]}`;
    }

    const result = await this.authenticatedRequest<ZoomMeetingsResponse>(organizationId, url);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error,
        requiresReconfiguration: result.requiresReconfiguration,
      };
    }

    return {
      success: true,
      data: result.data.meetings,
    };
  }

  /**
   * Get meeting details by ID
   */
  async getMeetingDetails(
    organizationId: string,
    meetingId: string | number
  ): Promise<IntegrationResult<ZoomMeeting>> {
    return this.authenticatedRequest<ZoomMeeting>(
      organizationId,
      `${this.apiBase}/meetings/${meetingId}`
    );
  }

  /**
   * Test connection by fetching user info
   */
  async testConnection(organizationId: string): Promise<IntegrationResult> {
    const result = await this.getCurrentUser(organizationId);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        requiresReconfiguration: result.requiresReconfiguration,
      };
    }

    return {
      success: true,
      data: {
        email: result.data?.email,
        name: `${result.data?.first_name} ${result.data?.last_name}`,
      },
    };
  }

  /**
   * Send meeting summary - Zoom doesn't support pushing summaries
   * This is here to satisfy the abstract interface
   */
  async sendMeetingSummary(
    _organizationId: string,
    _payload: MeetingSummaryPayload,
    _options?: Record<string, unknown>
  ): Promise<IntegrationResult> {
    return {
      success: false,
      error: 'Zoom integration does not support pushing meeting summaries',
    };
  }
}
