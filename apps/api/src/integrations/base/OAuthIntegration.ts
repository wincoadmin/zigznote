/**
 * OAuthIntegration Abstract Class
 * Base class for OAuth-based integrations
 */

import type { PrismaClient } from '@zigznote/database';
import { BaseIntegration } from './BaseIntegration';
import {
  IntegrationProvider,
  IntegrationCredentials,
  OAuthConfig,
  OAuthTokenResponse,
  IntegrationResult,
} from './types';

export abstract class OAuthIntegration extends BaseIntegration {
  protected abstract oauthConfig: OAuthConfig;

  constructor(prisma: PrismaClient, provider: IntegrationProvider) {
    super(prisma, provider);
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      redirect_uri: this.oauthConfig.redirectUri,
      scope: this.oauthConfig.scopes.join(' '),
      response_type: 'code',
      state,
    });

    return `${this.oauthConfig.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<IntegrationResult<OAuthTokenResponse>> {
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
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.log('error', 'Failed to exchange code for tokens', {
          status: response.status,
          error: errorData,
        });
        return {
          success: false,
          error: `OAuth token exchange failed: ${response.status}`,
        };
      }

      const data = await response.json() as Record<string, unknown>;

      return {
        success: true,
        data: this.parseTokenResponse(data),
      };
    } catch (error) {
      this.log('error', 'OAuth token exchange error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<IntegrationResult<OAuthTokenResponse>> {
    try {
      const response = await fetch(this.oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.oauthConfig.clientId,
          client_secret: this.oauthConfig.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.log('error', 'Failed to refresh token', {
          status: response.status,
          error: errorData,
        });
        return {
          success: false,
          error: `Token refresh failed: ${response.status}`,
          requiresReconfiguration: response.status === 401 || response.status === 400,
        };
      }

      const data = await response.json() as Record<string, unknown>;

      return {
        success: true,
        data: this.parseTokenResponse(data),
      };
    } catch (error) {
      this.log('error', 'Token refresh error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(organizationId: string): Promise<IntegrationResult<string>> {
    const connection = await this.getConnection(organizationId);

    if (!connection) {
      return {
        success: false,
        error: 'Integration not connected',
        requiresReconfiguration: true,
      };
    }

    const { accessToken, refreshToken, tokenExpires } = connection.credentials;

    if (!accessToken) {
      return {
        success: false,
        error: 'No access token available',
        requiresReconfiguration: true,
      };
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const isExpiringSoon =
      tokenExpires &&
      (tokenExpires instanceof Date ? tokenExpires : new Date(tokenExpires as string)).getTime() -
        Date.now() <
        5 * 60 * 1000;

    if (isExpiringSoon && refreshToken) {
      const refreshResult = await this.refreshAccessToken(refreshToken);

      if (refreshResult.success && refreshResult.data) {
        // Save new tokens
        const newCredentials: IntegrationCredentials = {
          accessToken: refreshResult.data.accessToken,
          refreshToken: refreshResult.data.refreshToken || refreshToken,
          tokenExpires: refreshResult.data.expiresIn
            ? new Date(Date.now() + refreshResult.data.expiresIn * 1000)
            : undefined,
        };

        await this.saveConnection(organizationId, newCredentials, connection.settings);

        return {
          success: true,
          data: refreshResult.data.accessToken,
        };
      }

      // Refresh failed
      return {
        success: false,
        error: refreshResult.error || 'Token refresh failed',
        requiresReconfiguration: refreshResult.requiresReconfiguration,
      };
    }

    return {
      success: true,
      data: accessToken,
    };
  }

  /**
   * Parse token response from OAuth provider
   * Override in subclasses if response format differs
   */
  protected parseTokenResponse(data: Record<string, unknown>): OAuthTokenResponse {
    return {
      accessToken: (data.access_token as string) || (data.accessToken as string),
      refreshToken: (data.refresh_token as string) || (data.refreshToken as string),
      expiresIn: (data.expires_in as number) || (data.expiresIn as number),
      tokenType: (data.token_type as string) || (data.tokenType as string),
      scope: (data.scope as string) || undefined,
    };
  }

  /**
   * Make authenticated API request with automatic token refresh
   */
  protected async authenticatedRequest<T>(
    organizationId: string,
    url: string,
    options: RequestInit = {}
  ): Promise<IntegrationResult<T>> {
    const tokenResult = await this.getValidAccessToken(organizationId);

    if (!tokenResult.success || !tokenResult.data) {
      return {
        success: false,
        error: tokenResult.error,
        requiresReconfiguration: tokenResult.requiresReconfiguration,
      };
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${tokenResult.data}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.text();

        // Handle specific error cases
        if (response.status === 401) {
          return {
            success: false,
            error: 'Authentication failed',
            requiresReconfiguration: true,
          };
        }

        return {
          success: false,
          error: `API request failed: ${response.status} - ${errorData}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      this.log('error', 'API request error', { url, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
