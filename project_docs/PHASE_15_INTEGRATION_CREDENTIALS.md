# Phase 15: Integration Credentials Management
## Platform-Level OAuth Configuration UI

**Date:** January 7, 2026  
**Status:** Ready for Implementation  
**Priority:** Medium (after Phase 14)  
**Estimated Effort:** 1-2 days

---

## Executive Summary

Currently, OAuth integration credentials (Zoom, Slack, HubSpot, etc.) must be configured via environment variables. This phase adds a super-admin UI to configure these credentials through the admin panel, stored encrypted in the database.

**Approach:** Platform-Level OAuth (single OAuth app shared by all tenants)

---

## Part 1: Current State

### How It Works Now

```
┌─────────────────────────────────────────────────────────────────┐
│                        Environment Variables                      │
│  ZOOM_CLIENT_ID=xxx                                              │
│  ZOOM_CLIENT_SECRET=xxx                                          │
│  SLACK_CLIENT_ID=xxx                                             │
│  SLACK_CLIENT_SECRET=xxx                                         │
│  ...                                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    apps/api/src/config/index.ts                  │
│  config.zoom = {                                                 │
│    clientId: process.env.ZOOM_CLIENT_ID || '',                  │
│    clientSecret: process.env.ZOOM_CLIENT_SECRET || '',          │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Integration Service Classes                      │
│  ZoomIntegration, SlackIntegration, etc.                        │
│  Read from config.zoom, config.slack, etc.                      │
└─────────────────────────────────────────────────────────────────┘
```

### Problem

- No UI to manage credentials
- Requires server restart to change credentials  
- Credentials in plain text in .env files
- No way for non-technical admins to configure integrations
- If credentials not set: "Integration is not configured. Please contact your administrator."

### Existing Integrations

| Provider | Config Key | Required Fields |
|----------|------------|-----------------|
| Slack | `config.slack` | clientId, clientSecret, redirectUri |
| HubSpot | `config.hubspot` | clientId, clientSecret, redirectUri |
| Salesforce | `config.salesforce` | clientId, clientSecret, redirectUri |
| Zoom | `config.zoom` | clientId, clientSecret, redirectUri |
| Microsoft Teams | `config.microsoft` | clientId, clientSecret, tenantId, redirectUri |
| Google Calendar | `config.google` | clientId, clientSecret, redirectUri |

---

## Part 2: Solution Design

### Architecture After Phase 15

```
┌─────────────────────────────────────────────────────────────────┐
│                     Super Admin Panel UI                         │
│              /admin/integrations                                 │
│  [Slack: ✅ Configured] [Edit] [Test]                           │
│  [Zoom:  ⚠️ Not Configured] [Configure]                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Admin API Endpoints                             │
│  POST /api/admin/integrations/:provider                         │
│  GET  /api/admin/integrations                                   │
│  PUT  /api/admin/integrations/:provider                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database (Encrypted)                          │
│  PlatformIntegration {                                          │
│    provider: "zoom",                                            │
│    clientId: "xxx",                                             │
│    clientSecretEncrypted: "aes256:...",                        │
│    enabled: true                                                │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Integration Config Service                          │
│  getIntegrationConfig("zoom")                                   │
│  1. Check DB for PlatformIntegration                            │
│  2. If not found, fall back to env vars                         │
│  3. Cache result for 5 minutes                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Database Schema

### New Model: PlatformIntegration

**File:** `packages/database/prisma/schema.prisma`

```prisma
// ============================================
// Platform-Level Integration Configuration
// ============================================

model PlatformIntegration {
  id                     String    @id @default(uuid())
  provider               String    @unique // slack, zoom, hubspot, salesforce, microsoft, google
  
  // OAuth Credentials (clientSecret is encrypted)
  clientId               String    @map("client_id")
  clientSecretEncrypted  String    @map("client_secret_encrypted")
  
  // Provider-specific fields (stored as JSON)
  additionalConfig       Json?     @map("additional_config") // e.g., { tenantId: "xxx" } for Microsoft
  
  // OAuth URLs (auto-generated but can be overridden)
  redirectUri            String?   @map("redirect_uri")
  
  // Status
  enabled                Boolean   @default(true)
  
  // Audit
  configuredById         String?   @map("configured_by_id") // Admin user ID
  configuredAt           DateTime? @map("configured_at")
  lastTestedAt           DateTime? @map("last_tested_at")
  testStatus             String?   @map("test_status") // success, failed, pending
  testError              String?   @map("test_error")
  
  createdAt              DateTime  @default(now()) @map("created_at")
  updatedAt              DateTime  @updatedAt @map("updated_at")

  @@map("platform_integrations")
}
```

**Migration required:** Yes

---

## Part 4: Encryption Utility

**File:** `apps/api/src/lib/encryption.ts`

```typescript
/**
 * AES-256-GCM Encryption for storing secrets
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Must be exactly 32 bytes (256 bits)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.PLATFORM_ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  
  // If key is hex encoded (64 chars = 32 bytes)
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  
  // If key is base64 encoded
  if (key.length === 44 && key.endsWith('=')) {
    return Buffer.from(key, 'base64');
  }
  
  // Use raw key (padded or truncated to 32 bytes)
  const keyBuffer = Buffer.alloc(32);
  Buffer.from(key).copy(keyBuffer);
  return keyBuffer;
}

/**
 * Encrypt a plaintext string
 * Returns: iv:authTag:ciphertext (all hex encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * Input format: iv:authTag:ciphertext (all hex encoded)
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivHex, authTagHex, ciphertext] = parts;
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Check if encryption key is properly configured
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}
```

---

## Part 5: Integration Config Service

**File:** `apps/api/src/services/integrationConfigService.ts`

```typescript
/**
 * Integration Configuration Service
 * Retrieves OAuth credentials from DB with fallback to env vars
 */

import { prisma } from '@zigznote/database';
import { config } from '../config';
import { decrypt } from '../lib/encryption';

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

type IntegrationProvider = 'slack' | 'hubspot' | 'salesforce' | 'zoom' | 'microsoft' | 'google';

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
  const dbConfig = await prisma.platformIntegration.findUnique({
    where: { provider },
  });

  if (dbConfig && dbConfig.enabled) {
    const integrationConfig: IntegrationConfig = {
      clientId: dbConfig.clientId,
      clientSecret: decrypt(dbConfig.clientSecretEncrypted),
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
```

---

## Part 6: Admin API Endpoints

**File:** `apps/api/src/routes/admin/integrations.ts`

```typescript
/**
 * Admin Integration Management API
 * Configure platform-level OAuth credentials
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@zigznote/database';
import { encrypt, decrypt, isEncryptionConfigured } from '../../lib/encryption';
import { clearConfigCache, getAllIntegrationStatuses } from '../../services/integrationConfigService';
import { requireSuperAdmin } from '../../middleware/adminAuth';

const router = Router();

// All routes require super admin
router.use(requireSuperAdmin);

// Provider metadata for UI
const PROVIDER_METADATA = {
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
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check encryption is configured
    if (!isEncryptionConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'Encryption key not configured. Set ENCRYPTION_KEY environment variable.',
      });
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
      const status = statuses[provider as keyof typeof statuses];

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
router.get('/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;

    if (!PROVIDER_METADATA[provider as keyof typeof PROVIDER_METADATA]) {
      return res.status(400).json({ success: false, error: 'Invalid provider' });
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
        ...PROVIDER_METADATA[provider as keyof typeof PROVIDER_METADATA],
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
 */
router.post('/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { clientId, clientSecret, redirectUri, additionalConfig, enabled = true } = req.body;

    if (!PROVIDER_METADATA[provider as keyof typeof PROVIDER_METADATA]) {
      return res.status(400).json({ success: false, error: 'Invalid provider' });
    }

    if (!clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: 'Client ID and Client Secret are required' });
    }

    // Encrypt the client secret
    const clientSecretEncrypted = encrypt(clientSecret);

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
        configuredById: (req as any).adminUser?.id,
        configuredAt: new Date(),
      },
      update: {
        clientId,
        clientSecretEncrypted,
        redirectUri,
        additionalConfig: additionalConfig || undefined,
        enabled,
        configuredById: (req as any).adminUser?.id,
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
    clearConfigCache(provider as any);

    res.json({
      success: true,
      data: config,
      message: `${PROVIDER_METADATA[provider as keyof typeof PROVIDER_METADATA].name} configuration saved`,
    });
  } catch (error) {
    console.error('Error saving integration:', error);
    res.status(500).json({ success: false, error: 'Failed to save integration configuration' });
  }
});

/**
 * PATCH /api/admin/integrations/:provider/toggle
 * Enable or disable an integration
 */
router.patch('/:provider/toggle', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
    }

    const config = await prisma.platformIntegration.update({
      where: { provider },
      data: { enabled },
      select: { provider: true, enabled: true },
    });

    // Clear cache
    clearConfigCache(provider as any);

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
 */
router.post('/:provider/test', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;

    // Get config
    const config = await prisma.platformIntegration.findUnique({
      where: { provider },
    });

    if (!config) {
      return res.status(404).json({ success: false, error: 'Integration not configured' });
    }

    // Decrypt secret
    const clientSecret = decrypt(config.clientSecretEncrypted);

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
    clearConfigCache(provider as any);

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
 */
router.delete('/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;

    await prisma.platformIntegration.delete({
      where: { provider },
    });

    // Clear cache
    clearConfigCache(provider as any);

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
```

---

## Part 7: Admin UI Page

**File:** `apps/admin/app/(dashboard)/integrations/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Puzzle,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  Settings2,
  Loader2,
  Database,
  Server,
} from 'lucide-react';

interface Integration {
  provider: string;
  name: string;
  description: string;
  docsUrl: string;
  icon: string;
  requiredScopes: string[];
  additionalFields?: Array<{ key: string; label: string; required: boolean; default?: string }>;
  configured: boolean;
  enabled: boolean;
  source: 'database' | 'environment' | 'none';
  clientId: string | null;
  redirectUri: string | null;
  additionalConfig: Record<string, unknown> | null;
  configuredAt: string | null;
  lastTestedAt: string | null;
  testStatus: 'success' | 'failed' | null;
  testError: string | null;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    additionalConfig: {} as Record<string, string>,
    enabled: true,
  });

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/integrations');
      const data = await res.json();

      if (data.success) {
        setIntegrations(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const openConfigModal = (provider: string) => {
    const integration = integrations.find((i) => i.provider === provider);
    if (integration) {
      setFormData({
        clientId: integration.clientId || '',
        clientSecret: '', // Never pre-fill secret
        redirectUri: integration.redirectUri || '',
        additionalConfig: (integration.additionalConfig as Record<string, string>) || {},
        enabled: integration.enabled,
      });
      setSelectedProvider(provider);
      setShowModal(true);
      setShowSecret(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProvider) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/integrations/${selectedProvider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: formData.clientId,
          clientSecret: formData.clientSecret,
          redirectUri: formData.redirectUri || undefined,
          additionalConfig: Object.keys(formData.additionalConfig).length > 0 ? formData.additionalConfig : undefined,
          enabled: formData.enabled,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setShowModal(false);
        fetchIntegrations();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (provider: string) => {
    setTesting(provider);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/integrations/${provider}/test`, {
        method: 'POST',
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Test passed: ${data.message}` });
      } else {
        setMessage({ type: 'error', text: `Test failed: ${data.message || data.error}` });
      }

      fetchIntegrations();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to test integration' });
    } finally {
      setTesting(null);
    }
  };

  const handleToggle = async (provider: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/admin/integrations/${provider}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      const data = await res.json();

      if (data.success) {
        fetchIntegrations();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to toggle integration' });
    }
  };

  const getStatusBadge = (integration: Integration) => {
    if (!integration.configured) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          <X className="w-3 h-3" />
          Not Configured
        </span>
      );
    }

    if (!integration.enabled) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <AlertCircle className="w-3 h-3" />
          Disabled
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <Check className="w-3 h-3" />
        Active
      </span>
    );
  };

  const getSourceBadge = (source: string) => {
    if (source === 'database') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
          <Database className="w-3 h-3" />
          Database
        </span>
      );
    }
    if (source === 'environment') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
          <Server className="w-3 h-3" />
          Env Vars
        </span>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const selectedIntegration = integrations.find((i) => i.provider === selectedProvider);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Integrations</h1>
          <p className="text-slate-500 mt-1">Configure OAuth credentials for third-party integrations</p>
        </div>
        <button
          onClick={fetchIntegrations}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Puzzle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800 font-medium">Platform-Level OAuth</p>
            <p className="text-sm text-blue-700 mt-1">
              These credentials are shared across all organizations. Configure your OAuth apps with the providers below,
              then enter the credentials here. Credentials from the database take priority over environment variables.
            </p>
          </div>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <div
            key={integration.provider}
            className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Puzzle className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{integration.name}</h3>
                  <p className="text-xs text-slate-500">{integration.provider}</p>
                </div>
              </div>
              {getStatusBadge(integration)}
            </div>

            <p className="text-sm text-slate-600 mt-3">{integration.description}</p>

            <div className="mt-4 flex items-center gap-2">
              {getSourceBadge(integration.source)}
              {integration.testStatus === 'success' && (
                <span className="text-xs text-green-600">✓ Tested</span>
              )}
              {integration.testStatus === 'failed' && (
                <span className="text-xs text-red-600">✗ Test Failed</span>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <a
                href={integration.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                Setup Guide
                <ExternalLink className="w-3 h-3" />
              </a>

              <div className="flex items-center gap-2">
                {integration.configured && (
                  <>
                    <button
                      onClick={() => handleTest(integration.provider)}
                      disabled={testing === integration.provider}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                      title="Test Connection"
                    >
                      {testing === integration.provider ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={integration.enabled}
                        onChange={(e) => handleToggle(integration.provider, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                    </label>
                  </>
                )}
                <button
                  onClick={() => openConfigModal(integration.provider)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700"
                >
                  <Settings2 className="w-4 h-4" />
                  {integration.configured ? 'Edit' : 'Configure'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Configuration Modal */}
      {showModal && selectedIntegration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Configure {selectedIntegration.name}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Enter your OAuth application credentials</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Docs Link */}
              <div className="bg-slate-50 rounded-lg p-3">
                <a
                  href={selectedIntegration.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                >
                  View {selectedIntegration.name} OAuth Setup Documentation
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Client ID */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Client ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter Client ID"
                />
              </div>

              {/* Client Secret */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Client Secret <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={formData.clientSecret}
                    onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={selectedIntegration.configured ? '••••••••••••' : 'Enter Client Secret'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {selectedIntegration.configured && (
                  <p className="text-xs text-slate-500 mt-1">Leave empty to keep existing secret</p>
                )}
              </div>

              {/* Redirect URI */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Redirect URI
                  <span className="text-slate-400 font-normal ml-1">(auto-generated if empty)</span>
                </label>
                <input
                  type="text"
                  value={formData.redirectUri}
                  onChange={(e) => setFormData({ ...formData, redirectUri: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://api.yourapp.com/callback"
                />
              </div>

              {/* Additional Fields (e.g., Tenant ID for Microsoft) */}
              {selectedIntegration.additionalFields?.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                    {field.default && (
                      <span className="text-slate-400 font-normal ml-1">(default: {field.default})</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formData.additionalConfig[field.key] || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        additionalConfig: { ...formData.additionalConfig, [field.key]: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={field.default || `Enter ${field.label}`}
                  />
                </div>
              ))}

              {/* Required Scopes Info */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Required Scopes:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedIntegration.requiredScopes.map((scope) => (
                    <code key={scope} className="px-2 py-0.5 bg-slate-200 rounded text-xs text-slate-700">
                      {scope}
                    </code>
                  ))}
                </div>
              </div>

              {/* Enable Toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-700">Enable Integration</p>
                  <p className="text-xs text-slate-500">Users can connect when enabled</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.clientId || (!formData.clientSecret && !selectedIntegration.configured)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Part 8: Update Admin Layout Navigation

**File:** `apps/admin/app/(dashboard)/layout.tsx`

Add Integrations to the System submenu:

```tsx
// Update the navigation array to include Integrations
const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Organizations', href: '/organizations', icon: Building2 },
  { name: 'API Keys', href: '/api-keys', icon: Key },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  {
    name: 'System',
    href: '/system',
    icon: Database,
    children: [
      { name: 'Integrations', href: '/integrations' },  // ADD THIS
      { name: 'Configuration', href: '/system/config' },
      { name: 'Feature Flags', href: '/feature-flags' },
    ],
  },
  { name: 'Security', href: '/security', icon: Shield },
  { name: 'Support Tools', href: '/support', icon: Wrench },
  { name: 'Operations', href: '/operations', icon: Activity },
  { name: 'Audit Logs', href: '/audit-logs', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];
```

---

## Part 9: Update Integration Services

Modify each integration class to use the new config service instead of direct env var access.

**Example: Update ZoomIntegration**

**File:** `apps/api/src/integrations/zoom/ZoomIntegration.ts`

```typescript
// At the top of the file, add:
import { getIntegrationConfig } from '../../services/integrationConfigService';

// Change the constructor to be async-initializable:
export class ZoomIntegration extends OAuthIntegration {
  protected oauthConfig!: OAuthConfig;

  private readonly apiBase = 'https://api.zoom.us/v2';

  constructor(prisma: PrismaClient) {
    super(prisma, 'zoom');
  }

  /**
   * Initialize OAuth config (call before using)
   */
  async initialize(): Promise<boolean> {
    const cfg = await getIntegrationConfig('zoom');
    
    if (!cfg || !cfg.clientId || !cfg.clientSecret) {
      return false;
    }

    this.oauthConfig = {
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      redirectUri: cfg.redirectUri,
      scopes: ['user:read', 'meeting:read'],
      authorizationUrl: 'https://zoom.us/oauth/authorize',
      tokenUrl: 'https://zoom.us/oauth/token',
    };

    return true;
  }

  // ... rest of the class unchanged
}
```

Apply similar pattern to other integration classes.

---

## Part 10: Wire Up API Routes

**File:** `apps/api/src/routes/index.ts`

```typescript
// Add the admin integrations route
import adminIntegrationsRouter from './admin/integrations';

// In the route setup:
app.use('/api/admin/integrations', adminIntegrationsRouter);
```

---

## Part 11: Implementation Order

### Day 1: Foundation

1. **Add Prisma model** - `PlatformIntegration`
2. **Run migration** - `npx prisma migrate dev --name add_platform_integrations`
3. **Create encryption utility** - `apps/api/src/lib/encryption.ts`
4. **Create config service** - `apps/api/src/services/integrationConfigService.ts`

### Day 2: API & UI

1. **Create admin API routes** - `apps/api/src/routes/admin/integrations.ts`
2. **Wire up routes** in main router
3. **Create admin UI page** - `apps/admin/app/(dashboard)/integrations/page.tsx`
4. **Update admin nav** - Add Integrations to System submenu
5. **Update integration classes** to use config service

### Day 3: Testing

1. Test saving credentials through UI
2. Test OAuth flow with DB credentials
3. Test fallback to env vars
4. Test enable/disable toggle
5. Verify encryption at rest

---

## Part 12: Files Summary

### Files to CREATE

| File | Purpose |
|------|---------|
| `apps/api/src/lib/encryption.ts` | AES-256-GCM encryption/decryption |
| `apps/api/src/services/integrationConfigService.ts` | Config retrieval with DB + env fallback |
| `apps/api/src/routes/admin/integrations.ts` | Admin API for managing integrations |
| `apps/admin/app/(dashboard)/integrations/page.tsx` | Admin UI for OAuth config |

### Files to MODIFY

| File | Changes |
|------|---------|
| `packages/database/prisma/schema.prisma` | Add PlatformIntegration model |
| `apps/admin/app/(dashboard)/layout.tsx` | Add Integrations to nav |
| `apps/api/src/routes/index.ts` | Register admin integrations route |
| `apps/api/src/integrations/*/` | Update to use config service |

---

## Part 13: Security Checklist

- [ ] Client secrets encrypted with AES-256-GCM
- [ ] Encryption key stored only in environment variable
- [ ] Admin routes require super-admin authentication
- [ ] Secrets never logged or returned to UI after save
- [ ] Rate limiting on test endpoint
- [ ] Audit log entries for credential changes

---

## Part 14: Claude Code Implementation Prompt

```
# Phase 15: Integration Credentials Management

Read the specification at `/project_docs/PHASE_15_INTEGRATION_CREDENTIALS.md` and implement all changes.

## Priority Order:

1. Add PlatformIntegration model to Prisma schema
2. Run migration
3. Create encryption utility
4. Create integrationConfigService  
5. Create admin API routes
6. Create admin UI page
7. Update admin nav layout
8. Update one integration class (Zoom) as example
9. Test the full flow

## Key Points:
- Secrets must be encrypted at rest (AES-256-GCM)
- DB config takes priority over env vars
- Cache config for 5 minutes
- Never return decrypted secrets to UI after save

After changes, run:
- npx prisma generate
- npx prisma migrate dev --name add_platform_integrations
- pnpm build (verify no errors)

Commit message: "Phase 15: Platform integration credentials management"
```

---

## Appendix: Environment Setup

Ensure the following environment variable is set (32 bytes, hex encoded):

```bash
# Generate a secure key:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

ENCRYPTION_KEY=your-64-character-hex-string-here
```

This key is used to encrypt all OAuth client secrets in the database.
