/**
 * Integration Configuration Service
 * Retrieves OAuth credentials from DB with fallback to env vars
 */

import { prisma } from '@zigznote/database';
import { config } from '../config';
import { decryptWithEnvKey } from '../utils/encryption';

// Simple in-memory cache
const configCache = new Map<string, { data: IntegrationConfig; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface IntegrationConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  additionalConfig?: Record<string, unknown>;
  enabled: boolean;
  source: 'database' | 'environment';
}

export type IntegrationProvider = 'slack' | 'hubspot' | 'salesforce' | 'zoom' | 'microsoft' | 'google';

/**
 * Get integration configuration
 * Priority: Database > Environment Variables
 */
export async function getIntegrationConfig(
  provider: IntegrationProvider
): Promise<IntegrationConfig | null> {
  // Check cache first
  const cached = configCache.get(provider);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Try database first
  try {
    const dbConfig = await prisma.platformIntegration.findUnique({
      where: { provider },
    });

    if (dbConfig && dbConfig.enabled) {
      const integrationConfig: IntegrationConfig = {
        clientId: dbConfig.clientId,
        clientSecret: decryptWithEnvKey(dbConfig.clientSecretEncrypted),
        redirectUri: dbConfig.redirectUri || getDefaultRedirectUri(provider),
        additionalConfig: dbConfig.additionalConfig as Record<string, unknown> | undefined,
        enabled: dbConfig.enabled,
        source: 'database',
      };

      // Cache the result
      configCache.set(provider, {
        data: integrationConfig,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return integrationConfig;
    }
  } catch (error) {
    // If database query fails, fall through to env vars
    console.error('Error fetching integration config from DB:', error);
  }

  // Fall back to environment variables
  const envConfig = getEnvConfig(provider);
  if (envConfig) {
    configCache.set(provider, {
      data: envConfig,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return envConfig;
  }

  return null;
}

/**
 * Check if an integration is configured (DB or env)
 */
export async function isIntegrationConfigured(provider: IntegrationProvider): Promise<boolean> {
  const cfg = await getIntegrationConfig(provider);
  return cfg !== null && cfg.clientId !== '' && cfg.clientSecret !== '';
}

/**
 * Get all integration statuses
 */
export async function getAllIntegrationStatuses(): Promise<
  Record<IntegrationProvider, { configured: boolean; enabled: boolean; source: 'database' | 'environment' | 'none' }>
> {
  const providers: IntegrationProvider[] = ['slack', 'hubspot', 'salesforce', 'zoom', 'microsoft', 'google'];
  const statuses: Record<string, { configured: boolean; enabled: boolean; source: string }> = {};

  for (const provider of providers) {
    const cfg = await getIntegrationConfig(provider);
    statuses[provider] = {
      configured: cfg !== null && cfg.clientId !== '' && cfg.clientSecret !== '',
      enabled: cfg?.enabled ?? false,
      source: cfg?.source ?? 'none',
    };
  }

  return statuses as Record<IntegrationProvider, { configured: boolean; enabled: boolean; source: 'database' | 'environment' | 'none' }>;
}

/**
 * Clear cache for a specific provider (call after update)
 */
export function clearConfigCache(provider?: IntegrationProvider): void {
  if (provider) {
    configCache.delete(provider);
  } else {
    configCache.clear();
  }
}

/**
 * Get default redirect URI for provider
 */
function getDefaultRedirectUri(provider: IntegrationProvider): string {
  const baseUrl = config.apiUrl;
  const redirectUris: Record<IntegrationProvider, string> = {
    slack: `${baseUrl}/api/v1/integrations/slack/callback`,
    hubspot: `${baseUrl}/api/v1/integrations/hubspot/callback`,
    salesforce: `${baseUrl}/api/v1/integrations/salesforce/callback`,
    zoom: `${baseUrl}/api/v1/integrations/zoom/callback`,
    microsoft: `${baseUrl}/api/v1/integrations/microsoft/callback`,
    google: `${baseUrl}/api/calendar/google/callback`,
  };
  return redirectUris[provider];
}

/**
 * Get config from environment variables (fallback)
 */
function getEnvConfig(provider: IntegrationProvider): IntegrationConfig | null {
  const envConfigs: Record<IntegrationProvider, () => IntegrationConfig | null> = {
    slack: () =>
      config.slack.clientId
        ? {
            clientId: config.slack.clientId,
            clientSecret: config.slack.clientSecret,
            redirectUri: config.slack.redirectUri,
            enabled: true,
            source: 'environment',
          }
        : null,
    hubspot: () =>
      config.hubspot.clientId
        ? {
            clientId: config.hubspot.clientId,
            clientSecret: config.hubspot.clientSecret,
            redirectUri: config.hubspot.redirectUri,
            enabled: true,
            source: 'environment',
          }
        : null,
    salesforce: () =>
      config.salesforce.clientId
        ? {
            clientId: config.salesforce.clientId,
            clientSecret: config.salesforce.clientSecret,
            redirectUri: config.salesforce.redirectUri,
            enabled: true,
            source: 'environment',
          }
        : null,
    zoom: () =>
      config.zoom.clientId
        ? {
            clientId: config.zoom.clientId,
            clientSecret: config.zoom.clientSecret,
            redirectUri: config.zoom.redirectUri,
            enabled: true,
            source: 'environment',
          }
        : null,
    microsoft: () =>
      config.microsoft.clientId
        ? {
            clientId: config.microsoft.clientId,
            clientSecret: config.microsoft.clientSecret,
            redirectUri: config.microsoft.redirectUri,
            additionalConfig: { tenantId: config.microsoft.tenantId },
            enabled: true,
            source: 'environment',
          }
        : null,
    google: () =>
      config.google.clientId
        ? {
            clientId: config.google.clientId,
            clientSecret: config.google.clientSecret,
            redirectUri: config.google.redirectUri,
            enabled: true,
            source: 'environment',
          }
        : null,
  };

  return envConfigs[provider]?.() ?? null;
}
