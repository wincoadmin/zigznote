export { prisma, PrismaClient } from './client';

// Re-export Prisma namespace for utilities (DbNull, JsonNull, etc.)
export { Prisma } from '@prisma/client';

// Re-export Prisma types for convenience
export type {
  Organization,
  User,
  UserApiKey,
  CalendarConnection,
  Meeting,
  MeetingParticipant,
  Transcript,
  Summary,
  ActionItem,
  TranscriptEmbedding,
  IntegrationConnection,
  AutomationRule,
  Webhook,
  WebhookDelivery,
  BillingCustomer,
  BillingPlan,
  Subscription,
  Payment,
  Invoice,
  Refund,
} from '@prisma/client';

// Export repositories
export * from './repositories';

// Export types
export * from './types';

// Export utilities
export * from './utils';
