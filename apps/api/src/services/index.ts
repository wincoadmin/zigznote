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
