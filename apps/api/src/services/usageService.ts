/**
 * Usage Quota Service
 * Tracks and enforces usage limits per organization
 */

import { prisma } from '@zigznote/database';
import { AppError, createLogger } from '@zigznote/shared';

const logger = createLogger({ module: 'usage-service' });

/**
 * Plan limits configuration
 */
export const PLAN_LIMITS = {
  free: {
    meetingsPerMonth: 10,
    meetingMinutesPerMonth: 300, // 5 hours
    storageBytes: 1024 * 1024 * 1024, // 1 GB
    audioStorageBytes: 0, // No audio storage
    apiRequestsPerDay: 100,
    chatTokensPerMonth: 10000,
  },
  pro: {
    meetingsPerMonth: 100,
    meetingMinutesPerMonth: 3000, // 50 hours
    storageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    audioStorageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    apiRequestsPerDay: 1000,
    chatTokensPerMonth: 100000,
  },
  enterprise: {
    meetingsPerMonth: -1, // Unlimited
    meetingMinutesPerMonth: -1, // Unlimited
    storageBytes: -1, // Unlimited
    audioStorageBytes: -1, // Unlimited
    apiRequestsPerDay: -1, // Unlimited
    chatTokensPerMonth: -1, // Unlimited
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

/**
 * Get current billing period in "YYYY-MM" format
 */
export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get or create usage record for an organization
 */
async function getOrCreateUsageRecord(organizationId: string): Promise<{
  id: string;
  organizationId: string;
  period: string;
  meetingsCount: number;
  meetingMinutes: number;
  storageUsed: bigint;
  audioStorageUsed: bigint;
  transcriptionMinutes: number;
  summarizationTokens: number;
  chatTokens: number;
  apiRequests: number;
}> {
  const period = getCurrentPeriod();

  let record = await prisma.usageRecord.findUnique({
    where: {
      organizationId_period: {
        organizationId,
        period,
      },
    },
  });

  if (!record) {
    record = await prisma.usageRecord.create({
      data: {
        organizationId,
        period,
      },
    });
  }

  return record;
}

/**
 * Check if organization has reached a specific limit
 */
export async function checkLimit(
  organizationId: string,
  limitType: 'meetings' | 'minutes' | 'storage' | 'audio' | 'api' | 'chat',
  additionalUsage = 0
): Promise<{ allowed: boolean; current: number; limit: number; remaining: number }> {
  // Get organization plan
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, accountType: true },
  });

  if (!org) {
    throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
  }

  // Complimentary accounts have unlimited usage
  if (org.accountType === 'COMPLIMENTARY' || org.accountType === 'INTERNAL') {
    return { allowed: true, current: 0, limit: -1, remaining: -1 };
  }

  const plan = (org.plan || 'free') as PlanType;
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const usage = await getOrCreateUsageRecord(organizationId);

  let current: number;
  let limit: number;

  switch (limitType) {
    case 'meetings':
      current = usage.meetingsCount;
      limit = limits.meetingsPerMonth;
      break;
    case 'minutes':
      current = usage.meetingMinutes;
      limit = limits.meetingMinutesPerMonth;
      break;
    case 'storage':
      current = Number(usage.storageUsed);
      limit = limits.storageBytes;
      break;
    case 'audio':
      current = Number(usage.audioStorageUsed);
      limit = limits.audioStorageBytes;
      break;
    case 'api':
      current = usage.apiRequests;
      limit = limits.apiRequestsPerDay;
      break;
    case 'chat':
      current = usage.chatTokens;
      limit = limits.chatTokensPerMonth;
      break;
    default:
      throw new AppError(`Unknown limit type: ${limitType}`, 400, 'INVALID_LIMIT_TYPE');
  }

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, current, limit: -1, remaining: -1 };
  }

  const remaining = Math.max(0, limit - current);
  const allowed = current + additionalUsage <= limit;

  return { allowed, current, limit, remaining };
}

/**
 * Enforce a limit and throw if exceeded
 */
export async function enforceLimit(
  organizationId: string,
  limitType: 'meetings' | 'minutes' | 'storage' | 'audio' | 'api' | 'chat',
  additionalUsage = 0
): Promise<void> {
  const result = await checkLimit(organizationId, limitType, additionalUsage);

  if (!result.allowed) {
    const limitNames: Record<string, string> = {
      meetings: 'monthly meeting limit',
      minutes: 'monthly meeting minutes limit',
      storage: 'storage limit',
      audio: 'audio storage limit',
      api: 'daily API request limit',
      chat: 'monthly chat token limit',
    };

    throw new AppError(
      `You have reached your ${limitNames[limitType]}. Please upgrade your plan to continue.`,
      402,
      'QUOTA_EXCEEDED',
      { current: result.current, limit: result.limit }
    );
  }
}

/**
 * Increment usage for a specific metric
 */
export async function incrementUsage(
  organizationId: string,
  metric: 'meetings' | 'minutes' | 'storage' | 'audio' | 'transcription' | 'summarization' | 'chat' | 'api',
  amount: number
): Promise<void> {
  const period = getCurrentPeriod();

  const updateData: Record<string, { increment: number }> = {};

  switch (metric) {
    case 'meetings':
      updateData.meetingsCount = { increment: amount };
      break;
    case 'minutes':
      updateData.meetingMinutes = { increment: amount };
      break;
    case 'storage':
      updateData.storageUsed = { increment: amount };
      break;
    case 'audio':
      updateData.audioStorageUsed = { increment: amount };
      break;
    case 'transcription':
      updateData.transcriptionMinutes = { increment: amount };
      break;
    case 'summarization':
      updateData.summarizationTokens = { increment: amount };
      break;
    case 'chat':
      updateData.chatTokens = { increment: amount };
      break;
    case 'api':
      updateData.apiRequests = { increment: amount };
      break;
  }

  await prisma.usageRecord.upsert({
    where: {
      organizationId_period: {
        organizationId,
        period,
      },
    },
    create: {
      organizationId,
      period,
      ...Object.fromEntries(
        Object.entries(updateData).map(([key, value]) => [key, value.increment])
      ),
    },
    update: updateData,
  });

  logger.info({ organizationId, metric, amount, period }, 'Usage incremented');
}

/**
 * Get usage summary for an organization
 */
export async function getUsageSummary(organizationId: string): Promise<{
  period: string;
  usage: {
    meetings: { current: number; limit: number; percentage: number };
    minutes: { current: number; limit: number; percentage: number };
    storage: { current: number; limit: number; percentage: number };
    chat: { current: number; limit: number; percentage: number };
  };
  plan: string;
}> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });

  const plan = (org?.plan || 'free') as PlanType;
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const usage = await getOrCreateUsageRecord(organizationId);

  const calcPercentage = (current: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min(100, Math.round((current / limit) * 100));
  };

  return {
    period: usage.period,
    usage: {
      meetings: {
        current: usage.meetingsCount,
        limit: limits.meetingsPerMonth,
        percentage: calcPercentage(usage.meetingsCount, limits.meetingsPerMonth),
      },
      minutes: {
        current: usage.meetingMinutes,
        limit: limits.meetingMinutesPerMonth,
        percentage: calcPercentage(usage.meetingMinutes, limits.meetingMinutesPerMonth),
      },
      storage: {
        current: Number(usage.storageUsed),
        limit: limits.storageBytes,
        percentage: calcPercentage(Number(usage.storageUsed), limits.storageBytes),
      },
      chat: {
        current: usage.chatTokens,
        limit: limits.chatTokensPerMonth,
        percentage: calcPercentage(usage.chatTokens, limits.chatTokensPerMonth),
      },
    },
    plan,
  };
}

export const usageService = {
  checkLimit,
  enforceLimit,
  incrementUsage,
  getUsageSummary,
  getCurrentPeriod,
  PLAN_LIMITS,
};
