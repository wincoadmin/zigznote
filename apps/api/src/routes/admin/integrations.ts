/**
 * Admin Integration Management API
 * Configure platform-level OAuth credentials
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zigznote/database';
import { encryptWithEnvKey, decryptWithEnvKey, isEncryptionConfigured } from '../../utils/encryption';
import { clearConfigCache, getAllIntegrationStatuses, type IntegrationProvider } from '../../services/integrationConfigService';
import { requireAdminAuth, requireSuperAdmin, type AdminAuthenticatedRequest } from '../../middleware/adminAuth';

const router = Router();

// All routes require admin auth
router.use(requireAdminAuth);

// Provider metadata for UI
const PROVIDER_METADATA: Record<string, {
  name: string;
  description: string;
  docsUrl: string;
  icon: string;
  requiredScopes: string[];
  additionalFields?: Array<{ key: string; label: string; required: boolean; default?: string }>;
}> = {
  slack: {
    name: 'Slack',
    description: 'Send meeting summaries to Slack channels',
    docsUrl: 'https://api.slack.com/apps',
    icon: 'slack',
    requiredScopes: ['channels:read', 'chat:write', 'users:read'],
  },
  zoom: {
    name: 'Zoom',
    description: 'Sync Zoom meetings and calendar',
    docsUrl: 'https://marketplace.zoom.us/develop/create',
    icon: 'zoom',
    requiredScopes: ['user:read', 'meeting:read'],
  },
  hubspot: {
    name: 'HubSpot',
    description: 'Log meetings to HubSpot CRM',
    docsUrl: 'https://developers.hubspot.com/docs/api/creating-an-app',
    icon: 'hubspot',
    requiredScopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write'],
  },
  salesforce: {
    name: 'Salesforce',
    description: 'Sync meeting data with Salesforce',
    docsUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_oauth_and_connected_apps.htm',
    icon: 'salesforce',
    requiredScopes: ['api', 'refresh_token'],
  },
  microsoft: {
    name: 'Microsoft Teams',
    description: 'Connect Microsoft 365 calendar and Teams',
    docsUrl: 'https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    icon: 'microsoft',
    requiredScopes: ['User.Read', 'Calendars.Read', 'OnlineMeetings.Read'],
    additionalFields: [{ key: 'tenantId', label: 'Tenant ID', required: false, default: 'common' }],
  },
  google: {
    name: 'Google Calendar',
    description: 'Sync Google Calendar events',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    icon: 'google',
    requiredScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  },
};

/**
 * GET /api/admin/integrations
 * List all integration configurations with status
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Check encryption is configured
    if (!isEncryptionConfigured()) {
      res.status(500).json({
        success: false,
        error: 'Encryption key not configured. Set ENCRYPTION_KEY environment variable.',
      });
      return;
    }

    // Get all statuses
    const statuses = await getAllIntegrationStatuses();

    // Get DB configs (without secrets)
    const dbConfigs = await prisma.platformIntegration.findMany({
      select: {
        provider: true,
        clientId: true,
        redirectUri: true,
        additionalConfig: true,
        enabled: true,
        configuredAt: true,
        lastTestedAt: true,
        testStatus: true,
        testError: true,
      },
    });

    const configMap = new Map(dbConfigs.map(c => [c.provider, c]));

    // Build response
    const integrations = Object.entries(PROVIDER_METADATA).map(([provider, metadata]) => {
      const dbConfig = configMap.get(provider);
      const status = statuses[provider as IntegrationProvider];

      return {
        provider,
        ...metadata,
        configured: status?.configured ?? false,
        enabled: status?.enabled ?? false,
        source: status?.source ?? 'none',
        clientId: dbConfig?.clientId || null,
        redirectUri: dbConfig?.redirectUri || null,
        additionalConfig: dbConfig?.additionalConfig || null,
        configuredAt: dbConfig?.configuredAt || null,
        lastTestedAt: dbConfig?.lastTestedAt || null,
        testStatus: dbConfig?.testStatus || null,
        testError: dbConfig?.testError || null,
      };
    });

    res.json({
      success: true,
      data: integrations,
    });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch integrations' });
  }
});

/**
 * GET /api/admin/integrations/:provider
 * Get configuration for a specific provider
 */
router.get('/:provider', async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.params.provider;

    if (!provider || !PROVIDER_METADATA[provider]) {
      res.status(400).json({ success: false, error: 'Invalid provider' });
      return;
    }

    const config = await prisma.platformIntegration.findUnique({
      where: { provider },
      select: {
        provider: true,
        clientId: true,
        redirectUri: true,
        additionalConfig: true,
        enabled: true,
        configuredAt: true,
        lastTestedAt: true,
        testStatus: true,
        testError: true,
      },
    });

    res.json({
      success: true,
      data: {
        ...PROVIDER_METADATA[provider],
        ...config,
        provider,
      },
    });
  } catch (error) {
    console.error('Error fetching integration:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch integration' });
  }
});

/**
 * POST /api/admin/integrations/:provider
 * Create or update integration configuration
 * Requires super_admin role
 */
router.post('/:provider', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.params.provider;
    const { clientId, clientSecret, redirectUri, additionalConfig, enabled = true } = req.body;
    const adminReq = req as AdminAuthenticatedRequest;

    if (!provider || !PROVIDER_METADATA[provider]) {
      res.status(400).json({ success: false, error: 'Invalid provider' });
      return;
    }

    if (!clientId || !clientSecret) {
      res.status(400).json({ success: false, error: 'Client ID and Client Secret are required' });
      return;
    }

    // Encrypt the client secret
    const clientSecretEncrypted = encryptWithEnvKey(clientSecret);

    // Upsert the configuration
    const config = await prisma.platformIntegration.upsert({
      where: { provider },
      create: {
        provider,
        clientId,
        clientSecretEncrypted,
        redirectUri,
        additionalConfig: additionalConfig || undefined,
        enabled,
        configuredById: adminReq.adminAuth?.adminId || null,
        configuredAt: new Date(),
      },
      update: {
        clientId,
        clientSecretEncrypted,
        redirectUri,
        additionalConfig: additionalConfig || undefined,
        enabled,
        configuredById: adminReq.adminAuth?.adminId || null,
        configuredAt: new Date(),
        // Clear test status on update
        testStatus: null,
        testError: null,
        lastTestedAt: null,
      },
      select: {
        provider: true,
        clientId: true,
        redirectUri: true,
        additionalConfig: true,
        enabled: true,
        configuredAt: true,
      },
    });

    // Clear cache
    clearConfigCache(provider as IntegrationProvider);

    res.json({
      success: true,
      data: config,
      message: `${PROVIDER_METADATA[provider].name} configuration saved`,
    });
  } catch (error) {
    console.error('Error saving integration:', error);
    res.status(500).json({ success: false, error: 'Failed to save integration configuration' });
  }
});

/**
 * PATCH /api/admin/integrations/:provider/toggle
 * Enable or disable an integration
 * Requires super_admin role
 */
router.patch('/:provider/toggle', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.params.provider;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'enabled must be a boolean' });
      return;
    }

    if (!provider) {
      res.status(400).json({ success: false, error: 'Provider is required' });
      return;
    }

    const config = await prisma.platformIntegration.update({
      where: { provider },
      data: { enabled },
      select: { provider: true, enabled: true },
    });

    // Clear cache
    clearConfigCache(provider as IntegrationProvider);

    res.json({
      success: true,
      data: config,
      message: `Integration ${enabled ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    console.error('Error toggling integration:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle integration' });
  }
});

/**
 * POST /api/admin/integrations/:provider/test
 * Test integration configuration
 * Requires super_admin role
 */
router.post('/:provider/test', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.params.provider;

    if (!provider) {
      res.status(400).json({ success: false, error: 'Provider is required' });
      return;
    }

    // Get config
    const config = await prisma.platformIntegration.findUnique({
      where: { provider },
    });

    if (!config) {
      res.status(404).json({ success: false, error: 'Integration not configured' });
      return;
    }

    // Decrypt secret
    const clientSecret = decryptWithEnvKey(config.clientSecretEncrypted);

    // Test based on provider (simple validation - just check credentials format)
    let testResult = { success: true, message: 'Configuration looks valid' };

    // Basic validation
    if (!config.clientId || config.clientId.length < 10) {
      testResult = { success: false, message: 'Client ID appears invalid (too short)' };
    } else if (!clientSecret || clientSecret.length < 10) {
      testResult = { success: false, message: 'Client Secret appears invalid (too short)' };
    }

    // Update test status
    await prisma.platformIntegration.update({
      where: { provider },
      data: {
        lastTestedAt: new Date(),
        testStatus: testResult.success ? 'success' : 'failed',
        testError: testResult.success ? null : testResult.message,
      },
    });

    // Clear cache
    clearConfigCache(provider as IntegrationProvider);

    res.json({
      success: testResult.success,
      message: testResult.message,
    });
  } catch (error) {
    console.error('Error testing integration:', error);
    res.status(500).json({ success: false, error: 'Failed to test integration' });
  }
});

/**
 * DELETE /api/admin/integrations/:provider
 * Remove integration configuration
 * Requires super_admin role
 */
router.delete('/:provider', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.params.provider;

    if (!provider) {
      res.status(400).json({ success: false, error: 'Provider is required' });
      return;
    }

    await prisma.platformIntegration.delete({
      where: { provider },
    });

    // Clear cache
    clearConfigCache(provider as IntegrationProvider);

    res.json({
      success: true,
      message: 'Integration configuration removed',
    });
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json({ success: false, error: 'Failed to delete integration' });
  }
});

export default router;
