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
  documentsApi: {
    generate: jest.fn(),
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

  function TestWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  TestWrapper.displayName = 'TestWrapper';
  return TestWrapper;
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

  it('should send message when suggestion is clicked', async () => {
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
          content: 'The key decisions were...',
          citations: [],
          createdAt: new Date().toISOString(),
        },
      },
    });

    render(<MeetingChat meetingId="meeting-123" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTitle('Ask AI about this meeting'));

    await waitFor(() => {
      expect(
        screen.getByText('What were the key decisions?')
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText('What were the key decisions?'));

    // Suggestion click now sends the message directly
    await waitFor(() => {
      expect(mockChatApi.createChat).toHaveBeenCalled();
    });
  });

  it('should send message when send button is clicked', async () => {
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

    const input = await screen.findByPlaceholderText(/Ask about this meeting/);
    await user.type(input, 'What was discussed?');

    // Click the send button (it's not disabled now since there's text)
    const sendButtons = screen.getAllByRole('button');
    const sendButton = sendButtons.find((btn) => !btn.hasAttribute('disabled') && btn.querySelector('svg.lucide-send'));
    if (sendButton) await user.click(sendButton);

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

    const input = await screen.findByPlaceholderText(/Ask about this meeting/);
    await user.type(input, 'Test message');

    // Find and click the send button
    const sendButtons = screen.getAllByRole('button');
    const sendButton = sendButtons.find((btn) => !btn.hasAttribute('disabled') && btn.querySelector('svg.lucide-send'));
    if (sendButton) await user.click(sendButton);

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

    const input = await screen.findByPlaceholderText(/Ask about this meeting/);
    await user.type(input, 'When is the launch?');

    // Find and click the send button
    const sendButtons = screen.getAllByRole('button');
    const sendButton = sendButtons.find((btn) => !btn.hasAttribute('disabled') && btn.querySelector('svg.lucide-send'));
    if (sendButton) await user.click(sendButton);

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
