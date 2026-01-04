/**
 * Mock for @zigznote/database package
 */

// In-memory store for test data
let meetingsStore: Map<string, MockMeeting> = new Map();
let transcriptsStore: Map<string, MockTranscript> = new Map();
let summariesStore: Map<string, MockSummary> = new Map();
let actionItemsStore: Map<string, MockActionItem> = new Map();
let idCounter = 1;

interface MockMeeting {
  id: string;
  organizationId: string;
  createdById: string | null;
  title: string;
  platform: string | null;
  meetingUrl: string | null;
  recordingUrl: string | null;
  startTime: Date | null;
  endTime: Date | null;
  durationSeconds: number | null;
  status: string;
  botId: string | null;
  calendarEventId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface MockTranscript {
  id: string;
  meetingId: string;
  segments: Record<string, unknown>[];
  fullText: string;
  wordCount: number;
  language: string;
  createdAt: Date;
}

interface MockSummary {
  id: string;
  meetingId: string;
  content: Record<string, unknown>;
  modelUsed: string;
  promptVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockActionItem {
  id: string;
  meetingId: string;
  text: string;
  assignee: string | null;
  dueDate: Date | null;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function generateId(): string {
  return `test-id-${idCounter++}`;
}

export const meetingRepository = {
  findById: jest.fn(async (id: string) => {
    const meeting = meetingsStore.get(id);
    // Don't return soft-deleted meetings
    if (meeting && meeting.deletedAt) return null;
    return meeting || null;
  }),

  findByBotId: jest.fn(async (_botId: string) => {
    return Array.from(meetingsStore.values()).find((m) => m.botId === _botId) || null;
  }),

  findManyPaginated: jest.fn(async (options?: { page?: number; limit?: number }) => {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const all = Array.from(meetingsStore.values()).filter((m) => !m.deletedAt);
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total: all.length,
        totalPages: Math.ceil(all.length / limit),
        hasMore: start + limit < all.length,
      },
    };
  }),

  findUpcoming: jest.fn(async () => {
    // Returns array, not paginated result
    return [];
  }),

  findRecentCompleted: jest.fn(async () => {
    // Returns array, not paginated result
    return [];
  }),

  create: jest.fn(async (data: Partial<MockMeeting>) => {
    const now = new Date();
    const meeting: MockMeeting = {
      id: generateId(),
      organizationId: data.organizationId || 'test-org-id',
      createdById: data.createdById || null,
      title: data.title || 'Untitled Meeting',
      platform: data.platform || null,
      meetingUrl: data.meetingUrl || null,
      recordingUrl: data.recordingUrl || null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      durationSeconds: data.durationSeconds || null,
      status: data.status || 'scheduled',
      botId: data.botId || null,
      calendarEventId: data.calendarEventId || null,
      metadata: data.metadata || null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    meetingsStore.set(meeting.id, meeting);
    return meeting;
  }),

  update: jest.fn(async (id: string, data: Partial<MockMeeting>) => {
    const meeting = meetingsStore.get(id);
    if (!meeting) return null;

    const updated = {
      ...meeting,
      ...data,
      updatedAt: new Date(),
    };
    meetingsStore.set(id, updated);
    return updated;
  }),

  updateStatus: jest.fn(async (id: string, status: string) => {
    const meeting = meetingsStore.get(id);
    if (!meeting) return null;

    meeting.status = status;
    meeting.updatedAt = new Date();
    return meeting;
  }),

  softDelete: jest.fn(async (id: string) => {
    const meeting = meetingsStore.get(id);
    if (!meeting) return null;

    meeting.deletedAt = new Date();
    meeting.updatedAt = new Date();
    return meeting;
  }),

  hardDelete: jest.fn(async (id: string) => {
    const meeting = meetingsStore.get(id);
    if (!meeting) return false;

    meetingsStore.delete(id);
    return true;
  }),

  restore: jest.fn(async (id: string) => {
    const meeting = meetingsStore.get(id);
    if (!meeting) return null;

    meeting.deletedAt = null;
    meeting.updatedAt = new Date();
    return meeting;
  }),

  addParticipants: jest.fn(async () => undefined),

  getStats: jest.fn(async () => ({
    total: meetingsStore.size,
    byStatus: {
      scheduled: 0,
      in_progress: 0,
      completed: 0,
    },
    byPlatform: {},
    totalDurationSeconds: 0,
    averageDurationSeconds: 0,
  })),
};

// Split repositories for new governance structure
export const meetingQueryRepository = {
  findByOrganization: jest.fn(async (organizationId: string, options?: { page?: number; limit?: number }) => {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const all = Array.from(meetingsStore.values()).filter((m) => !m.deletedAt && m.organizationId === organizationId);
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total: all.length,
        totalPages: Math.ceil(all.length / limit),
        hasMore: start + limit < all.length,
      },
    };
  }),

  findManyPaginated: jest.fn(async (options?: { page?: number; limit?: number }) => {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const all = Array.from(meetingsStore.values()).filter((m) => !m.deletedAt);
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total: all.length,
        totalPages: Math.ceil(all.length / limit),
        hasMore: start + limit < all.length,
      },
    };
  }),

  findUpcoming: jest.fn(async () => []),

  findRecentCompleted: jest.fn(async () => []),

  findMany: jest.fn(async () => Array.from(meetingsStore.values()).filter((m) => !m.deletedAt)),

  count: jest.fn(async () => meetingsStore.size),

  buildWhereClause: jest.fn(() => ({})),
};

export const meetingStatsRepository = {
  getStats: jest.fn(async () => ({
    total: meetingsStore.size,
    byStatus: {
      scheduled: 0,
      in_progress: 0,
      completed: 0,
    },
    totalDuration: 0,
    thisWeek: 0,
    thisMonth: 0,
  })),

  getAnalytics: jest.fn(async () => ({
    totalMeetings: meetingsStore.size,
    totalDurationMinutes: 0,
    averageDurationMinutes: 0,
    meetingsByPlatform: {},
    meetingsByStatus: {},
    meetingsPerWeek: [],
  })),

  getCountByDateRange: jest.fn(async () => 0),
};

export const transcriptRepository = {
  findByMeetingId: jest.fn(async (meetingId: string) => {
    return Array.from(transcriptsStore.values()).find((t) => t.meetingId === meetingId) || null;
  }),

  create: jest.fn(async (data: Partial<MockTranscript>) => {
    const transcript: MockTranscript = {
      id: generateId(),
      meetingId: data.meetingId || '',
      segments: data.segments || [],
      fullText: data.fullText || '',
      wordCount: data.wordCount || 0,
      language: data.language || 'en',
      createdAt: new Date(),
    };
    transcriptsStore.set(transcript.id, transcript);
    return transcript;
  }),

  update: jest.fn(async (id: string, data: Partial<MockTranscript>) => {
    const transcript = transcriptsStore.get(id);
    if (!transcript) return null;

    const updated = { ...transcript, ...data };
    transcriptsStore.set(id, updated);
    return updated;
  }),

  delete: jest.fn(async (id: string) => {
    return transcriptsStore.delete(id);
  }),

  search: jest.fn(async () => []),

  findSummaryByMeetingId: jest.fn(async (meetingId: string) => {
    return Array.from(summariesStore.values()).find((s) => s.meetingId === meetingId) || null;
  }),

  createSummary: jest.fn(async (data: Partial<MockSummary>) => {
    const summary: MockSummary = {
      id: generateId(),
      meetingId: data.meetingId || '',
      content: data.content || {},
      modelUsed: data.modelUsed || 'test-model',
      promptVersion: data.promptVersion || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    summariesStore.set(summary.id, summary);
    return summary;
  }),

  updateSummary: jest.fn(async (id: string, data: Partial<MockSummary>) => {
    const summary = summariesStore.get(id);
    if (!summary) return null;

    const updated = { ...summary, ...data, updatedAt: new Date() };
    summariesStore.set(id, updated);
    return updated;
  }),

  findActionItemsByMeetingId: jest.fn(async (meetingId: string) => {
    return Array.from(actionItemsStore.values()).filter((a) => a.meetingId === meetingId);
  }),

  createActionItem: jest.fn(async (data: Partial<MockActionItem>) => {
    const item: MockActionItem = {
      id: generateId(),
      meetingId: data.meetingId || '',
      text: data.text || '',
      assignee: data.assignee || null,
      dueDate: data.dueDate || null,
      completed: data.completed || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    actionItemsStore.set(item.id, item);
    return item;
  }),

  updateActionItem: jest.fn(async (id: string, data: Partial<MockActionItem>) => {
    const item = actionItemsStore.get(id);
    if (!item) return null;

    const updated = { ...item, ...data, updatedAt: new Date() };
    actionItemsStore.set(id, updated);
    return updated;
  }),

  deleteActionItem: jest.fn(async (id: string) => {
    return actionItemsStore.delete(id);
  }),
};

// Split repositories for summaries and action items
export const summaryRepository = {
  findByMeetingId: jest.fn(async (meetingId: string) => {
    return Array.from(summariesStore.values()).find((s) => s.meetingId === meetingId) || null;
  }),

  findById: jest.fn(async (id: string) => {
    return summariesStore.get(id) || null;
  }),

  create: jest.fn(async (data: Partial<MockSummary>) => {
    const summary: MockSummary = {
      id: generateId(),
      meetingId: data.meetingId || '',
      content: data.content || {},
      modelUsed: data.modelUsed || 'test-model',
      promptVersion: data.promptVersion || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    summariesStore.set(summary.id, summary);
    return summary;
  }),

  update: jest.fn(async (meetingId: string, data: Partial<MockSummary>) => {
    const summary = Array.from(summariesStore.values()).find((s) => s.meetingId === meetingId);
    if (!summary) return null;

    const updated = { ...summary, ...data, updatedAt: new Date() };
    summariesStore.set(summary.id, updated);
    return updated;
  }),

  upsert: jest.fn(async (data: Partial<MockSummary>) => {
    const existing = Array.from(summariesStore.values()).find((s) => s.meetingId === data.meetingId);
    if (existing) {
      const updated = { ...existing, ...data, updatedAt: new Date() };
      summariesStore.set(existing.id, updated);
      return updated;
    }
    const summary: MockSummary = {
      id: generateId(),
      meetingId: data.meetingId || '',
      content: data.content || {},
      modelUsed: data.modelUsed || 'test-model',
      promptVersion: data.promptVersion || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    summariesStore.set(summary.id, summary);
    return summary;
  }),

  delete: jest.fn(async (meetingId: string) => {
    const summary = Array.from(summariesStore.values()).find((s) => s.meetingId === meetingId);
    if (summary) summariesStore.delete(summary.id);
  }),

  exists: jest.fn(async (meetingId: string) => {
    return Array.from(summariesStore.values()).some((s) => s.meetingId === meetingId);
  }),
};

export const actionItemRepository = {
  findByMeetingId: jest.fn(async (meetingId: string) => {
    return Array.from(actionItemsStore.values()).filter((a) => a.meetingId === meetingId);
  }),

  findById: jest.fn(async (id: string) => {
    return actionItemsStore.get(id) || null;
  }),

  findByAssignee: jest.fn(async () => ({
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
  })),

  findPending: jest.fn(async () => []),

  findOverdue: jest.fn(async () => []),

  create: jest.fn(async (data: Partial<MockActionItem>) => {
    const item: MockActionItem = {
      id: generateId(),
      meetingId: data.meetingId || '',
      text: data.text || '',
      assignee: data.assignee || null,
      dueDate: data.dueDate || null,
      completed: data.completed || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    actionItemsStore.set(item.id, item);
    return item;
  }),

  createMany: jest.fn(async (items: Partial<MockActionItem>[]) => {
    return items.map((data) => {
      const item: MockActionItem = {
        id: generateId(),
        meetingId: data.meetingId || '',
        text: data.text || '',
        assignee: data.assignee || null,
        dueDate: data.dueDate || null,
        completed: data.completed || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      actionItemsStore.set(item.id, item);
      return item;
    });
  }),

  update: jest.fn(async (id: string, data: Partial<MockActionItem>) => {
    const item = actionItemsStore.get(id);
    if (!item) return null;

    const updated = { ...item, ...data, updatedAt: new Date() };
    actionItemsStore.set(id, updated);
    return updated;
  }),

  complete: jest.fn(async (id: string) => {
    const item = actionItemsStore.get(id);
    if (!item) return null;

    item.completed = true;
    item.updatedAt = new Date();
    return item;
  }),

  uncomplete: jest.fn(async (id: string) => {
    const item = actionItemsStore.get(id);
    if (!item) return null;

    item.completed = false;
    item.updatedAt = new Date();
    return item;
  }),

  delete: jest.fn(async (id: string) => {
    actionItemsStore.delete(id);
  }),

  deleteByMeetingId: jest.fn(async (meetingId: string) => {
    const items = Array.from(actionItemsStore.entries()).filter(([, v]) => v.meetingId === meetingId);
    items.forEach(([k]) => actionItemsStore.delete(k));
  }),

  getStats: jest.fn(async () => ({
    total: actionItemsStore.size,
    completed: 0,
    pending: actionItemsStore.size,
    overdue: 0,
  })),
};

export const prisma = {
  $queryRaw: jest.fn(async () => [{ '?column?': 1 }]),
  $connect: jest.fn(async () => undefined),
  $disconnect: jest.fn(async () => undefined),
};

// Reset function for tests
export function __resetMocks() {
  meetingsStore.clear();
  transcriptsStore.clear();
  summariesStore.clear();
  actionItemsStore.clear();
  idCounter = 1;

  jest.clearAllMocks();
}

// Export for access in tests
export const __stores = {
  meetings: meetingsStore,
  transcripts: transcriptsStore,
  summaries: summariesStore,
  actionItems: actionItemsStore,
};
