/**
 * OAuthIntegration Tests
 */

import { OAuthIntegration } from './OAuthIntegration';
import { OAuthConfig, IntegrationResult, MeetingSummaryPayload } from './types';

// Create a concrete implementation for testing
class TestOAuthIntegration extends OAuthIntegration {
  protected oauthConfig: OAuthConfig = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    redirectUri: 'https://api.example.com/callback',
    scopes: ['read', 'write'],
    authorizationUrl: 'https://auth.example.com/authorize',
    tokenUrl: 'https://auth.example.com/token',
  };

  async sendMeetingSummary(
    _organizationId: string,
    _payload: MeetingSummaryPayload
  ): Promise<IntegrationResult> {
    return { success: true };
  }

  async testConnection(_organizationId: string): Promise<IntegrationResult> {
    return { success: true };
  }
}

// Mock PrismaClient
const mockPrisma = {
  integrationConnection: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('OAuthIntegration', () => {
  let integration: TestOAuthIntegration;

  beforeEach(() => {
    jest.clearAllMocks();
    integration = new TestOAuthIntegration(mockPrisma as any, 'test_provider');
    global.fetch = jest.fn();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate correct authorization URL', () => {
      const state = 'test_state';
      const url = integration.getAuthorizationUrl(state);

      expect(url).toContain('https://auth.example.com/authorize');
      expect(url).toContain('client_id=test_client_id');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('scope=read+write');
      expect(url).toContain('state=test_state');
      expect(url).toContain('response_type=code');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens successfully', async () => {
      const mockResponse = {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_123',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await integration.exchangeCodeForTokens('auth_code_123');

      expect(result.success).toBe(true);
      expect(result.data?.accessToken).toBe('access_token_123');
      expect(result.data?.refreshToken).toBe('refresh_token_123');
      expect(result.data?.expiresIn).toBe(3600);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('should handle token exchange failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      });

      const result = await integration.exchangeCodeForTokens('invalid_code');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Token exchange failed');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await integration.exchangeCodeForTokens('auth_code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue({
        id: 'conn_123',
        credentials: { refreshToken: 'refresh_token_123' },
      });

      const mockResponse = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      mockPrisma.integrationConnection.update.mockResolvedValue({});

      const result = await integration.refreshAccessToken('org_123');

      expect(result.success).toBe(true);
      expect(result.data).toBe('new_access_token');
    });

    it('should return error if no connection exists', async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);

      const result = await integration.refreshAccessToken('org_123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No connection found');
    });

    it('should return error if no refresh token', async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue({
        id: 'conn_123',
        credentials: {},
      });

      const result = await integration.refreshAccessToken('org_123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No refresh token');
    });
  });

  describe('getValidAccessToken', () => {
    it('should return valid token if not expired', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);

      mockPrisma.integrationConnection.findFirst.mockResolvedValue({
        id: 'conn_123',
        credentials: {
          accessToken: 'valid_access_token',
          tokenExpires: futureDate.toISOString(),
        },
      });

      const result = await integration.getValidAccessToken('org_123');

      expect(result.success).toBe(true);
      expect(result.data).toBe('valid_access_token');
    });

    it('should refresh token if expired', async () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);

      mockPrisma.integrationConnection.findFirst.mockResolvedValue({
        id: 'conn_123',
        credentials: {
          accessToken: 'expired_access_token',
          tokenExpires: pastDate.toISOString(),
          refreshToken: 'refresh_token_123',
        },
      });

      const mockResponse = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      mockPrisma.integrationConnection.update.mockResolvedValue({});

      const result = await integration.getValidAccessToken('org_123');

      expect(result.success).toBe(true);
      expect(result.data).toBe('new_access_token');
    });
  });

  describe('authenticatedRequest', () => {
    it('should make authenticated request with valid token', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);

      mockPrisma.integrationConnection.findFirst.mockResolvedValue({
        id: 'conn_123',
        credentials: {
          accessToken: 'valid_token',
          tokenExpires: futureDate.toISOString(),
        },
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'success' }),
      });

      const result = await integration.authenticatedRequest<{ data: string }>(
        'org_123',
        'https://api.example.com/resource'
      );

      expect(result.success).toBe(true);
      expect(result.data?.data).toBe('success');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/resource',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer valid_token',
          }),
        })
      );
    });

    it('should retry with refreshed token on 401', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);

      mockPrisma.integrationConnection.findFirst.mockResolvedValue({
        id: 'conn_123',
        credentials: {
          accessToken: 'expired_token',
          tokenExpires: futureDate.toISOString(),
          refreshToken: 'refresh_token',
        },
      });

      // First call returns 401
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'unauthorized' }),
        })
        // Token refresh
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new_token',
              refresh_token: 'new_refresh',
              expires_in: 3600,
            }),
        })
        // Retry request
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: 'success' }),
        });

      mockPrisma.integrationConnection.update.mockResolvedValue({});

      const result = await integration.authenticatedRequest<{ data: string }>(
        'org_123',
        'https://api.example.com/resource'
      );

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('getConnection', () => {
    it('should return connection details', async () => {
      const connectionData = {
        id: 'conn_123',
        organizationId: 'org_123',
        provider: 'test_provider',
        status: 'connected',
        credentials: {
          accessToken: 'token',
          refreshToken: 'refresh',
        },
        settings: { enabled: true },
        connectedAt: new Date(),
      };

      mockPrisma.integrationConnection.findFirst.mockResolvedValue(connectionData);

      const result = await integration.getConnection('org_123');

      expect(result?.status).toBe('connected');
      expect(result?.credentials.accessToken).toBe('token');
    });

    it('should return null if no connection', async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);

      const result = await integration.getConnection('org_123');

      expect(result).toBeNull();
    });
  });

  describe('isConnected', () => {
    it('should return true if connected', async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue({
        status: 'connected',
      });

      const result = await integration.isConnected('org_123');

      expect(result).toBe(true);
    });

    it('should return false if not connected', async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);

      const result = await integration.isConnected('org_123');

      expect(result).toBe(false);
    });
  });

  describe('saveConnection', () => {
    it('should save or update connection', async () => {
      const credentials = {
        accessToken: 'token',
        refreshToken: 'refresh',
        tokenExpires: new Date(),
      };

      const settings = { enabled: true };

      mockPrisma.integrationConnection.upsert.mockResolvedValue({});

      await integration.saveConnection('org_123', credentials, settings);

      expect(mockPrisma.integrationConnection.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId_provider: {
              organizationId: 'org_123',
              provider: 'test_provider',
            },
          },
        })
      );
    });
  });

  describe('updateSettings', () => {
    it('should update connection settings', async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue({
        id: 'conn_123',
        settings: { enabled: true },
      });

      mockPrisma.integrationConnection.update.mockResolvedValue({
        settings: { enabled: false, newSetting: true },
      });

      const result = await integration.updateSettings('org_123', {
        enabled: false,
        newSetting: true,
      });

      expect(result?.settings.enabled).toBe(false);
      expect(result?.settings.newSetting).toBe(true);
    });

    it('should return null if no connection', async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);

      const result = await integration.updateSettings('org_123', {});

      expect(result).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should delete connection', async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue({
        id: 'conn_123',
      });

      mockPrisma.integrationConnection.delete.mockResolvedValue({});

      const result = await integration.disconnect('org_123');

      expect(result).toBe(true);
      expect(mockPrisma.integrationConnection.delete).toHaveBeenCalledWith({
        where: { id: 'conn_123' },
      });
    });

    it('should return false if no connection', async () => {
      mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);

      const result = await integration.disconnect('org_123');

      expect(result).toBe(false);
    });
  });
});
