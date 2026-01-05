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
