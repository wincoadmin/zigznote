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
} from '@prisma/client';
