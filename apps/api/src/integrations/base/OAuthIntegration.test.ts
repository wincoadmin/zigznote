/**
 * OAuthIntegration Tests
 */

// Mock encryption module before imports
jest.mock('../../utils/encryption', () => ({
  encrypt: jest.fn((value: string) => `encrypted_${value}`),
  decrypt: jest.fn((value: string) => value.replace('encrypted_', '')),
}));

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
    findUnique: jest.fn(),
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
        status: 400,
        text: () => Promise.resolve('invalid_grant'),
      });

      const result = await integration.exchangeCodeForTokens('invalid_code');

      expect(result.success).toBe(false);
      expect(result.error).toContain('OAuth token exchange failed');
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
      const mockResponse = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await integration.refreshAccessToken('refresh_token_123');

      expect(result.success).toBe(true);
      expect(result.data?.accessToken).toBe('new_access_token');
      expect(result.data?.refreshToken).toBe('new_refresh_token');
      expect(result.data?.expiresIn).toBe(3600);
    });

    it('should return error on refresh failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('invalid_token'),
      });

      const result = await integration.refreshAccessToken('expired_refresh_token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Token refresh failed');
      expect(result.requiresReconfiguration).toBe(true);
    });

    it('should handle network errors during refresh', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await integration.refreshAccessToken('refresh_token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('getValidAccessToken', () => {
    it('should return valid token if not expired', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);

      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        id: 'conn_123',
        organizationId: 'org_123',
        provider: 'test_provider',
        credentials: {
          accessToken: 'valid_access_token',
          tokenExpires: futureDate.toISOString(),
        },
        settings: {},
        connectedAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await integration.getValidAccessToken('org_123');

      expect(result.success).toBe(true);
      expect(result.data).toBe('valid_access_token');
    });

    it('should refresh token if expired', async () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);

      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        id: 'conn_123',
        organizationId: 'org_123',
        provider: 'test_provider',
        credentials: {
          accessToken: 'expired_access_token',
          tokenExpires: pastDate.toISOString(),
          refreshToken: 'refresh_token_123',
        },
        settings: {},
        connectedAt: new Date(),
        updatedAt: new Date(),
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

      mockPrisma.integrationConnection.upsert.mockResolvedValue({
        id: 'conn_123',
        organizationId: 'org_123',
        provider: 'test_provider',
        credentials: {},
        settings: {},
        connectedAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await integration.getValidAccessToken('org_123');

      expect(result.success).toBe(true);
      expect(result.data).toBe('new_access_token');
    });

    it('should return error if no connection exists', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue(null);

      const result = await integration.getValidAccessToken('org_123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not connected');
    });

    it('should return error if no access token', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        id: 'conn_123',
        organizationId: 'org_123',
        provider: 'test_provider',
        credentials: {},
        settings: {},
        connectedAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await integration.getValidAccessToken('org_123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No access token');
    });
  });

  describe('authenticatedRequest', () => {
    it('should make authenticated request with valid token', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);

      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        id: 'conn_123',
        organizationId: 'org_123',
        provider: 'test_provider',
        credentials: {
          accessToken: 'valid_token',
          tokenExpires: futureDate.toISOString(),
        },
        settings: {},
        connectedAt: new Date(),
        updatedAt: new Date(),
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'success' }),
      });

      const result = await (integration as any).authenticatedRequest<{ data: string }>(
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

    it('should return error on 401 response', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);

      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        id: 'conn_123',
        organizationId: 'org_123',
        provider: 'test_provider',
        credentials: {
          accessToken: 'expired_token',
          tokenExpires: futureDate.toISOString(),
          refreshToken: 'refresh_token',
        },
        settings: {},
        connectedAt: new Date(),
        updatedAt: new Date(),
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('unauthorized'),
      });

      const result = await (integration as any).authenticatedRequest<{ data: string }>(
        'org_123',
        'https://api.example.com/resource'
      );

      expect(result.success).toBe(false);
      expect(result.requiresReconfiguration).toBe(true);
    });
  });

  describe('getConnection', () => {
    it('should return connection details', async () => {
      const connectionData = {
        id: 'conn_123',
        organizationId: 'org_123',
        provider: 'test_provider',
        credentials: {
          accessToken: 'token',
          refreshToken: 'refresh',
        },
        settings: { enabled: true },
        connectedAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.integrationConnection.findUnique.mockResolvedValue(connectionData);

      const result = await integration.getConnection('org_123');

      expect(result?.status).toBe('connected');
      expect(result?.credentials.accessToken).toBe('token');
    });

    it('should return null if no connection', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue(null);

      const result = await integration.getConnection('org_123');

      expect(result).toBeNull();
    });
  });

  describe('isConnected', () => {
    it('should return true if connected', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        id: 'conn_123',
        organizationId: 'org_123',
        provider: 'test_provider',
        credentials: { accessToken: 'token' },
        settings: {},
        connectedAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await integration.isConnected('org_123');

      expect(result).toBe(true);
    });

    it('should return false if not connected', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue(null);

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

      mockPrisma.integrationConnection.upsert.mockResolvedValue({
        id: 'conn_123',
        organizationId: 'org_123',
        provider: 'test_provider',
        credentials: {},
        settings,
        connectedAt: new Date(),
        updatedAt: new Date(),
      });

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
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        id: 'conn_123',
        organizationId: 'org_123',
        provider: 'test_provider',
        credentials: { accessToken: 'token' },
        settings: { enabled: true },
        connectedAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.integrationConnection.update.mockResolvedValue({
        id: 'conn_123',
        organizationId: 'org_123',
        provider: 'test_provider',
        credentials: { accessToken: 'token' },
        settings: { enabled: false, newSetting: true },
        connectedAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await integration.updateSettings('org_123', {
        enabled: false,
        newSetting: true,
      });

      expect(result?.settings.enabled).toBe(false);
      expect(result?.settings.newSetting).toBe(true);
    });

    it('should return null if no connection', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue(null);

      const result = await integration.updateSettings('org_123', {});

      expect(result).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should delete connection', async () => {
      mockPrisma.integrationConnection.delete.mockResolvedValue({});

      const result = await integration.disconnect('org_123');

      expect(result).toBe(true);
      expect(mockPrisma.integrationConnection.delete).toHaveBeenCalledWith({
        where: {
          organizationId_provider: {
            organizationId: 'org_123',
            provider: 'test_provider',
          },
        },
      });
    });

    it('should return false if delete fails', async () => {
      mockPrisma.integrationConnection.delete.mockRejectedValue(new Error('Not found'));

      const result = await integration.disconnect('org_123');

      expect(result).toBe(false);
    });
  });
});
