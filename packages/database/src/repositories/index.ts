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
} from './meetingRepository';

export {
  MeetingQueryRepository,
  meetingQueryRepository,
} from './meetingQueryRepository';

export {
  MeetingStatsRepository,
  meetingStatsRepository,
  type MeetingStats,
  type MeetingAnalytics,
} from './meetingStatsRepository';

export {
  TranscriptRepository,
  transcriptRepository,
  type TranscriptInclude,
} from './transcriptRepository';

export {
  SummaryRepository,
  summaryRepository,
} from './summaryRepository';

export {
  ActionItemRepository,
  actionItemRepository,
  type ActionItemStats,
} from './actionItemRepository';
