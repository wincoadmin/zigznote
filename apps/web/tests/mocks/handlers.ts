import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3001/api';

// Mock data factories
export const createMockMeeting = (overrides = {}) => ({
  id: 'meeting-1',
  title: 'Weekly Standup',
  status: 'completed',
  platform: 'zoom',
  startTime: '2026-01-05T10:00:00Z',
  endTime: '2026-01-05T11:00:00Z',
  durationSeconds: 3600,
  recordingUrl: 'https://example.com/recording.mp3',
  participants: [
    { id: 'p1', name: 'John Doe', email: 'john@example.com' },
    { id: 'p2', name: 'Jane Smith', email: 'jane@example.com' },
  ],
  organizationId: 'org-1',
  createdById: 'user-1',
  createdAt: '2026-01-05T09:00:00Z',
  updatedAt: '2026-01-05T11:00:00Z',
  ...overrides,
});

export const createMockTranscript = (meetingId: string, overrides = {}) => ({
  id: 'transcript-1',
  meetingId,
  segments: [
    {
      id: 'seg-1',
      speaker: 'John Doe',
      text: 'Hello everyone, lets get started with the standup.',
      startMs: 0,
      endMs: 5000,
      confidence: 0.95,
    },
    {
      id: 'seg-2',
      speaker: 'Jane Smith',
      text: 'Sure! I worked on the dashboard yesterday.',
      startMs: 5000,
      endMs: 10000,
      confidence: 0.92,
    },
    {
      id: 'seg-3',
      speaker: 'John Doe',
      text: 'Great progress. Any blockers?',
      startMs: 10000,
      endMs: 15000,
      confidence: 0.98,
    },
  ],
  createdAt: '2026-01-05T11:00:00Z',
  updatedAt: '2026-01-05T11:00:00Z',
  ...overrides,
});

export const createMockSummary = (meetingId: string, overrides = {}) => ({
  id: 'summary-1',
  meetingId,
  content: {
    executiveSummary: 'The team discussed progress on the dashboard and upcoming features. No blockers were identified.',
    topics: [
      { title: 'Dashboard Progress', summary: 'Jane completed the main dashboard layout.' },
      { title: 'Next Steps', summary: 'Focus on testing and documentation.' },
    ],
    decisions: [
      'Proceed with the current design approach',
      'Schedule a demo for Friday',
    ],
  },
  modelUsed: 'claude-3-sonnet',
  createdAt: '2026-01-05T11:05:00Z',
  updatedAt: '2026-01-05T11:05:00Z',
  ...overrides,
});

export const createMockActionItems = (meetingId: string) => [
  {
    id: 'action-1',
    meetingId,
    text: 'Complete the testing suite',
    assignee: 'Jane Smith',
    dueDate: '2026-01-10',
    completed: false,
    createdAt: '2026-01-05T11:05:00Z',
    updatedAt: '2026-01-05T11:05:00Z',
  },
  {
    id: 'action-2',
    meetingId,
    text: 'Update documentation',
    assignee: 'John Doe',
    dueDate: '2026-01-08',
    completed: true,
    createdAt: '2026-01-05T11:05:00Z',
    updatedAt: '2026-01-05T11:06:00Z',
  },
];

export const createMockStats = () => ({
  totalMeetings: 42,
  totalHours: 56.5,
  actionItemsCompleted: 128,
  actionItemsPending: 15,
});

// Default handlers
export const handlers = [
  // Health check
  http.get(`${API_URL}/health`, () => {
    return HttpResponse.json({ status: 'healthy', timestamp: new Date().toISOString() });
  }),

  // Meetings list
  http.get(`${API_URL}/meetings`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    let meetings = [
      createMockMeeting({ id: 'meeting-1', title: 'Weekly Standup', status: 'completed' }),
      createMockMeeting({ id: 'meeting-2', title: 'Product Review', status: 'processing' }),
      createMockMeeting({ id: 'meeting-3', title: 'Client Call', status: 'scheduled', startTime: '2026-01-06T14:00:00Z' }),
    ];

    if (status) {
      meetings = meetings.filter((m) => m.status === status);
    }

    return HttpResponse.json({
      success: true,
      data: meetings.slice(0, limit),
      pagination: {
        total: meetings.length,
        page: 1,
        limit,
        totalPages: 1,
      },
    });
  }),

  // Meeting by ID
  http.get(`${API_URL}/meetings/:id`, ({ params }) => {
    const { id } = params;
    if (id === 'not-found') {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Meeting not found' } },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      success: true,
      data: createMockMeeting({ id: id as string }),
    });
  }),

  // Recent meetings
  http.get(`${API_URL}/meetings/recent`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        createMockMeeting({ id: 'recent-1', title: 'Morning Sync', status: 'completed' }),
        createMockMeeting({ id: 'recent-2', title: 'Design Review', status: 'completed' }),
      ],
    });
  }),

  // Upcoming meetings
  http.get(`${API_URL}/meetings/upcoming`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        createMockMeeting({
          id: 'upcoming-1',
          title: 'Sprint Planning',
          status: 'scheduled',
          startTime: '2026-01-06T09:00:00Z',
        }),
      ],
    });
  }),

  // Meeting stats
  http.get(`${API_URL}/meetings/stats`, () => {
    return HttpResponse.json({
      success: true,
      data: createMockStats(),
    });
  }),

  // Transcript
  http.get(`${API_URL}/meetings/:id/transcript`, ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      success: true,
      data: createMockTranscript(id as string),
    });
  }),

  // Summary
  http.get(`${API_URL}/meetings/:id/summary`, ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      success: true,
      data: createMockSummary(id as string),
    });
  }),

  // Regenerate summary
  http.post(`${API_URL}/meetings/:id/summary/regenerate`, () => {
    return HttpResponse.json({
      success: true,
      data: { jobId: 'job-123', status: 'queued' },
    });
  }),

  // Action items
  http.get(`${API_URL}/meetings/:id/action-items`, ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      success: true,
      data: createMockActionItems(id as string),
    });
  }),

  // Update action item
  http.patch(`${API_URL}/meetings/:meetingId/action-items/:itemId`, async ({ params, request }) => {
    const { itemId } = params;
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: {
        id: itemId,
        ...(body as object),
        updatedAt: new Date().toISOString(),
      },
    });
  }),

  // Delete action item
  http.delete(`${API_URL}/meetings/:meetingId/action-items/:itemId`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Delete meeting
  http.delete(`${API_URL}/meetings/:id`, () => {
    return HttpResponse.json({ success: true });
  }),
];
