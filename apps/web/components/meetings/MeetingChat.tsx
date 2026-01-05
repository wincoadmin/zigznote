'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Bot,
  User,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    segmentIndex: number;
    text: string;
    relevance: number;
    speaker?: string;
    timestamp?: number;
  }>;
  createdAt: string;
}

interface MeetingChatProps {
  meetingId: string;
  className?: string;
}

// API client functions
async function askQuestion(
  meetingId: string,
  question: string,
  conversationId?: string
): Promise<{
  conversationId: string;
  answer: string;
  sources: Message['sources'];
  tokensUsed: number;
  modelUsed: string;
  latencyMs: number;
}> {
  const response = await fetch(`/api/v1/meetings/${meetingId}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, conversationId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get answer');
  }

  return response.json();
}

async function getSuggestions(meetingId: string): Promise<{ suggestions: string[] }> {
  const response = await fetch(`/api/v1/meetings/${meetingId}/suggestions`);
  if (!response.ok) {
    return { suggestions: [] };
  }
  return response.json();
}

async function getConversation(
  conversationId: string
): Promise<{ messages: Message[] }> {
  const response = await fetch(`/api/v1/conversations/${conversationId}`);
  if (!response.ok) {
    throw new Error('Failed to load conversation');
  }
  return response.json();
}

export function MeetingChat({ meetingId, className }: MeetingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSources, setShowSources] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Fetch suggestions
  const { data: suggestionsData } = useQuery({
    queryKey: ['meeting-suggestions', meetingId],
    queryFn: () => getSuggestions(meetingId),
    enabled: isOpen && messages.length === 0,
  });

  // Ask question mutation
  const askMutation = useMutation({
    mutationFn: ({ question }: { question: string }) =>
      askQuestion(meetingId, question, conversationId || undefined),
    onMutate: async ({ question }) => {
      // Optimistically add user message
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: question,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMessage]);
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId);

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error) => {
      // Remove optimistic message on error
      setMessages((prev) => prev.slice(0, -1));
      console.error('Failed to ask question:', error);
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const question = input.trim();
      if (!question || askMutation.isPending) return;

      setInput('');
      askMutation.mutate({ question });
    },
    [input, askMutation]
  );

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const formatTimestamp = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 bg-primary-600 hover:bg-primary-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-105 z-50',
          className
        )}
        title="Ask AI about this meeting"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 w-96 max-h-[600px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col z-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-primary-600 to-primary-700 rounded-t-xl">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold">AI Assistant</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white/80 hover:text-white p-1 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="text-center text-slate-500 py-4">
              <Bot className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">
                Ask me anything about this meeting!
              </p>
            </div>

            {/* Suggestions */}
            {suggestionsData?.suggestions && suggestionsData.suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide">
                  Suggested questions
                </p>
                {suggestionsData.suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left text-sm px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-2',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-600" />
                </div>
              )}

              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2',
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-800'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {/* Sources */}
                {message.role === 'assistant' &&
                  message.sources &&
                  message.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() =>
                          setShowSources(
                            showSources === message.id ? null : message.id
                          )
                        }
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {message.sources.length} source
                        {message.sources.length !== 1 ? 's' : ''}
                        {showSources === message.id ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {showSources === message.id && (
                        <div className="mt-2 space-y-1">
                          {message.sources.map((source, i) => (
                            <div
                              key={i}
                              className="text-xs bg-white rounded p-2 border border-slate-200"
                            >
                              {source.speaker && (
                                <span className="font-medium text-slate-700">
                                  {source.speaker}
                                </span>
                              )}
                              {source.timestamp !== undefined && (
                                <span className="text-slate-400 ml-1">
                                  @ {formatTimestamp(source.timestamp)}
                                </span>
                              )}
                              <p className="text-slate-600 mt-1 line-clamp-2">
                                "{source.text}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading indicator */}
        {askMutation.isPending && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary-600" />
            </div>
            <div className="bg-slate-100 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this meeting..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={askMutation.isPending}
          />
          <button
            type="submit"
            disabled={!input.trim() || askMutation.isPending}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white rounded-lg p-2 transition-colors"
          >
            {askMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
