'use client';

/**
 * AttachmentChip Component
 * Displays a preview of an attached file (text or audio)
 */

import { useState, useRef, useEffect } from 'react';
import { X, FileText, Music, Loader2, AlertCircle, Play, Pause } from 'lucide-react';
import type { ChatAttachment } from '@/types/chat';
import { formatFileSize, formatDuration } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AttachmentChipProps {
  attachment: ChatAttachment;
  onRemove: () => void;
  readonly?: boolean;
}

export function AttachmentChip({ attachment, onRemove, readonly }: AttachmentChipProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Create object URL for audio preview
  useEffect(() => {
    if (attachment.type === 'audio' && attachment.file) {
      const url = URL.createObjectURL(attachment.file);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [attachment.file, attachment.type]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const isAudio = attachment.type === 'audio';
  const isText = attachment.type === 'text';
  const isProcessing = attachment.status === 'uploading' || attachment.status === 'transcribing';
  const hasError = attachment.status === 'error';

  return (
    <div
      className={cn(
        'inline-flex items-start gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg border max-w-[200px] sm:max-w-xs',
        hasError ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700',
        isProcessing && 'animate-pulse'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded flex items-center justify-center',
          hasError
            ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'
            : isAudio
              ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400'
              : 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
        )}
      >
        {isProcessing ? (
          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
        ) : hasError ? (
          <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
        ) : isAudio ? (
          <Music className="w-3 h-3 sm:w-4 sm:h-4" />
        ) : (
          <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {attachment.name}
        </p>
        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
          {isAudio && attachment.duration && <span>{formatDuration(attachment.duration)} • </span>}
          {isText && attachment.wordCount && (
            <span>{attachment.wordCount.toLocaleString()} words • </span>
          )}
          {formatFileSize(attachment.size)}
          {isProcessing && attachment.progress && <span> • {attachment.progress}%</span>}
        </p>

        {/* Text preview */}
        {isText && attachment.preview && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 line-clamp-2">
            &quot;{attachment.preview}&quot;
          </p>
        )}

        {/* Error message */}
        {hasError && attachment.error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{attachment.error}</p>
        )}

        {/* Audio preview player */}
        {isAudio && audioUrl && !isProcessing && (
          <button
            onClick={togglePlay}
            className="mt-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1"
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isPlaying ? 'Pause' : 'Preview'}
          </button>
        )}
      </div>

      {/* Remove button */}
      {!readonly && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 p-0.5 sm:p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
        >
          <X className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>
      )}

      {/* Hidden audio element for preview */}
      {isAudio && audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
}
