/**
 * BaseIntegration Abstract Class
 * Base class for all integrations to extend
 */

import type { PrismaClient, Prisma } from '@zigznote/database';
import { logger } from '../../utils/logger';
import { encrypt, decrypt } from '../../utils/encryption';
import { config } from '../../config';
import {
  IntegrationProvider,
  IntegrationCredentials,
  IntegrationSettings,
  IntegrationConnection,
  IntegrationResult,
  MeetingSummaryPayload,
  IntegrationStatus,
} from './types';

export abstract class BaseIntegration {
  protected prisma: PrismaClient;
  protected readonly provider: IntegrationProvider;

  constructor(prisma: PrismaClient, provider: IntegrationProvider) {
    this.prisma = prisma;
    this.provider = provider;
  }

  /**
   * Get integration connection for an organization
   */
  async getConnection(organizationId: string): Promise<IntegrationConnection | null> {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider: this.provider,
        },
      },
    });

    if (!connection) {
      return null;
    }

    return {
      id: connection.id,
      organizationId: connection.organizationId,
      provider: connection.provider as IntegrationProvider,
      credentials: this.decryptCredentials(connection.credentials as Record<string, unknown>),
      settings: connection.settings as IntegrationSettings,
      status: this.determineStatus(connection),
      connectedAt: connection.connectedAt,
      updatedAt: connection.updatedAt,
    };
  }

  /**
   * Check if integration is connected for an organization
   */
  async isConnected(organizationId: string): Promise<boolean> {
    const connection = await this.getConnection(organizationId);
    return connection !== null && connection.status === 'connected';
  }

  /**
   * Save integration credentials
   */
  async saveConnection(
    organizationId: string,
    credentials: IntegrationCredentials,
    settings: IntegrationSettings = {}
  ): Promise<IntegrationConnection> {
    const encryptedCredentials = this.encryptCredentials(credentials);

    const connection = await this.prisma.integrationConnection.upsert({
      where: {
        organizationId_provider: {
          organizationId,
          provider: this.provider,
        },
      },
      create: {
        organizationId,
        provider: this.provider,
        credentials: encryptedCredentials as Prisma.InputJsonValue,
        settings: settings as Prisma.InputJsonValue,
      },
      update: {
        credentials: encryptedCredentials as Prisma.InputJsonValue,
        settings: settings as Prisma.InputJsonValue,
      },
    });

    return {
      id: connection.id,
      organizationId: connection.organizationId,
      provider: connection.provider as IntegrationProvider,
      credentials,
      settings: connection.settings as IntegrationSettings,
      status: 'connected',
      connectedAt: connection.connectedAt,
      updatedAt: connection.updatedAt,
    };
  }

  /**
   * Update integration settings
   */
  async updateSettings(
    organizationId: string,
    settings: Partial<IntegrationSettings>
  ): Promise<IntegrationConnection | null> {
    const existing = await this.getConnection(organizationId);
    if (!existing) {
      return null;
    }

    const connection = await this.prisma.integrationConnection.update({
      where: {
        organizationId_provider: {
          organizationId,
          provider: this.provider,
        },
      },
      data: {
        settings: { ...existing.settings, ...settings } as Prisma.InputJsonValue,
      },
    });

    return {
      ...existing,
      settings: connection.settings as IntegrationSettings,
      updatedAt: connection.updatedAt,
    };
  }

  /**
   * Disconnect integration
   */
  async disconnect(organizationId: string): Promise<boolean> {
    try {
      await this.prisma.integrationConnection.delete({
        where: {
          organizationId_provider: {
            organizationId,
            provider: this.provider,
          },
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Abstract methods to be implemented by specific integrations
   */
  abstract sendMeetingSummary(
    organizationId: string,
    payload: MeetingSummaryPayload,
    options?: Record<string, unknown>
  ): Promise<IntegrationResult>;

  abstract testConnection(organizationId: string): Promise<IntegrationResult>;

  /**
   * Encrypt credentials before storing
   */
  protected encryptCredentials(credentials: IntegrationCredentials): Record<string, unknown> {
    const encrypted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string' && (key.includes('token') || key.includes('Token'))) {
        encrypted[key] = encrypt(value, config.encryptionKey);
      } else if (value instanceof Date) {
        encrypted[key] = value.toISOString();
      } else {
        encrypted[key] = value;
      }
    }

    return encrypted;
  }

  /**
   * Decrypt credentials after retrieval
   */
  protected decryptCredentials(encrypted: Record<string, unknown>): IntegrationCredentials {
    const credentials: IntegrationCredentials = {};

    for (const [key, value] of Object.entries(encrypted)) {
      if (typeof value === 'string' && (key.includes('token') || key.includes('Token'))) {
        credentials[key] = decrypt(value, config.encryptionKey);
      } else if (key === 'tokenExpires' && typeof value === 'string') {
        credentials[key] = new Date(value);
      } else {
        credentials[key] = value;
      }
    }

    return credentials;
  }

  /**
   * Determine connection status based on token expiry
   */
  protected determineStatus(connection: { credentials: unknown }): IntegrationStatus {
    const credentials = connection.credentials as IntegrationCredentials;

    if (!credentials.accessToken) {
      return 'disconnected';
    }

    if (credentials.tokenExpires) {
      const tokenExpires =
        credentials.tokenExpires instanceof Date
          ? credentials.tokenExpires
          : new Date(credentials.tokenExpires as string);

      if (tokenExpires < new Date()) {
        return 'expired';
      }
    }

    return 'connected';
  }

  /**
   * Log integration activity
   */
  protected log(
    level: 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>
  ): void {
    const logContext = {
      integration: this.provider,
      ...context,
    };

    switch (level) {
      case 'error':
        logger.error(logContext, message);
        break;
      case 'warn':
        logger.warn(logContext, message);
        break;
      default:
        logger.info(logContext, message);
    }
  }
}
