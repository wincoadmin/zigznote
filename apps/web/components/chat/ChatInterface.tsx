'use client';

/**
 * Chat Interface Component
 * AI-powered chat with meeting transcripts
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Loader2,
  MessageSquare,
  Clock,
  User,
  Bot,
  Sparkles,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Citation {
  meetingId: string;
  meetingTitle: string;
  timestamp: number | null;
  text: string;
  speaker?: string;
  relevance: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  createdAt: Date;
}

interface ChatInterfaceProps {
  chatId?: string;
  meetingId?: string;
  meetingTitle?: string;
  suggestedQuestions?: string[];
  onCreateChat?: () => Promise<string>;
  onSendMessage?: (chatId: string, message: string) => Promise<{
    message: ChatMessage;
    suggestedFollowups?: string[];
  }>;
  onLoadHistory?: (chatId: string) => Promise<ChatMessage[]>;
  className?: string;
}

const messageVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

function formatTimestamp(seconds: number | null): string {
  if (seconds === null) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function ChatInterface({
  chatId: initialChatId,
  meetingId,
  meetingTitle,
  suggestedQuestions = [],
  onCreateChat,
  onSendMessage,
  onLoadHistory,
  className,
}: ChatInterfaceProps) {
  const [chatId, setChatId] = useState<string | undefined>(initialChatId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [followups, setFollowups] = useState<string[]>(suggestedQuestions);
  const [expandedCitations, setExpandedCitations] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chat history
  useEffect(() => {
    if (chatId && onLoadHistory) {
      onLoadHistory(chatId).then(setMessages).catch(console.error);
    }
  }, [chatId, onLoadHistory]);

  // Handle sending message
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Create chat if needed
    let activeChatId = chatId;
    if (!activeChatId && onCreateChat) {
      try {
        activeChatId = await onCreateChat();
        setChatId(activeChatId);
      } catch (error) {
        console.error('Failed to create chat:', error);
        setIsLoading(false);
        return;
      }
    }

    if (!activeChatId || !onSendMessage) {
      setIsLoading(false);
      return;
    }

    // Add user message optimistically
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await onSendMessage(activeChatId, userMessage);

      // Replace temp message and add assistant response
      setMessages((prev) => [
        ...prev.slice(0, -1), // Remove temp
        { ...tempUserMessage, id: `user-${Date.now()}` },
        response.message,
      ]);

      if (response.suggestedFollowups) {
        setFollowups(response.suggestedFollowups);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove temp message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle clicking a suggestion
  const handleSuggestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
          <MessageSquare className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {meetingTitle ? `Chat: ${meetingTitle}` : 'Meeting Assistant'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ask questions about {meetingId ? 'this meeting' : 'your meetings'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="mb-4 rounded-full bg-amber-100 p-4 dark:bg-amber-900/40">
                <Sparkles className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                Ask anything about your meeting
              </h4>
              <p className="mb-6 max-w-sm text-gray-500 dark:text-gray-400">
                Get instant answers, summaries, action items, and more from your
                transcript.
              </p>

              {/* Suggested questions */}
              {followups.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {followups.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestion(question)}
                      className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  variants={messageVariants}
                  initial="hidden"
                  animate="visible"
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : ''
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                      <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                  )}

                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3',
                      message.role === 'user'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* Citations */}
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                        <button
                          onClick={() =>
                            setExpandedCitations(
                              expandedCitations === message.id ? null : message.id
                            )
                          }
                          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        >
                          <span>
                            {message.citations.length} source
                            {message.citations.length > 1 ? 's' : ''}
                          </span>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 transition-transform',
                              expandedCitations === message.id ? 'rotate-180' : ''
                            )}
                          />
                        </button>

                        <AnimatePresence>
                          {expandedCitations === message.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-2 space-y-2 overflow-hidden"
                            >
                              {message.citations.map((citation, index) => (
                                <div
                                  key={index}
                                  className="rounded-lg bg-white p-2 text-sm dark:bg-gray-900"
                                >
                                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">
                                      {citation.meetingTitle}
                                    </span>
                                    {citation.timestamp && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatTimestamp(citation.timestamp)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-gray-500 dark:text-gray-500">
                                    {citation.text}
                                  </p>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                      <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                    <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-800">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Follow-up suggestions (after messages exist) */}
      {messages.length > 0 && followups.length > 0 && !isLoading && (
        <div className="border-t border-gray-200 px-4 py-2 dark:border-gray-800">
          <div className="flex flex-wrap gap-2">
            {followups.map((question, index) => (
              <button
                key={index}
                onClick={() => handleSuggestion(question)}
                className="rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-amber-500"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-auto rounded-xl px-4"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;
