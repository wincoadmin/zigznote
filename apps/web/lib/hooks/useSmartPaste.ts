/**
 * useSmartPaste Hook
 * Detects large text pastes and converts them to attachments
 */

import { useCallback } from 'react';
import type { ChatAttachment } from '@/types/chat';

const LARGE_TEXT_THRESHOLD = 500; // characters
const WORD_COUNT_THRESHOLD = 100; // words

interface UseSmartPasteOptions {
  onAttachment: (attachment: ChatAttachment) => void;
  onRegularPaste: (text: string) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function createTextAttachment(content: string, name?: string): ChatAttachment {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const preview = content.slice(0, 150).trim() + (content.length > 150 ? '...' : '');

  return {
    id: generateId(),
    type: 'text',
    name: name || 'Pasted Text',
    size: new Blob([content]).size,
    content,
    wordCount,
    preview,
    status: 'ready',
  };
}

function createAudioAttachment(file: File): ChatAttachment {
  return {
    id: generateId(),
    type: 'audio',
    name: file.name,
    size: file.size,
    file,
    mimeType: file.type,
    status: 'ready',
  };
}

async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function useSmartPaste({ onAttachment, onRegularPaste }: UseSmartPasteOptions) {
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      const files = e.clipboardData?.files;

      // Check for files first (audio, images, etc.)
      if (files && files.length > 0) {
        e.preventDefault();
        Array.from(files).forEach((file) => {
          if (file.type.startsWith('audio/')) {
            onAttachment(createAudioAttachment(file));
          } else if (file.type === 'text/plain') {
            // Text file pasted
            readTextFile(file).then((content) => {
              onAttachment(createTextAttachment(content, file.name));
            });
          }
        });
        return;
      }

      // Check if text is large enough to convert to attachment
      if (text) {
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        const isLarge = text.length > LARGE_TEXT_THRESHOLD || wordCount > WORD_COUNT_THRESHOLD;

        if (isLarge) {
          e.preventDefault();
          onAttachment(createTextAttachment(text));
        } else {
          // Let it paste normally
          onRegularPaste(text);
        }
      }
    },
    [onAttachment, onRegularPaste]
  );

  return { handlePaste };
}
