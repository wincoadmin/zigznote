export { prisma, PrismaClient } from './client';

// Re-export Prisma types for convenience
export type {
  Organization,
  User,
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
  WebhookLog,
  Prisma,
} from '@prisma/client';

// Export repositories
export * from './repositories';

// Export types
export * from './types';

// Export utilities
export * from './utils';
