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
