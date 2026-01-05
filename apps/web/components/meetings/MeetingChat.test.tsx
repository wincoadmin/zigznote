/**
 * MeetingChat Component Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MeetingChat } from './MeetingChat';
import { chatApi } from '@/lib/api';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock chatApi
jest.mock('@/lib/api', () => ({
  chatApi: {
    getSuggestions: jest.fn(),
    createChat: jest.fn(),
    sendMessage: jest.fn(),
  },
}));

const mockChatApi = chatApi as jest.Mocked<typeof chatApi>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('MeetingChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChatApi.getSuggestions.mockResolvedValue({
      success: true,
      data: ['What were the key decisions?', 'Who has action items?'],
    });
  });

  it('should render collapsed chat button initially', () => {
    render(<MeetingChat meetingId="meeting-123" />, { wrapper: createWrapper() });

    expect(
      screen.getByTitle('Ask AI about this meeting')
    ).toBeInTheDocument();
  });

  it('should expand chat when button is clicked', async () => {
    render(<MeetingChat meetingId="meeting-123" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTitle('Ask AI about this meeting'));

    await waitFor(() => {
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });
  });

  it('should show meeting title when provided', async () => {
    render(
      <MeetingChat meetingId="meeting-123" meetingTitle="Team Standup" />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByTitle('Ask AI about this meeting'));

    await waitFor(() => {
      expect(screen.getByText('Team Standup')).toBeInTheDocument();
    });
  });

  it('should display suggested questions', async () => {
    render(<MeetingChat meetingId="meeting-123" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTitle('Ask AI about this meeting'));

    await waitFor(() => {
      expect(
        screen.getByText('What were the key decisions?')
      ).toBeInTheDocument();
    });
  });

  it('should fill input when suggestion is clicked', async () => {
    const user = userEvent.setup();
    render(<MeetingChat meetingId="meeting-123" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTitle('Ask AI about this meeting'));

    await waitFor(() => {
      expect(
        screen.getByText('What were the key decisions?')
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText('What were the key decisions?'));

    const input = screen.getByPlaceholderText('Ask about this meeting...');
    expect(input).toHaveValue('What were the key decisions?');
  });

  it('should send message when form is submitted', async () => {
    const user = userEvent.setup();

    mockChatApi.createChat.mockResolvedValue({
      success: true,
      data: { chatId: 'chat-123' },
    });
    mockChatApi.sendMessage.mockResolvedValue({
      success: true,
      data: {
        message: {
          id: 'msg-1',
          role: 'assistant',
          content: 'Here is the answer based on the transcript.',
          citations: [],
          createdAt: new Date().toISOString(),
        },
        suggestedFollowups: ['Any other questions?'],
      },
    });

    render(<MeetingChat meetingId="meeting-123" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTitle('Ask AI about this meeting'));

    const input = await screen.findByPlaceholderText('Ask about this meeting...');
    await user.type(input, 'What was discussed?');

    // Find the submit button (the button right after the textarea in the form)
    const form = input.closest('form');
    const submitButton = form?.querySelector('button[type="submit"]');
    if (submitButton) await user.click(submitButton);

    await waitFor(() => {
      expect(mockChatApi.createChat).toHaveBeenCalledWith({
        meetingId: 'meeting-123',
      });
    });
  });

  it('should close chat when X button is clicked', async () => {
    const { container } = render(<MeetingChat meetingId="meeting-123" />, { wrapper: createWrapper() });

    // Open chat
    fireEvent.click(screen.getByTitle('Ask AI about this meeting'));

    await waitFor(() => {
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });

    // Close chat - find the X button (the one with X icon in the header)
    const closeButton = container.querySelector('button.text-white\\/80');
    expect(closeButton).toBeTruthy();
    fireEvent.click(closeButton!);

    // Chat should collapse back to button
    await waitFor(() => {
      expect(screen.queryByText('AI Assistant')).not.toBeInTheDocument();
    });
  });

  it('should disable input while loading', async () => {
    const user = userEvent.setup();

    mockChatApi.createChat.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<MeetingChat meetingId="meeting-123" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTitle('Ask AI about this meeting'));

    const input = await screen.findByPlaceholderText('Ask about this meeting...');
    await user.type(input, 'Test message');

    const form = input.closest('form');
    const submitButton = form?.querySelector('button[type="submit"]');
    if (submitButton) await user.click(submitButton);

    await waitFor(() => {
      expect(input).toBeDisabled();
    });
  });

  it('should display assistant messages with citations', async () => {
    const user = userEvent.setup();

    mockChatApi.createChat.mockResolvedValue({
      success: true,
      data: { chatId: 'chat-123' },
    });
    mockChatApi.sendMessage.mockResolvedValue({
      success: true,
      data: {
        message: {
          id: 'msg-1',
          role: 'assistant',
          content: 'The team decided to launch next week.',
          citations: [
            {
              meetingId: 'meeting-123',
              meetingTitle: 'Team Standup',
              timestamp: 120,
              text: 'We will launch next week.',
              speaker: 'Alice',
              relevance: 0.95,
            },
          ],
          createdAt: new Date().toISOString(),
        },
      },
    });

    render(<MeetingChat meetingId="meeting-123" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTitle('Ask AI about this meeting'));

    const input = await screen.findByPlaceholderText('Ask about this meeting...');
    await user.type(input, 'When is the launch?');

    const form = input.closest('form');
    const submitButton = form?.querySelector('button[type="submit"]');
    if (submitButton) await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText('The team decided to launch next week.')
      ).toBeInTheDocument();
    });

    // Click to expand citations
    await user.click(screen.getByText('1 source'));

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
