/**
 * API client for communicating with the zigznote backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || {
            code: 'UNKNOWN_ERROR',
            message: 'An unknown error occurred',
          },
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async patch<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);

// Meeting API methods
export const meetingsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    const query = searchParams.toString();
    return api.get(`/api/v1/meetings${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => api.get(`/api/v1/meetings/${id}`),

  getUpcoming: () => api.get('/api/v1/meetings/upcoming'),

  getRecent: () => api.get('/api/v1/meetings/recent'),

  getStats: () => api.get('/api/v1/meetings/stats'),

  create: (data: { title: string; platform?: string; meetingUrl?: string }) =>
    api.post('/api/v1/meetings', data),

  delete: (id: string) => api.delete(`/api/v1/meetings/${id}`),

  getTranscript: (id: string) => api.get(`/api/v1/meetings/${id}/transcript`),

  getSummary: (id: string) => api.get(`/api/v1/meetings/${id}/summary`),

  regenerateSummary: (id: string, forceModel?: 'claude' | 'gpt') =>
    api.post(`/api/v1/meetings/${id}/summary/regenerate`, { forceModel }),

  getActionItems: (id: string) => api.get(`/api/v1/meetings/${id}/action-items`),

  updateActionItem: (
    meetingId: string,
    actionItemId: string,
    data: { completed?: boolean; assignee?: string; dueDate?: string }
  ) => api.patch(`/api/v1/meetings/${meetingId}/action-items/${actionItemId}`, data),

  deleteActionItem: (meetingId: string, actionItemId: string) =>
    api.delete(`/api/v1/meetings/${meetingId}/action-items/${actionItemId}`),
};

// Calendar API methods
export const calendarApi = {
  getConnections: () => api.get('/api/v1/calendar/connections'),
  sync: () => api.post('/api/v1/calendar/sync'),
};

// Insights API methods
export const insightsApi = {
  getTemplates: () => api.get('/api/v1/insights/templates'),
  extract: (meetingId: string, templateIds: string[]) =>
    api.post(`/api/v1/meetings/${meetingId}/insights`, { templateIds }),
};

// Health API
export const healthApi = {
  check: () => api.get('/health'),
};

// API Key types
export interface ApiKeyScope {
  scope: string;
  description: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  usageCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string; // Full key - only returned on creation
}

// API Keys API methods
export const apiKeysApi = {
  list: () => api.get<ApiKey[]>('/api/v1/api-keys'),

  getScopes: () => api.get<ApiKeyScope[]>('/api/v1/api-keys/scopes'),

  create: (data: { name: string; scopes: string[]; expiresInDays?: number }) =>
    api.post<ApiKeyWithSecret>('/api/v1/api-keys', data),

  update: (keyId: string, data: { name?: string; scopes?: string[] }) =>
    api.patch<ApiKey>(`/api/v1/api-keys/${keyId}`, data),

  revoke: (keyId: string) => api.delete(`/api/v1/api-keys/${keyId}`),
};

// Voice Profile types
export interface VoiceProfile {
  id: string;
  organizationId: string;
  displayName: string;
  email: string | null;
  userId: string | null;
  sampleCount: number;
  totalDuration: number;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpeakerIdentification {
  speakerLabel: string;
  displayName: string;
  confidence: number;
  matchMethod: string;
  voiceProfileId: string;
}

// Voice Profiles API methods
export const voiceProfilesApi = {
  list: () => api.get<VoiceProfile[]>('/api/v1/voice-profiles'),

  getById: (id: string) => api.get<VoiceProfile>(`/api/v1/voice-profiles/${id}`),

  create: (data: { displayName: string; email?: string }) =>
    api.post<VoiceProfile>('/api/v1/voice-profiles', data),

  update: (id: string, data: { displayName?: string; email?: string | null }) =>
    api.patch<VoiceProfile>(`/api/v1/voice-profiles/${id}`, data),

  delete: (id: string) => api.delete(`/api/v1/voice-profiles/${id}`),

  merge: (keepId: string, mergeId: string) =>
    api.post<VoiceProfile>('/api/v1/voice-profiles/merge', { keepId, mergeId }),

  getMeetingSpeakers: (meetingId: string) =>
    api.get<SpeakerIdentification[]>(`/api/v1/voice-profiles/meetings/${meetingId}/speakers`),

  reprocessMeeting: (meetingId: string) =>
    api.post(`/api/v1/voice-profiles/meetings/${meetingId}/speakers/reprocess`),

  confirmSpeaker: (meetingId: string, speakerLabel: string, confirmed: boolean) =>
    api.post(`/api/v1/voice-profiles/meetings/${meetingId}/speakers/${encodeURIComponent(speakerLabel)}/confirm`, { confirmed }),
};

// Speaker Aliases API methods
export const speakersApi = {
  list: () => api.get('/api/v1/speakers'),

  upsert: (data: { speakerLabel: string; displayName: string; email?: string }) =>
    api.put('/api/v1/speakers', data),
};

// Audio upload types
export interface PresignedUploadResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresAt: string;
}

export interface AudioUploadResult {
  meetingId: string;
}

// Audio API methods
export const audioApi = {
  /** Get a presigned URL for direct upload to S3 */
  getUploadUrl: (fileName: string, mimeType: string, fileSize: number) =>
    api.post<PresignedUploadResult>('/api/v1/audio/upload-url', {
      fileName,
      mimeType,
      fileSize,
    }),

  /** Finalize an upload after file is uploaded to S3 */
  finalizeUpload: (data: {
    title: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    audioDuration?: number;
  }) => api.post<AudioUploadResult>('/api/v1/audio/finalize', data),

  /** Upload audio file directly (for smaller files) */
  uploadDirect: async (
    file: File,
    title: string,
    duration?: number
  ): Promise<ApiResponse<AudioUploadResult>> => {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('title', title);
    if (duration) formData.append('duration', String(duration));

    try {
      const response = await fetch(`${API_URL}/api/v1/audio/upload`, {
        method: 'POST',
        body: formData,
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: error instanceof Error ? error.message : 'Upload failed',
        },
      };
    }
  },

  /** Upload a browser recording */
  uploadRecording: async (
    blob: Blob,
    title: string,
    duration: number
  ): Promise<ApiResponse<AudioUploadResult>> => {
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');
    formData.append('title', title);
    formData.append('duration', String(duration));

    try {
      const response = await fetch(`${API_URL}/api/v1/audio/recording`, {
        method: 'POST',
        body: formData,
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: error instanceof Error ? error.message : 'Upload failed',
        },
      };
    }
  },
};

// Analytics types
export interface UserDashboardStats {
  totalMeetings: number;
  meetingsThisWeek: number;
  meetingsThisMonth: number;
  totalMeetingHours: number;
  hoursSavedEstimate: number;
  actionItemsCreated: number;
  actionItemsCompleted: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  dailyMeetings: { date: string; count: number }[];
}

export interface ProductivityScore {
  score: number;
  components: {
    meetingEfficiency: number;
    actionItemCompletion: number;
    engagementStreak: number;
  };
  trend: 'up' | 'down' | 'stable';
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  threshold: number;
  points: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
}

export interface OrgAnalyticsStats {
  totalMeetings: number;
  totalUsers: number;
  activeUsers: number;
  meetingsThisMonth: number;
  newUsersThisMonth: number;
  totalMeetingMinutes: number;
  meetingsBySource: { source: string; count: number }[];
  totalCost: number;
  costByCategory: { category: string; amount: number }[];
  dailyMeetings: { date: string; count: number }[];
  dailyActiveUsers: { date: string; count: number }[];
}

// Analytics API methods
export const analyticsApi = {
  /** Get user dashboard statistics */
  getDashboard: () => api.get<UserDashboardStats>('/api/v1/analytics/dashboard'),

  /** Get user productivity score */
  getProductivity: () => api.get<ProductivityScore>('/api/v1/analytics/productivity'),

  /** Get user achievements */
  getAchievements: () => api.get<Achievement[]>('/api/v1/analytics/achievements'),

  /** Check and unlock new achievements */
  checkAchievements: () =>
    api.post<{ newlyUnlocked: Achievement[]; count: number }>(
      '/api/v1/analytics/achievements/check'
    ),

  /** Get organization analytics (admin) */
  getOrgAnalytics: () => api.get<OrgAnalyticsStats>('/api/v1/analytics/organization'),

  /** Track a metric */
  track: (metric: string, increment?: number) =>
    api.post(`/api/v1/analytics/track/${metric}`, { increment }),

  /** Preview weekly digest */
  getDigestPreview: () =>
    api.get<{
      meetingsThisWeek: number;
      actionItemsCompleted: number;
      hoursSaved: number;
      streak: number;
      topAchievement: string | null;
    }>('/api/v1/analytics/digest/preview'),
};

// Chat types
export interface ChatCitation {
  meetingId: string;
  meetingTitle: string;
  timestamp: number | null;
  text: string;
  speaker?: string;
  relevance: number;
}

export interface FileOffer {
  shouldOffer: true;
  formats: ('pdf' | 'docx' | 'md' | 'csv')[];
  suggestedTitle: string;
  description: string;
  contentType: 'summary' | 'action_items' | 'decisions' | 'transcript_excerpt' | 'custom';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitation[];
  fileOffer?: FileOffer;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
  meetingId: string | null;
  meetingTitle?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatResponse {
  message: ChatMessage;
  suggestedFollowups?: string[];
}

export interface ChatSearchResult {
  meetingId: string;
  meetingTitle: string;
  text: string;
  startTime: number;
  speakers: string[];
  similarity: number;
}

// Chat API methods
export const chatApi = {
  /** Create a new chat session */
  createChat: (data?: { meetingId?: string; title?: string }) =>
    api.post<{ chatId: string }>('/api/v1/chat', data || {}),

  /** Get user's chat sessions */
  getChats: (params?: { meetingId?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.meetingId) searchParams.set('meetingId', params.meetingId);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return api.get<ChatSession[]>(`/api/v1/chat${query ? `?${query}` : ''}`);
  },

  /** Get chat history */
  getChatHistory: (chatId: string) =>
    api.get<ChatMessage[]>(`/api/v1/chat/${chatId}`),

  /** Send a message to chat */
  sendMessage: (chatId: string, message: string) =>
    api.post<ChatResponse>(`/api/v1/chat/${chatId}/messages`, { message }),

  /** Delete a chat */
  deleteChat: (chatId: string) =>
    api.delete(`/api/v1/chat/${chatId}`),

  /** Cross-meeting semantic search */
  search: (query: string, options?: { meetingIds?: string[]; limit?: number }) =>
    api.post<ChatSearchResult[]>('/api/v1/chat/search', {
      query,
      ...options,
    }),

  /** Get suggested questions for a meeting */
  getSuggestions: (meetingId: string) =>
    api.get<string[]>(`/api/v1/chat/meetings/${meetingId}/suggestions`),
};

// Settings types
export interface NotificationPreferences {
  emailMeetingReady: boolean;
  emailActionItemReminder: boolean;
  emailWeeklyDigest: boolean;
  emailMeetingShared: boolean;
  emailPaymentAlerts: boolean;
  actionItemReminderDays: number;
}

export interface OrganizationSettings {
  recordingConsentEnabled: boolean;
  consentAnnouncementText: string | null;
  requireExplicitConsent: boolean;
  defaultBotName: string;
  joinAnnouncementEnabled: boolean;
}

export interface UsageMetric {
  current: number;
  limit: number;
  percentage: number;
}

export interface UsageSummary {
  period: string;
  usage: {
    meetings: UsageMetric;
    minutes: UsageMetric;
    storage: UsageMetric;
    chat: UsageMetric;
  };
  plan: string;
}

// Settings API methods
export const settingsApi = {
  /** Get notification preferences */
  getNotifications: () =>
    api.get<NotificationPreferences>('/api/v1/settings/notifications'),

  /** Update notification preferences */
  updateNotifications: (data: Partial<NotificationPreferences>) =>
    api.patch<NotificationPreferences>('/api/v1/settings/notifications', data),

  /** Get organization settings */
  getOrganization: () =>
    api.get<OrganizationSettings>('/api/v1/settings/organization'),

  /** Update organization settings (admin only) */
  updateOrganization: (data: Partial<OrganizationSettings>) =>
    api.patch<OrganizationSettings>('/api/v1/settings/organization', data),

  /** Get usage quota summary */
  getUsage: () => api.get<UsageSummary>('/api/v1/settings/usage'),
};

// Data Export types
export interface DataExportRequest {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  includeAudio: boolean;
  downloadUrl: string | null;
  expiresAt: string | null;
  sizeBytes: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

// Data Export API methods
export const dataExportApi = {
  /** List export requests */
  list: () => api.get<DataExportRequest[]>('/api/v1/data-export'),

  /** Request new data export */
  create: (options?: { includeAudio?: boolean }) =>
    api.post<DataExportRequest>('/api/v1/data-export', options || {}),

  /** Get export status */
  getById: (exportId: string) =>
    api.get<DataExportRequest>(`/api/v1/data-export/${exportId}`),
};

// Meeting Share types
export interface MeetingShare {
  id: string;
  shareType: 'link' | 'email' | 'team';
  accessLevel: 'view' | 'comment' | 'edit';
  recipientEmail: string | null;
  recipientName: string | null;
  shareUrl: string | null;
  hasPassword: boolean;
  expiresAt: string | null;
  maxViews: number | null;
  viewCount: number;
  includeTranscript: boolean;
  includeSummary: boolean;
  includeActionItems: boolean;
  includeRecording: boolean;
  message: string | null;
  sharedBy: { id: string; name: string | null; email: string };
  createdAt: string;
  lastAccessedAt: string | null;
}

export interface CreateShareOptions {
  meetingId: string;
  shareType: 'link' | 'email';
  accessLevel?: 'view' | 'comment';
  recipientEmail?: string;
  recipientName?: string;
  password?: string;
  expiresInDays?: number;
  maxViews?: number;
  includeTranscript?: boolean;
  includeSummary?: boolean;
  includeActionItems?: boolean;
  includeRecording?: boolean;
  message?: string;
}

// Sharing API methods
export const sharingApi = {
  /** List shares for a meeting */
  listShares: (meetingId: string) =>
    api.get<MeetingShare[]>(`/api/v1/sharing/meetings/${meetingId}`),

  /** Create a new share */
  create: (options: CreateShareOptions) =>
    api.post<MeetingShare>('/api/v1/sharing', options),

  /** Update a share */
  update: (
    shareId: string,
    data: Partial<{
      accessLevel: 'view' | 'comment';
      password: string | null;
      expiresAt: string | null;
      maxViews: number | null;
      includeTranscript: boolean;
      includeSummary: boolean;
      includeActionItems: boolean;
      includeRecording: boolean;
    }>
  ) => api.patch<MeetingShare>(`/api/v1/sharing/${shareId}`, data),

  /** Revoke a share */
  revoke: (shareId: string) => api.delete(`/api/v1/sharing/${shareId}`),
};

// Meeting Export types
export interface MeetingExportOptions {
  format: 'pdf' | 'docx' | 'srt' | 'txt' | 'json';
  includeTranscript?: boolean;
  includeSummary?: boolean;
  includeActionItems?: boolean;
  includeSpeakerNames?: boolean;
  includeTimestamps?: boolean;
}

// Meeting Export API methods
export const meetingExportApi = {
  /** Export meeting in specified format */
  export: async (
    meetingId: string,
    options: MeetingExportOptions
  ): Promise<Blob> => {
    const response = await fetch(
      `${API_URL}/api/v1/meetings/${meetingId}/export`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      }
    );

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  },
};

// Document Generation types
export interface GeneratedDocument {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  expiresAt: string;
  mimeType: string;
}

// Document Generation API methods
export const documentsApi = {
  /** Generate a document from content */
  generate: (options: {
    content: string;
    format: 'pdf' | 'docx' | 'md' | 'csv';
    title: string;
    meetingId?: string;
    contentType?: 'summary' | 'action_items' | 'decisions' | 'transcript_excerpt' | 'custom';
  }) => api.post<GeneratedDocument>('/api/v1/documents/generate', options),
};

// ============================================================
// Phase 12: Team Collaboration API
// ============================================================

// Comment types
export interface CommentUser {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface CommentMention {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface CommentReaction {
  emoji: string;
  count: number;
  users: Array<{ id: string; name: string | null }>;
  hasReacted: boolean;
}

export interface Comment {
  id: string;
  meetingId: string;
  userId: string;
  content: string;
  segmentId: string | null;
  timestamp: number | null;
  parentId: string | null;
  isEdited: boolean;
  isResolved: boolean;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: CommentUser;
  mentions: CommentMention[];
  reactions: CommentReaction[];
  replyCount: number;
}

// Comments API methods
export const commentsApi = {
  /** Get comments for a meeting */
  getComments: (meetingId: string, options?: { segmentId?: string; parentId?: string }) => {
    const params = new URLSearchParams();
    if (options?.segmentId) params.set('segmentId', options.segmentId);
    if (options?.parentId) params.set('parentId', options.parentId);
    const query = params.toString();
    return api.get<Comment[]>(`/api/v1/meetings/${meetingId}/comments${query ? `?${query}` : ''}`);
  },

  /** Get a single comment */
  getById: (commentId: string) => api.get<Comment>(`/api/v1/comments/${commentId}`),

  /** Get replies to a comment */
  getReplies: (commentId: string) => api.get<Comment[]>(`/api/v1/comments/${commentId}/replies`),

  /** Create a new comment */
  create: (
    meetingId: string,
    data: {
      content: string;
      segmentId?: string;
      timestamp?: number;
      parentId?: string;
      mentionedUserIds?: string[];
    }
  ) => api.post<Comment>(`/api/v1/meetings/${meetingId}/comments`, data),

  /** Update a comment */
  update: (commentId: string, data: { content: string; mentionedUserIds?: string[] }) =>
    api.patch<Comment>(`/api/v1/comments/${commentId}`, data),

  /** Delete a comment */
  delete: (commentId: string) => api.delete(`/api/v1/comments/${commentId}`),

  /** Resolve a comment thread */
  resolve: (commentId: string) => api.post<Comment>(`/api/v1/comments/${commentId}/resolve`),

  /** Unresolve a comment thread */
  unresolve: (commentId: string) => api.post<Comment>(`/api/v1/comments/${commentId}/unresolve`),

  /** Add a reaction */
  addReaction: (commentId: string, emoji: string) =>
    api.post(`/api/v1/comments/${commentId}/reactions`, { emoji }),

  /** Remove a reaction */
  removeReaction: (commentId: string, emoji: string) =>
    api.delete(`/api/v1/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`),
};

// Annotation types
export type AnnotationLabel =
  | 'HIGHLIGHT'
  | 'ACTION_ITEM'
  | 'DECISION'
  | 'QUESTION'
  | 'IMPORTANT'
  | 'FOLLOW_UP'
  | 'BLOCKER'
  | 'IDEA';

export interface AnnotationUser {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface Annotation {
  id: string;
  meetingId: string;
  userId: string;
  startTime: number;
  endTime: number;
  segmentIds: string[];
  text: string | null;
  label: AnnotationLabel;
  color: string;
  createdAt: string;
  updatedAt: string;
  user: AnnotationUser;
}

export interface AnnotationLabelInfo {
  value: AnnotationLabel;
  label: string;
  color: string;
}

// Annotations API methods
export const annotationsApi = {
  /** Get annotations for a meeting */
  getAnnotations: (meetingId: string, options?: { label?: AnnotationLabel; userId?: string }) => {
    const params = new URLSearchParams();
    if (options?.label) params.set('label', options.label);
    if (options?.userId) params.set('userId', options.userId);
    const query = params.toString();
    return api.get<Annotation[]>(`/api/v1/meetings/${meetingId}/annotations${query ? `?${query}` : ''}`);
  },

  /** Get annotations in a time range */
  getInRange: (meetingId: string, startTime: number, endTime: number) =>
    api.get<Annotation[]>(
      `/api/v1/meetings/${meetingId}/annotations/range?startTime=${startTime}&endTime=${endTime}`
    ),

  /** Get annotation statistics */
  getStats: (meetingId: string) =>
    api.get<{
      total: number;
      byLabel: Record<AnnotationLabel, number>;
      byUser: Array<{ userId: string; name: string | null; count: number }>;
    }>(`/api/v1/meetings/${meetingId}/annotations/stats`),

  /** Get available labels */
  getLabels: () => api.get<AnnotationLabelInfo[]>('/api/v1/annotations/labels'),

  /** Get a single annotation */
  getById: (annotationId: string) => api.get<Annotation>(`/api/v1/annotations/${annotationId}`),

  /** Create an annotation */
  create: (
    meetingId: string,
    data: {
      startTime: number;
      endTime: number;
      segmentIds: string[];
      text?: string;
      label?: AnnotationLabel;
      color?: string;
    }
  ) => api.post<Annotation>(`/api/v1/meetings/${meetingId}/annotations`, data),

  /** Update an annotation */
  update: (
    annotationId: string,
    data: { text?: string; label?: AnnotationLabel; color?: string }
  ) => api.patch<Annotation>(`/api/v1/annotations/${annotationId}`, data),

  /** Delete an annotation */
  delete: (annotationId: string) => api.delete(`/api/v1/annotations/${annotationId}`),
};

// Notification types
export type NotificationType =
  | 'MEETING_READY'
  | 'MEETING_SHARED'
  | 'MENTION'
  | 'REPLY'
  | 'COMMENT_ADDED'
  | 'ANNOTATION_ADDED'
  | 'ACTION_ITEM_DUE'
  | 'PERMISSION_CHANGED'
  | 'SYSTEM';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  meetingId: string | null;
  commentId: string | null;
  read: boolean;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  meeting?: {
    id: string;
    title: string;
  } | null;
}

// Notifications API methods
export const notificationsApi = {
  /** Get notifications */
  getNotifications: (options?: { read?: boolean; type?: NotificationType; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (options?.read !== undefined) params.set('read', String(options.read));
    if (options?.type) params.set('type', options.type);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const query = params.toString();
    return api.get<Notification[]>(`/api/v1/notifications${query ? `?${query}` : ''}`);
  },

  /** Get unread count */
  getUnreadCount: () => api.get<{ count: number }>('/api/v1/notifications/unread-count'),

  /** Mark as read */
  markAsRead: (notificationId: string) =>
    api.post<Notification>(`/api/v1/notifications/${notificationId}/read`),

  /** Mark all as read */
  markAllAsRead: () => api.post<{ markedCount: number }>('/api/v1/notifications/mark-all-read'),

  /** Delete a notification */
  delete: (notificationId: string) => api.delete(`/api/v1/notifications/${notificationId}`),

  /** Delete all notifications */
  deleteAll: () => api.delete<{ deletedCount: number }>('/api/v1/notifications'),
};

// Activity types
export type ActivityAction =
  | 'MEETING_CREATED'
  | 'MEETING_UPDATED'
  | 'MEETING_SHARED'
  | 'MEETING_VIEWED'
  | 'COMMENT_ADDED'
  | 'COMMENT_REPLIED'
  | 'COMMENT_RESOLVED'
  | 'ANNOTATION_ADDED'
  | 'ANNOTATION_UPDATED'
  | 'MEMBER_JOINED'
  | 'PERMISSION_CHANGED';

export interface Activity {
  id: string;
  userId: string;
  organizationId: string;
  action: ActivityAction;
  meetingId: string | null;
  commentId: string | null;
  annotationId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl: string | null;
  };
  meeting?: {
    id: string;
    title: string;
  } | null;
  formattedMessage?: string;
}

// Activity API methods
export const activityApi = {
  /** Get activity feed */
  getFeed: (options?: {
    meetingId?: string;
    userId?: string;
    action?: ActivityAction;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (options?.meetingId) params.set('meetingId', options.meetingId);
    if (options?.userId) params.set('userId', options.userId);
    if (options?.action) params.set('action', options.action);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const query = params.toString();
    return api.get<Activity[]>(`/api/v1/activity${query ? `?${query}` : ''}`);
  },

  /** Get activity summary */
  getSummary: (hours?: number) =>
    api.get<{
      total: number;
      byAction: Record<ActivityAction, number>;
      byUser: Array<{ userId: string; name: string | null; count: number }>;
      recentMeetings: Array<{ meetingId: string; title: string; activityCount: number }>;
    }>(`/api/v1/activity/summary${hours ? `?hours=${hours}` : ''}`),

  /** Get meeting activity */
  getMeetingActivity: (meetingId: string, options?: { limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const query = params.toString();
    return api.get<Activity[]>(`/api/v1/activity/meetings/${meetingId}${query ? `?${query}` : ''}`);
  },
};
