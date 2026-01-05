/**
 * SlackIntegration
 * OAuth-based Slack integration for posting meeting summaries
 */

import type { PrismaClient } from '@zigznote/database';
import { OAuthIntegration } from '../base/OAuthIntegration';
import {
  OAuthConfig,
  IntegrationResult,
  MeetingSummaryPayload,
  IntegrationCredentials,
} from '../base/types';
import { config } from '../../config';

interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface SlackTeam {
  id: string;
  name: string;
}

interface SlackAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: SlackTeam;
  authed_user: { id: string };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
}

export class SlackIntegration extends OAuthIntegration {
  protected oauthConfig: OAuthConfig = {
    clientId: config.slack?.clientId || '',
    clientSecret: config.slack?.clientSecret || '',
    redirectUri: config.slack?.redirectUri || `${config.apiUrl}/api/v1/integrations/slack/callback`,
    scopes: [
      'channels:read',
      'chat:write',
      'chat:write.public',
      'groups:read',
      'team:read',
      'users:read',
    ],
    authorizationUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
  };

  private readonly apiBase = 'https://slack.com/api';

  constructor(prisma: PrismaClient) {
    super(prisma, 'slack');
  }

  /**
   * Override to get Slack-specific auth URL with bot scopes
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      redirect_uri: this.oauthConfig.redirectUri,
      scope: this.oauthConfig.scopes.join(','),
      state,
    });

    return `${this.oauthConfig.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Override token exchange for Slack-specific response
   */
  async exchangeCodeForTokens(
    code: string
  ): Promise<IntegrationResult<SlackAuthResponse & { accessToken: string }>> {
    try {
      const response = await fetch(this.oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.oauthConfig.clientId,
          client_secret: this.oauthConfig.clientSecret,
          code,
          redirect_uri: this.oauthConfig.redirectUri,
        }),
      });

      const data = (await response.json()) as SlackAuthResponse & { error?: string };

      if (!data.ok) {
        this.log('error', 'Slack OAuth failed', { error: data.error });
        return {
          success: false,
          error: data.error || 'Slack OAuth failed',
        };
      }

      return {
        success: true,
        data: {
          ...data,
          accessToken: data.access_token,
        },
      };
    } catch (error) {
      this.log('error', 'Slack OAuth error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Save Slack connection with team info
   */
  async saveSlackConnection(
    organizationId: string,
    authResponse: SlackAuthResponse
  ): Promise<IntegrationResult> {
    const credentials: IntegrationCredentials = {
      accessToken: authResponse.access_token,
      teamId: authResponse.team.id,
      teamName: authResponse.team.name,
      botUserId: authResponse.bot_user_id,
    };

    const settings = {
      enabled: true,
      autoSend: false,
      defaultChannel: authResponse.incoming_webhook?.channel_id,
    };

    await this.saveConnection(organizationId, credentials, settings);

    return { success: true };
  }

  /**
   * Get list of channels the bot can post to
   */
  async getChannels(organizationId: string): Promise<IntegrationResult<SlackChannel[]>> {
    const tokenResult = await this.getValidAccessToken(organizationId);

    if (!tokenResult.success || !tokenResult.data) {
      return {
        success: false,
        error: tokenResult.error,
        requiresReconfiguration: tokenResult.requiresReconfiguration,
      };
    }

    try {
      // Get public channels
      const publicResponse = await fetch(
        `${this.apiBase}/conversations.list?types=public_channel&exclude_archived=true&limit=200`,
        {
          headers: {
            Authorization: `Bearer ${tokenResult.data}`,
          },
        }
      );

      const publicData = (await publicResponse.json()) as {
        ok: boolean;
        channels?: Array<{ id: string; name: string; is_private: boolean }>;
        error?: string;
      };

      if (!publicData.ok) {
        this.log('error', 'Failed to fetch Slack channels', { error: publicData.error });
        return {
          success: false,
          error: publicData.error || 'Failed to fetch channels',
        };
      }

      // Get private channels the bot is a member of
      const privateResponse = await fetch(
        `${this.apiBase}/conversations.list?types=private_channel&exclude_archived=true&limit=200`,
        {
          headers: {
            Authorization: `Bearer ${tokenResult.data}`,
          },
        }
      );

      const privateData = (await privateResponse.json()) as {
        ok: boolean;
        channels?: Array<{ id: string; name: string; is_private: boolean }>;
      };

      const channels: SlackChannel[] = [
        ...(publicData.channels || []).map((c) => ({
          id: c.id,
          name: c.name,
          isPrivate: false,
        })),
        ...(privateData.channels || []).map((c) => ({
          id: c.id,
          name: c.name,
          isPrivate: true,
        })),
      ];

      return { success: true, data: channels };
    } catch (error) {
      this.log('error', 'Error fetching Slack channels', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send meeting summary to Slack channel
   */
  async sendMeetingSummary(
    organizationId: string,
    payload: MeetingSummaryPayload,
    options?: { channelId?: string }
  ): Promise<IntegrationResult> {
    const connection = await this.getConnection(organizationId);

    if (!connection) {
      return {
        success: false,
        error: 'Slack not connected',
        requiresReconfiguration: true,
      };
    }

    const channelId = options?.channelId || (connection.settings.defaultChannel as string);

    if (!channelId) {
      return {
        success: false,
        error: 'No channel specified',
      };
    }

    const tokenResult = await this.getValidAccessToken(organizationId);

    if (!tokenResult.success || !tokenResult.data) {
      return {
        success: false,
        error: tokenResult.error,
        requiresReconfiguration: tokenResult.requiresReconfiguration,
      };
    }

    const blocks = this.buildSummaryBlocks(payload);

    try {
      const response = await fetch(`${this.apiBase}/chat.postMessage`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenResult.data}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: channelId,
          text: `Meeting Summary: ${payload.title}`,
          blocks,
          unfurl_links: false,
          unfurl_media: false,
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        ts?: string;
        channel?: string;
        error?: string;
      };

      if (!data.ok) {
        this.log('error', 'Failed to post Slack message', { error: data.error, channelId });

        if (data.error === 'channel_not_found') {
          return {
            success: false,
            error: 'Channel not found',
            requiresReconfiguration: true,
          };
        }

        return {
          success: false,
          error: data.error || 'Failed to post message',
        };
      }

      this.log('info', 'Slack message posted', {
        organizationId,
        meetingId: payload.meetingId,
        channelId,
        ts: data.ts,
      });

      return { success: true, data: { ts: data.ts, channel: data.channel } };
    } catch (error) {
      this.log('error', 'Error posting Slack message', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test connection by fetching team info
   */
  async testConnection(organizationId: string): Promise<IntegrationResult> {
    const tokenResult = await this.getValidAccessToken(organizationId);

    if (!tokenResult.success || !tokenResult.data) {
      return {
        success: false,
        error: tokenResult.error,
        requiresReconfiguration: tokenResult.requiresReconfiguration,
      };
    }

    try {
      const response = await fetch(`${this.apiBase}/team.info`, {
        headers: {
          Authorization: `Bearer ${tokenResult.data}`,
        },
      });

      const data = (await response.json()) as {
        ok: boolean;
        team?: { id: string; name: string };
        error?: string;
      };

      if (!data.ok) {
        return {
          success: false,
          error: data.error || 'Connection test failed',
          requiresReconfiguration: data.error === 'token_revoked' || data.error === 'invalid_auth',
        };
      }

      return {
        success: true,
        data: { team: data.team },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build Block Kit blocks for meeting summary
   */
  private buildSummaryBlocks(payload: MeetingSummaryPayload): unknown[] {
    const blocks: unknown[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📝 ${payload.title}`,
          emoji: true,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📅 ${new Date(payload.startTime).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}`,
          },
          {
            type: 'mrkdwn',
            text: `⏱️ ${payload.duration ? Math.round(payload.duration / 60) : '?'} minutes`,
          },
          {
            type: 'mrkdwn',
            text: `👥 ${payload.participants.length} participants`,
          },
        ],
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary*\n${payload.summary.executiveSummary}`,
        },
      },
    ];

    // Add topics
    if (payload.summary.topics.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '*📋 Topics Discussed*\n' +
            payload.summary.topics.map((t) => `• *${t.title}*: ${t.summary}`).join('\n'),
        },
      });
    }

    // Add decisions
    if (payload.summary.decisions.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '*✅ Decisions Made*\n' + payload.summary.decisions.map((d) => `• ${d}`).join('\n'),
        },
      });
    }

    // Add action items
    if (payload.actionItems.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '*📌 Action Items*\n' +
            payload.actionItems
              .map((item) => {
                let text = `• ${item.text}`;
                if (item.assignee) text += ` (${item.assignee})`;
                if (item.dueDate) text += ` - Due: ${item.dueDate}`;
                return text;
              })
              .join('\n'),
        },
      });
    }

    // Add view full summary link
    if (payload.transcriptUrl) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Full Summary',
              emoji: true,
            },
            url: payload.transcriptUrl,
            action_id: 'view_summary',
          },
        ],
      });
    }

    return blocks;
  }
}
