/**
 * Chat Types
 * Types for AI chat with attachment support
 */

export type AttachmentType = 'text' | 'audio' | 'transcript';

export interface ChatAttachment {
  id: string;
  type: AttachmentType;
  name: string;
  size: number; // bytes

  // For text attachments
  content?: string;
  wordCount?: number;
  preview?: string; // First 150 chars

  // For audio attachments
  file?: File;
  duration?: number; // seconds
  mimeType?: string;

  // Processing state
  status: 'ready' | 'uploading' | 'transcribing' | 'error';
  progress?: number; // 0-100
  error?: string;

  // After processing (for audio)
  transcribedText?: string;
}

export interface SourceReference {
  meetingId: string;
  meetingTitle: string;
  timestamp?: number;
  text: string;
  relevance: number;
}

export interface FileOffer {
  shouldOffer: true;
  formats: ('pdf' | 'docx' | 'md' | 'csv')[];
  suggestedTitle: string;
  description: string;
  contentType: 'summary' | 'action_items' | 'decisions' | 'transcript_excerpt' | 'custom';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: ChatAttachment[];
  sources?: SourceReference[];
  fileOffer?: FileOffer;
  createdAt: string;
}
