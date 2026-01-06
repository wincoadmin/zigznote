'use client';

/**
 * @ownership
 * @domain Chat UI Input
 * @description Smart chat input with attachments, paste detection, and drag-and-drop
 * @single-responsibility YES — handles all chat input interactions
 * @last-reviewed 2026-01-06
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, Mic, Loader2 } from 'lucide-react';
import type { ChatAttachment } from '@/types/chat';
import { AttachmentChip } from './AttachmentChip';
import { InlineRecorder } from './InlineRecorder';
import { useSmartPaste } from '@/lib/hooks/useSmartPaste';
import { useFileDropZone } from '@/lib/hooks/useFileDropZone';
import { cn } from '@/lib/utils';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface ChatInputProps {
  onSend: (message: string, attachments: ChatAttachment[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({ onSend, isLoading, placeholder, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Smart paste handling
  const { handlePaste } = useSmartPaste({
    onAttachment: (attachment) => {
      setAttachments((prev) => [...prev, attachment]);
      setError(null);
    },
    onRegularPaste: () => {
      // Let it paste normally into textarea
    },
  });

  // File drop zone
  const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } =
    useFileDropZone({
      onAttachment: (attachment) => {
        setAttachments((prev) => [...prev, attachment]);
        setError(null);
      },
      onError: setError,
    });

  // Attach paste listener
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.addEventListener('paste', handlePaste);
    return () => textarea.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }, [message]);

  const handleSend = useCallback(() => {
    if ((!message.trim() && attachments.length === 0) || isLoading || disabled) return;

    // Check if any attachments are still processing
    const processing = attachments.some(
      (a) => a.status === 'uploading' || a.status === 'transcribing'
    );
    if (processing) {
      setError('Please wait for attachments to finish processing');
      return;
    }

    onSend(message, attachments);
    setMessage('');
    setAttachments([]);
    setError(null);
  }, [message, attachments, isLoading, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (file.type.startsWith('audio/')) {
        setAttachments((prev) => [
          ...prev,
          {
            id: generateId(),
            type: 'audio',
            name: file.name,
            size: file.size,
            file,
            mimeType: file.type,
            status: 'ready',
          },
        ]);
      } else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          setAttachments((prev) => [
            ...prev,
            {
              id: generateId(),
              type: 'text',
              name: file.name,
              size: file.size,
              content,
              wordCount: content.split(/\s+/).filter(Boolean).length,
              preview: content.slice(0, 150) + (content.length > 150 ? '...' : ''),
              status: 'ready',
            },
          ]);
        };
        reader.readAsText(file);
      }
    });
    // Reset input
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      className={cn(
        'relative border rounded-lg transition-colors bg-white dark:bg-slate-900',
        isDragging
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-slate-200 dark:border-slate-700'
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Inline recorder */}
      {isRecording && (
        <div className="p-2 border-b border-slate-200 dark:border-slate-700">
          <InlineRecorder
            onRecordingComplete={(attachment) => {
              setAttachments((prev) => [...prev, attachment]);
              setIsRecording(false);
            }}
            onCancel={() => setIsRecording(false)}
          />
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="p-2 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={attachment}
              onRemove={() => removeAttachment(attachment.id)}
            />
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-b border-slate-200 dark:border-slate-700">
          {error}
        </div>
      )}

      {/* Drop zone overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary-50/90 dark:bg-primary-900/90 rounded-lg z-10">
          <div className="text-center">
            <Paperclip className="w-8 h-8 mx-auto text-primary-500 dark:text-primary-400 mb-2" />
            <p className="text-primary-700 dark:text-primary-300 font-medium">Drop files here</p>
            <p className="text-sm text-primary-500 dark:text-primary-400">Audio or text files</p>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-1.5 sm:gap-2 p-2">
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,text/*,.txt,.md"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Record button */}
        <button
          onClick={() => setIsRecording(true)}
          disabled={isRecording || disabled}
          className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
          title="Record audio"
        >
          <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Ask a question...'}
          rows={1}
          className="flex-1 resize-none border-0 focus:ring-0 text-xs sm:text-sm py-1.5 sm:py-2 max-h-[200px] bg-transparent dark:text-white placeholder:text-slate-400"
          disabled={isLoading || disabled}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={isLoading || disabled || (!message.trim() && attachments.length === 0)}
          className="p-1.5 sm:p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>
      </div>
    </div>
  );
}
