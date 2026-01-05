/**
 * Database repositories
 * Implements the repository pattern for data access abstraction
 */

export {
  BaseRepository,
  PaginatedQueryBuilder,
} from './baseRepository';

export {
  OrganizationRepository,
  organizationRepository,
  type OrganizationInclude,
  type OrganizationFilter,
} from './organizationRepository';

export {
  UserRepository,
  userRepository,
  type UserInclude,
} from './userRepository';

export {
  MeetingRepository,
  meetingRepository,
  type MeetingInclude,
  type MeetingWithRelations,
  type MeetingStats,
  type MeetingAnalytics,
} from './meetingRepository';

export {
  TranscriptRepository,
  transcriptRepository,
  type TranscriptInclude,
  type ActionItemStats,
} from './transcriptRepository';

export {
  CalendarRepository,
  calendarRepository,
  type CreateCalendarConnectionInput,
  type UpdateCalendarConnectionInput,
} from './calendarRepository';

export {
  UserApiKeyRepository,
  userApiKeyRepository,
} from './userApiKeyRepository';

export {
  SpeakerAliasRepository,
  speakerAliasRepository,
} from './speakerAliasRepository';

export {
  CustomVocabularyRepository,
  customVocabularyRepository,
} from './customVocabularyRepository';

// Admin Panel Repositories
export {
  AdminUserRepository,
  adminUserRepository,
  type AdminUserInclude,
  type AdminUserFilter,
} from './adminUserRepository';

export {
  AdminSessionRepository,
  adminSessionRepository,
  type AdminSessionInclude,
} from './adminSessionRepository';

export {
  AuditLogRepository,
  auditLogRepository,
  type AuditLogInclude,
} from './auditLogRepository';

export {
  SystemApiKeyRepository,
  systemApiKeyRepository,
  type SystemApiKeyFilter,
} from './systemApiKeyRepository';

export {
  FeatureFlagRepository,
  featureFlagRepository,
  type FeatureFlagFilter,
} from './featureFlagRepository';

export {
  SystemConfigRepository,
  systemConfigRepository,
  type SystemConfigFilter,
} from './systemConfigRepository';

// AI Meeting Assistant
export {
  conversationRepository,
  type ConversationWithMessages,
  type CreateConversationInput,
  type CreateMessageInput,
  type ConversationFilter,
  type Conversation,
  type ConversationMessage,
} from './conversationRepository';
