export { MeetingService, meetingService } from './meetingService';
export type {
  MeetingResponse,
  CreateMeetingData,
  UpdateMeetingData,
  ListMeetingsQuery,
  ListMeetingsResult,
} from './meetingService';

export {
  apiKeyService,
  API_KEY_SCOPES,
  type ApiKeyScope,
  type ValidatedApiKey,
  type CreateApiKeyInput,
  type ApiKeyResponse,
} from './apiKeyService';

export {
  voiceProfileService,
  type CreateVoiceProfileInput,
  type MatchSpeakerInput,
  type SpeakerIdentification,
} from './voiceProfileService';

export {
  analyticsService,
  type UserDashboardStats,
  type OrgAnalyticsStats,
  type Achievement,
  type ProductivityScore,
} from './analyticsService';

export {
  EmbeddingService,
  embeddingService,
  type EmbeddingResult,
  type SimilarResult,
  type SemanticSearchOptions,
} from './embeddingService';

export {
  MeetingChatService,
  meetingChatService,
  type ChatMessage,
  type ChatResponse,
  type Citation,
  type CreateChatOptions,
  type SendMessageOptions,
} from './meetingChatService';

// Phase 12: Team Collaboration
export {
  MeetingAccessService,
  meetingAccessService,
  PERMISSION_LEVELS,
  type MeetingAccessResult,
} from './meetingAccessService';

export {
  CommentService,
  commentService,
  type CommentWithDetails,
  type CreateCommentData,
  type UpdateCommentData,
} from './commentService';

export {
  AnnotationService,
  annotationService,
  LABEL_COLORS,
  type AnnotationWithUser,
  type CreateAnnotationData,
  type UpdateAnnotationData,
} from './annotationService';

export {
  NotificationService,
  notificationService,
  type NotificationWithDetails,
  type CreateNotificationData,
  type NotificationFilters,
} from './notificationService';

export {
  ActivityService,
  activityService,
  type ActivityWithDetails,
  type LogActivityData,
  type ActivityFilters,
} from './activityService';

export {
  RealtimeService,
  realtimeService,
  type RealtimeEventType,
  type RealtimeMessage,
} from './realtimeService';
