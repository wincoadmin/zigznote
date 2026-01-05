/**
 * Admin API client
 * Handles all API calls from the admin panel
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

class AdminApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || { code: 'UNKNOWN', message: 'Request failed' },
      };
    }

    return { success: true, data: data.data || data };
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

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const adminApi = new AdminApiClient(`${API_BASE}/api/admin`);

// Auth endpoints
export const authApi = {
  login: (email: string, password: string) =>
    adminApi.post<{ requiresTwoFactor?: boolean }>('/auth/login', { email, password }),

  verify2fa: (email: string, code: string) =>
    adminApi.post('/auth/verify-2fa', { email, code }),

  logout: () => adminApi.post('/auth/logout'),

  me: () => adminApi.get<{ user: { id: string; email: string; name: string; role: string } }>('/auth/me'),

  setup2fa: () =>
    adminApi.post<{ secret: string; qrCode: string }>('/auth/setup-2fa'),

  enable2fa: (code: string) =>
    adminApi.post<{ backupCodes: string[] }>('/auth/enable-2fa', { code }),

  disable2fa: (code: string) =>
    adminApi.post('/auth/disable-2fa', { code }),
};

// Users endpoints
export const usersApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    adminApi.get(`/users?${new URLSearchParams(params as Record<string, string>).toString()}`),

  get: (id: string) => adminApi.get(`/users/${id}`),

  create: (data: { email: string; name: string; organizationId: string }) =>
    adminApi.post('/users', data),

  update: (id: string, data: unknown) => adminApi.patch(`/users/${id}`, data),

  delete: (id: string) => adminApi.delete(`/users/${id}`),

  impersonate: (id: string) => adminApi.post(`/users/${id}/impersonate`),
};

// Organizations endpoints
export const organizationsApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    adminApi.get(`/organizations?${new URLSearchParams(params as Record<string, string>).toString()}`),

  get: (id: string) => adminApi.get(`/organizations/${id}`),

  update: (id: string, data: unknown) => adminApi.patch(`/organizations/${id}`, data),

  setBillingOverride: (id: string, data: { accountType: string; reason?: string }) =>
    adminApi.post(`/organizations/${id}/billing-override`, data),
};

// API Keys endpoints
export const apiKeysApi = {
  list: (params?: { page?: number; limit?: number }) =>
    adminApi.get(`/api-keys?${new URLSearchParams(params as Record<string, string>).toString()}`),

  get: (id: string) => adminApi.get(`/api-keys/${id}`),

  create: (data: { name: string; provider: string; key: string; environment?: string }) =>
    adminApi.post('/api-keys', data),

  update: (id: string, data: unknown) => adminApi.patch(`/api-keys/${id}`, data),

  delete: (id: string) => adminApi.delete(`/api-keys/${id}`),

  rotate: (id: string, newKey: string) =>
    adminApi.post(`/api-keys/${id}/rotate`, { newKey }),
};

// Feature flags endpoints
export const featureFlagsApi = {
  list: () => adminApi.get('/feature-flags'),

  get: (id: string) => adminApi.get(`/feature-flags/${id}`),

  create: (data: { key: string; name: string; enabled?: boolean }) =>
    adminApi.post('/feature-flags', data),

  update: (id: string, data: unknown) => adminApi.patch(`/feature-flags/${id}`, data),

  toggle: (id: string) => adminApi.post(`/feature-flags/${id}/toggle`),

  delete: (id: string) => adminApi.delete(`/feature-flags/${id}`),
};

// System config endpoints
export const systemConfigApi = {
  list: () => adminApi.get('/system/config'),

  get: (key: string) => adminApi.get(`/system/config/${key}`),

  set: (key: string, value: unknown) =>
    adminApi.put(`/system/config/${key}`, { value }),

  delete: (key: string) => adminApi.delete(`/system/config/${key}`),
};

// Audit logs endpoints
export const auditLogsApi = {
  list: (params?: { page?: number; limit?: number; action?: string; entityType?: string }) =>
    adminApi.get(`/audit-logs?${new URLSearchParams(params as Record<string, string>).toString()}`),

  get: (id: string) => adminApi.get(`/audit-logs/${id}`),

  getForEntity: (entityType: string, entityId: string) =>
    adminApi.get(`/audit-logs/entity/${entityType}/${entityId}`),
};

// Analytics endpoints
export const analyticsApi = {
  overview: () => adminApi.get('/analytics/overview'),

  users: (period?: string) =>
    adminApi.get(`/analytics/users?period=${period || '30d'}`),

  revenue: (period?: string) =>
    adminApi.get(`/analytics/revenue?period=${period || '30d'}`),

  usage: (period?: string) =>
    adminApi.get(`/analytics/usage?period=${period || '30d'}`),
};

// Operations endpoints
export const operationsApi = {
  health: () => adminApi.get('/operations/health'),

  queues: () => adminApi.get('/operations/queues'),

  jobs: (queueName: string) => adminApi.get(`/operations/queues/${queueName}/jobs`),

  retryJob: (queueName: string, jobId: string) =>
    adminApi.post(`/operations/queues/${queueName}/jobs/${jobId}/retry`),
};
