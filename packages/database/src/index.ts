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
  // Admin types
  AdminUser,
  AdminSession,
  AuditLog,
  SystemApiKey,
  FeatureFlag,
  SystemConfig,
  // Voice profile types
  VoiceProfile,
  SpeakerMatch,
  SpeakerAlias,
  CustomVocabulary,
  NamePattern,
  // Analytics types
  UserDailyMetrics,
  OrgDailyMetrics,
  UserEngagement,
  Achievement,
  UserAchievement,
  MeetingAnalytics,
  // Settings types
  NotificationPreferences,
  OrganizationSettings,
  DataExport,
  MeetingShare,
  UsageRecord,
  // Chat types
  MeetingChat,
  ChatMessage,
  SuggestedQuestion,
  Conversation,
  ConversationMessage,
  // Webhook types
  ProcessedWebhook,
  // Backup types
  DatabaseBackup,
} from '@prisma/client';

// Re-export enums
export { AccountType, BackupType, BackupStatus } from '@prisma/client';

// Export repositories
export * from './repositories';

// Export types
export * from './types';

// Export utilities
export * from './utils';
