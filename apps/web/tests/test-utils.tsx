import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';

// Create a new QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface AllProvidersProps {
  children: React.ReactNode;
}

function AllProviders({ children }: AllProvidersProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Mock data factories - defined here to avoid MSW import issues
export const createMockMeeting = (overrides: Record<string, unknown> = {}) => ({
  id: 'meeting-1',
  title: 'Weekly Standup',
  status: 'completed' as const,
  platform: 'zoom' as const,
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

export const createMockTranscript = (meetingId: string, overrides: Record<string, unknown> = {}) => ({
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
  ],
  createdAt: '2026-01-05T11:00:00Z',
  updatedAt: '2026-01-05T11:00:00Z',
  ...overrides,
});

export const createMockSummary = (meetingId: string, overrides: Record<string, unknown> = {}) => ({
  id: 'summary-1',
  meetingId,
  content: {
    executiveSummary: 'The team discussed progress on the dashboard and upcoming features.',
    topics: [
      { title: 'Dashboard Progress', summary: 'Jane completed the main dashboard layout.' },
      { title: 'Next Steps', summary: 'Focus on testing and documentation.' },
    ],
    decisions: [
      'Proceed with the current design approach',
      'Schedule a demo for Friday',
    ],
    questions: [
      'What is the timeline for the demo?',
      'Do we need additional resources?',
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
