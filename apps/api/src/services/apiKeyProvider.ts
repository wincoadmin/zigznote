/**
 * API Key Provider
 * Provides API keys to services with database-first approach and env fallback.
 *
 * Priority:
 * 1. Database (SystemApiKey) - encrypted, manageable via admin UI
 * 2. Environment variables - for local dev or initial setup
 *
 * Features:
 * - In-memory caching with TTL to reduce database calls
 * - Automatic fallback to env vars
 * - Logs when falling back for visibility
 */

import { systemApiKeyService, ApiProviders } from './systemApiKeyService';
import { config } from '../config';
import { logger } from '../utils/logger';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  value: string | null;
  expiresAt: number;
  source: 'database' | 'env' | 'none';
}

/**
 * Provider configuration mapping
 * Maps provider names to their environment variable paths
 */
const ENV_FALLBACKS: Record<string, () => string | undefined> = {
  // Transcription & AI
  [ApiProviders.DEEPGRAM]: () => config.deepgram.apiKey,
  [ApiProviders.ANTHROPIC]: () => config.anthropicApiKey,
  [ApiProviders.OPENAI]: () => config.openaiApiKey,

  // Meeting bots
  [ApiProviders.RECALL]: () => config.recall.apiKey,

  // Payments
  [ApiProviders.STRIPE]: () => config.stripe.secretKey,

  // Email
  resend: () => config.resend.apiKey,

  // Auth
  [ApiProviders.CLERK]: () => config.clerk.secretKey,

  // Integrations (OAuth - these are client secrets, not API keys)
  [ApiProviders.GOOGLE]: () => config.google.clientSecret,
  [ApiProviders.SLACK]: () => config.slack.clientSecret,
  [ApiProviders.HUBSPOT]: () => config.hubspot.clientSecret,
  zoom: () => config.zoom.clientSecret,
  microsoft: () => config.microsoft.clientSecret,
  salesforce: () => config.salesforce.clientSecret,

  // Flutterwave
  flutterwave: () => config.flutterwave.secretKey,
};

class ApiKeyProvider {
  private cache: Map<string, CacheEntry> = new Map();
  private environment: string;

  constructor() {
    this.environment = config.nodeEnv === 'production' ? 'production' : 'development';
  }

  /**
   * Get an API key for a provider
   * Checks database first, falls back to environment variable
   */
  async getKey(provider: string): Promise<string | null> {
    const cacheKey = `${provider}:${this.environment}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Try database first
    try {
      const dbKey = await systemApiKeyService.getDecryptedKey(provider, this.environment);
      if (dbKey) {
        this.setCache(cacheKey, dbKey, 'database');
        return dbKey;
      }
    } catch (error) {
      logger.warn({ provider, error }, 'Failed to get API key from database, trying env fallback');
    }

    // Fallback to environment variable
    const envGetter = ENV_FALLBACKS[provider];
    const envKey = envGetter?.();

    if (envKey) {
      this.setCache(cacheKey, envKey, 'env');
      // Log that we're using env fallback (only once per cache period)
      if (!cached || cached.source !== 'env') {
        logger.info({ provider }, 'Using environment variable fallback for API key');
      }
      return envKey;
    }

    // No key found
    this.setCache(cacheKey, null, 'none');
    logger.warn({ provider }, 'No API key found in database or environment');
    return null;
  }

  /**
   * Get an API key, throwing if not found
   */
  async requireKey(provider: string): Promise<string> {
    const key = await this.getKey(provider);
    if (!key) {
      throw new Error(`API key for ${provider} is not configured. Add it via Admin Panel or environment variable.`);
    }
    return key;
  }

  /**
   * Check if a key is configured (without retrieving it)
   */
  async hasKey(provider: string): Promise<boolean> {
    const key = await this.getKey(provider);
    return !!key;
  }

  /**
   * Get the source of a key (database, env, or none)
   */
  async getKeySource(provider: string): Promise<'database' | 'env' | 'none'> {
    const cacheKey = `${provider}:${this.environment}`;

    // Ensure the key is fetched and cached
    await this.getKey(provider);

    const cached = this.cache.get(cacheKey);
    return cached?.source || 'none';
  }

  /**
   * Clear cache for a specific provider or all providers
   */
  clearCache(provider?: string): void {
    if (provider) {
      const cacheKey = `${provider}:${this.environment}`;
      this.cache.delete(cacheKey);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get status of all known providers
   */
  async getProvidersStatus(): Promise<Array<{
    provider: string;
    configured: boolean;
    source: 'database' | 'env' | 'none';
  }>> {
    const providers = Object.keys(ENV_FALLBACKS);
    const statuses = await Promise.all(
      providers.map(async (provider) => ({
        provider,
        configured: await this.hasKey(provider),
        source: await this.getKeySource(provider),
      }))
    );
    return statuses;
  }

  /**
   * Shorthand methods for common providers
   */
  async getDeepgramKey(): Promise<string | null> {
    return this.getKey(ApiProviders.DEEPGRAM);
  }

  async getAnthropicKey(): Promise<string | null> {
    return this.getKey(ApiProviders.ANTHROPIC);
  }

  async getOpenAIKey(): Promise<string | null> {
    return this.getKey(ApiProviders.OPENAI);
  }

  async getRecallKey(): Promise<string | null> {
    return this.getKey(ApiProviders.RECALL);
  }

  async getStripeKey(): Promise<string | null> {
    return this.getKey(ApiProviders.STRIPE);
  }

  async getResendKey(): Promise<string | null> {
    return this.getKey('resend');
  }

  private setCache(key: string, value: string | null, source: 'database' | 'env' | 'none'): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL,
      source,
    });
  }
}

// Export singleton instance
export const apiKeyProvider = new ApiKeyProvider();

// Export provider constants for convenience
export { ApiProviders } from './systemApiKeyService';
