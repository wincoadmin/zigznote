'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
  Clock,
  Download,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { chatApi, documentsApi, type ChatMessage, type FileOffer } from '@/lib/api';

interface MeetingChatProps {
  meetingId: string;
  meetingTitle?: string;
  className?: string;
}

function formatTimestamp(seconds: number | null): string {
  if (seconds === null) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

const messageVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// Format labels for file types
const formatLabels: Record<string, { icon: React.ReactNode; label: string }> = {
  pdf: { icon: <FileText className="w-3.5 h-3.5" />, label: 'PDF' },
  docx: { icon: <FileText className="w-3.5 h-3.5" />, label: 'Word' },
  md: { icon: <FileText className="w-3.5 h-3.5" />, label: 'Markdown' },
  csv: { icon: <FileSpreadsheet className="w-3.5 h-3.5" />, label: 'CSV' },
};

// FileOfferCard component
function FileOfferCard({
  fileOffer,
  content,
  meetingId,
  onGenerate,
  isGenerating,
  generatingFormat,
}: {
  fileOffer: FileOffer;
  content: string;
  meetingId: string;
  onGenerate: (format: string) => void;
  isGenerating: boolean;
  generatingFormat: string | null;
}) {
  return (
    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
        <Download className="w-3.5 h-3.5" />
        {fileOffer.description}
      </p>
      <div className="flex flex-wrap gap-2">
        {fileOffer.formats.map((format) => (
          <button
            key={format}
            onClick={() => onGenerate(format)}
            disabled={isGenerating}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs',
              'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600',
              'rounded-md hover:bg-slate-100 dark:hover:bg-slate-600',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            {isGenerating && generatingFormat === format ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              formatLabels[format]?.icon || <FileText className="w-3.5 h-3.5" />
            )}
            <span>{formatLabels[format]?.label || format.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MeetingChat({ meetingId, meetingTitle, className }: MeetingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [expandedCitations, setExpandedCitations] = useState<string | null>(null);
  const [followups, setFollowups] = useState<string[]>([]);
  const [generatingFormat, setGeneratingFormat] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch suggested questions
  const { data: suggestionsData } = useQuery({
    queryKey: ['chat-suggestions', meetingId],
    queryFn: async () => {
      const response = await chatApi.getSuggestions(meetingId);
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    },
    enabled: isOpen && messages.length === 0,
  });

  // Create chat mutation
  const createChatMutation = useMutation({
    mutationFn: async () => {
      const response = await chatApi.createChat({ meetingId });
      if (response.success && response.data) {
        return response.data.chatId;
      }
      throw new Error('Failed to create chat');
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ activeChatId, message }: { activeChatId: string; message: string }) => {
      const response = await chatApi.sendMessage(activeChatId, message);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to send message');
    },
    onMutate: async ({ message }) => {
      // Optimistically add user message
      const tempMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMessage]);
    },
    onSuccess: (data) => {
      // Replace temp message and add assistant response
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { ...prev[prev.length - 1], id: `user-${Date.now()}` },
        data.message,
      ]);

      if (data.suggestedFollowups) {
        setFollowups(data.suggestedFollowups);
      }
    },
    onError: () => {
      // Remove optimistic message on error
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  // Document generation mutation
  const generateDocMutation = useMutation({
    mutationFn: async ({
      content,
      format,
      title,
      contentType,
    }: {
      content: string;
      format: 'pdf' | 'docx' | 'md' | 'csv';
      title: string;
      contentType?: string;
    }) => {
      setGeneratingFormat(format);
      const response = await documentsApi.generate({
        content,
        format,
        title,
        meetingId,
        contentType: contentType as 'summary' | 'action_items' | 'decisions' | 'transcript_excerpt' | 'custom',
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to generate document');
    },
    onSuccess: (data) => {
      setGeneratingFormat(null);
      // Trigger download
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    onError: () => {
      setGeneratingFormat(null);
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

  // Set initial suggestions
  useEffect(() => {
    if (suggestionsData && suggestionsData.length > 0 && followups.length === 0) {
      setFollowups(suggestionsData);
    }
  }, [suggestionsData, followups.length]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const message = input.trim();
      if (!message || sendMessageMutation.isPending) return;

      setInput('');

      // Create chat if needed
      let activeChatId = chatId;
      if (!activeChatId) {
        try {
          activeChatId = await createChatMutation.mutateAsync();
          setChatId(activeChatId);
        } catch (error) {
          console.error('Failed to create chat:', error);
          return;
        }
      }

      sendMessageMutation.mutate({ activeChatId, message });
    },
    [input, chatId, sendMessageMutation, createChatMutation]
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

  const isLoading = createChatMutation.isPending || sendMessageMutation.isPending;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 bg-amber-500 hover:bg-amber-600 text-white rounded-full p-4 shadow-lg transition-all hover:scale-105 z-50',
          className
        )}
        title="Ask AI about this meeting"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={cn(
        'fixed bottom-6 right-6 w-96 max-h-[600px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col z-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-amber-500 to-amber-600 rounded-t-xl">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5" />
          <div>
            <span className="font-semibold block">AI Assistant</span>
            {meetingTitle && (
              <span className="text-xs text-amber-100 truncate block max-w-[200px]">
                {meetingTitle}
              </span>
            )}
          </div>
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
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Ask me anything about this meeting!
                </p>
              </div>

              {/* Suggestions */}
              {followups.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Suggested questions
                  </p>
                  {followups.slice(0, 3).map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left text-sm px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            messages.map((message) => (
              <motion.div
                key={message.id}
                variants={messageVariants}
                initial="hidden"
                animate="visible"
                className={cn(
                  'flex gap-2',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2',
                    message.role === 'user'
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                  {/* Citations */}
                  {message.role === 'assistant' &&
                    message.citations &&
                    message.citations.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() =>
                            setExpandedCitations(
                              expandedCitations === message.id ? null : message.id
                            )
                          }
                          className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          <span>
                            {message.citations.length} source
                            {message.citations.length !== 1 ? 's' : ''}
                          </span>
                          {expandedCitations === message.id ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>

                        <AnimatePresence>
                          {expandedCitations === message.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-2 space-y-1 overflow-hidden"
                            >
                              {message.citations.map((citation, i) => (
                                <div
                                  key={i}
                                  className="text-xs bg-white dark:bg-gray-900 rounded p-2 border border-gray-200 dark:border-gray-700"
                                >
                                  {citation.speaker && (
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      {citation.speaker}
                                    </span>
                                  )}
                                  {citation.timestamp !== null && (
                                    <span className="text-gray-400 ml-1 inline-flex items-center gap-0.5">
                                      <Clock className="w-3 h-3" />
                                      {formatTimestamp(citation.timestamp)}
                                    </span>
                                  )}
                                  <p className="text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                    &ldquo;{citation.text}&rdquo;
                                  </p>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                  {/* File offer */}
                  {message.role === 'assistant' && message.fileOffer && (
                    <FileOfferCard
                      fileOffer={message.fileOffer}
                      content={message.content}
                      meetingId={meetingId}
                      onGenerate={(format) =>
                        generateDocMutation.mutate({
                          content: message.content,
                          format: format as 'pdf' | 'docx' | 'md' | 'csv',
                          title: message.fileOffer?.suggestedTitle || 'Meeting Document',
                          contentType: message.fileOffer?.contentType,
                        })
                      }
                      isGenerating={generateDocMutation.isPending}
                      generatingFormat={generatingFormat}
                    />
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>

        {/* Loading indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2"
          >
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Follow-up suggestions */}
      {messages.length > 0 && followups.length > 0 && !isLoading && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-wrap gap-1">
            {followups.slice(0, 2).map((question, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(question)}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400 transition-colors truncate max-w-[45%]"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-800">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this meeting..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl p-2 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
