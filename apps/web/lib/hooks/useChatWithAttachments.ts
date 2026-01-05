/**
 * useChatWithAttachments Hook
 * Handles attachment processing (transcription) before sending to AI
 */

import { useState, useCallback } from 'react';
import type { ChatAttachment } from '@/types/chat';

interface UseChatWithAttachmentsOptions {
  meetingId?: string;
}

export function useChatWithAttachments({ meetingId }: UseChatWithAttachmentsOptions = {}) {
  const [isProcessing, setIsProcessing] = useState(false);

  const prepareAttachments = useCallback(
    async (attachments: ChatAttachment[]): Promise<ChatAttachment[]> => {
      if (attachments.length === 0) return attachments;

      setIsProcessing(true);

      try {
        const processed = await Promise.all(
          attachments.map(async (attachment) => {
            // Audio files need transcription first
            if (attachment.type === 'audio' && attachment.file && !attachment.transcribedText) {
              try {
                // Update status
                const updatedAttachment = { ...attachment, status: 'transcribing' as const };

                // Upload and transcribe
                const formData = new FormData();
                formData.append('file', attachment.file);

                const response = await fetch('/api/v1/audio/transcribe-inline', {
                  method: 'POST',
                  body: formData,
                });

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}));
                  throw new Error(errorData.error || 'Transcription failed');
                }

                const result = await response.json();

                return {
                  ...updatedAttachment,
                  transcribedText: result.data.text,
                  duration: result.data.duration,
                  status: 'ready' as const,
                };
              } catch (error) {
                return {
                  ...attachment,
                  status: 'error' as const,
                  error: error instanceof Error ? error.message : 'Failed to transcribe audio',
                };
              }
            }

            return attachment;
          })
        );

        return processed;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const buildPromptWithAttachments = useCallback(
    (message: string, attachments: ChatAttachment[]): string => {
      let fullPrompt = message;

      // Add attachment contents to prompt
      const attachmentContents: string[] = [];

      for (const attachment of attachments) {
        if (attachment.type === 'text' && attachment.content) {
          attachmentContents.push(
            `[Attached Text: "${attachment.name}"]\n${attachment.content}\n[End of Attached Text]`
          );
        }

        if (attachment.type === 'audio' && attachment.transcribedText) {
          attachmentContents.push(
            `[Transcribed Audio: "${attachment.name}"]\n${attachment.transcribedText}\n[End of Transcription]`
          );
        }
      }

      if (attachmentContents.length > 0) {
        fullPrompt = `${attachmentContents.join('\n\n')}\n\n---\n\nUser question: ${message}`;
      }

      return fullPrompt;
    },
    []
  );

  return {
    isProcessing,
    prepareAttachments,
    buildPromptWithAttachments,
    meetingId,
  };
}
