/**
 * useFileDropZone Hook
 * Handles drag and drop of audio and text files
 */

import { useState, useCallback, DragEvent } from 'react';
import type { ChatAttachment } from '@/types/chat';

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
];

const ALLOWED_TEXT_TYPES = ['text/plain', 'text/markdown', 'application/json'];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface UseFileDropZoneOptions {
  onAttachment: (attachment: ChatAttachment) => void;
  onError: (error: string) => void;
}

export function useFileDropZone({ onAttachment, onError }: UseFileDropZoneOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);

      for (const file of files) {
        // Validate size
        if (file.size > MAX_FILE_SIZE) {
          onError(`File "${file.name}" exceeds 500MB limit`);
          continue;
        }

        // Handle audio files
        if (ALLOWED_AUDIO_TYPES.includes(file.type) || file.type.startsWith('audio/')) {
          onAttachment({
            id: generateId(),
            type: 'audio',
            name: file.name,
            size: file.size,
            file,
            mimeType: file.type,
            status: 'ready',
          });
          continue;
        }

        // Handle text files
        if (ALLOWED_TEXT_TYPES.includes(file.type)) {
          const reader = new FileReader();
          reader.onload = () => {
            const content = reader.result as string;
            const wordCount = content.split(/\s+/).filter(Boolean).length;
            onAttachment({
              id: generateId(),
              type: 'text',
              name: file.name,
              size: file.size,
              content,
              wordCount,
              preview: content.slice(0, 150) + (content.length > 150 ? '...' : ''),
              status: 'ready',
            });
          };
          reader.readAsText(file);
          continue;
        }

        onError(`File type "${file.type || 'unknown'}" is not supported`);
      }
    },
    [onAttachment, onError]
  );

  return {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
