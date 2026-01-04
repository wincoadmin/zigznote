/**
 * Shared TypeScript types for the web application
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  organizationId: string;
  role: 'admin' | 'member';
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  settings: Record<string, unknown>;
  createdAt: string;
}

export interface Meeting {
  id: string;
  organizationId: string;
  title: string;
  platform?: 'zoom' | 'meet' | 'teams' | 'webex' | 'other';
  meetingUrl?: string;
  recordingUrl?: string;
  startTime?: string;
  endTime?: string;
  durationSeconds?: number;
  status: 'scheduled' | 'recording' | 'processing' | 'completed';
  botId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingParticipant {
  id: string;
  meetingId: string;
  name: string;
  email?: string;
  speakerLabel?: string;
  isHost: boolean;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface Transcript {
  id: string;
  meetingId: string;
  segments: TranscriptSegment[];
  fullText: string;
  wordCount: number;
  language: string;
  createdAt: string;
}

export interface Summary {
  id: string;
  meetingId: string;
  content: {
    executiveSummary: string;
    topics: Array<{
      title: string;
      summary: string;
    }>;
    decisions: string[];
    questions: string[];
  };
  modelUsed: string;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  meetingId: string;
  text: string;
  assignee?: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}
