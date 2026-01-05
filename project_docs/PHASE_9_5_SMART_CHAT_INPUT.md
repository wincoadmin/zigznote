# Phase 9.5: Smart Chat Input & Attachments

## Overview

Enable intelligent handling of large text pastes and audio file attachments in the AI chat. Users can paste transcripts, drop audio files, or attach recordings — the system handles them gracefully and the AI can analyze any input format.

**Estimated Time:** 2-3 hours  
**Priority:** Enhancement  
**Dependencies:** Phase 9 (AI file generation)

---

## User Experience

### Scenario 1: Paste Large Text
```
User pastes 500+ lines of transcript text...

┌─────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────┐              │
│ │ 📄 Pasted Text                     │              │
│ │ 2,847 words • 14.2 KB              │              │
│ │ "Meeting started at 9am. John:..." │ ← Preview    │
│ └────────────────────────────────────┘              │
│                                                     │
│ Find all action items from this transcript          │
│                                                     │
└─────────────────────────────────────────────────────┘
                                               [Send]
```

### Scenario 2: Drop Audio File
```
User drags meeting.mp3 into chat...

┌─────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────┐              │
│ │ 🎵 meeting.mp3                     │              │
│ │ 45:32 duration • 34.2 MB           │              │
│ │ [▶ Preview] [✕ Remove]             │              │
│ └────────────────────────────────────┘              │
│                                                     │
│ Summarize this meeting and list key decisions       │
│                                                     │
└─────────────────────────────────────────────────────┘
                                               [Send]
```

### Scenario 3: Multiple Attachments
```
┌─────────────────────────────────────────────────────┐
│ ┌──────────────────┐  ┌──────────────────┐          │
│ │ 📄 notes.txt     │  │ 🎵 recording.webm│          │
│ │ 3.2 KB           │  │ 12:45 • 8.1 MB   │          │
│ └──────────────────┘  └──────────────────┘          │
│                                                     │
│ Compare my notes with what was actually said        │
│                                                     │
└─────────────────────────────────────────────────────┘
                            [📎 Attach] [🎤 Record] [Send]
```

### Scenario 4: Inline Recording
```
User clicks [🎤 Record]...

┌─────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────┐              │
│ │ 🔴 Recording...         00:45      │              │
│ │ ████████████░░░░░░░░░░░░░░░░░░░░░ │              │
│ │ [⏹ Stop] [⏸ Pause]                 │              │
│ └────────────────────────────────────┘              │
│                                                     │
│ Type your question here...                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Implementation

### 1. Attachment Types

**File:** `apps/web/types/chat.ts`

```typescript
export type AttachmentType = 'text' | 'audio' | 'transcript';

export interface ChatAttachment {
  id: string;
  type: AttachmentType;
  name: string;
  size: number;  // bytes
  
  // For text attachments
  content?: string;
  wordCount?: number;
  preview?: string;  // First 100 chars
  
  // For audio attachments
  file?: File;
  duration?: number;  // seconds
  mimeType?: string;
  
  // Processing state
  status: 'ready' | 'uploading' | 'transcribing' | 'error';
  progress?: number;  // 0-100
  error?: string;
  
  // After processing (for audio)
  transcribedText?: string;
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
```

---

### 2. Smart Paste Detection Hook

**File:** `apps/web/lib/hooks/useSmartPaste.ts`

```typescript
import { useState, useCallback, useEffect } from 'react';
import { ChatAttachment } from '@/types/chat';
import { v4 as uuid } from 'uuid';

const LARGE_TEXT_THRESHOLD = 500;  // characters
const WORD_COUNT_THRESHOLD = 100;  // words

interface UseSmartPasteOptions {
  onAttachment: (attachment: ChatAttachment) => void;
  onRegularPaste: (text: string) => void;
}

export function useSmartPaste({ onAttachment, onRegularPaste }: UseSmartPasteOptions) {
  
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text/plain');
    const files = e.clipboardData?.files;
    
    // Check for files first (audio, images, etc.)
    if (files && files.length > 0) {
      e.preventDefault();
      Array.from(files).forEach(file => {
        if (file.type.startsWith('audio/')) {
          onAttachment(createAudioAttachment(file));
        } else if (file.type === 'text/plain') {
          // Text file pasted
          readTextFile(file).then(content => {
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
  }, [onAttachment, onRegularPaste]);
  
  return { handlePaste };
}

function createTextAttachment(content: string, name?: string): ChatAttachment {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const preview = content.slice(0, 150).trim() + (content.length > 150 ? '...' : '');
  
  return {
    id: uuid(),
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
    id: uuid(),
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
```

---

### 3. File Drop Zone Hook

**File:** `apps/web/lib/hooks/useFileDropZone.ts`

```typescript
import { useState, useCallback, DragEvent } from 'react';
import { ChatAttachment } from '@/types/chat';
import { v4 as uuid } from 'uuid';

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

const ALLOWED_TEXT_TYPES = [
  'text/plain',
  'text/markdown',
  'application/json',
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

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
  
  const handleDrop = useCallback((e: DragEvent) => {
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
          id: uuid(),
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
            id: uuid(),
            type: 'text',
            name: file.name,
            size: file.size,
            content,
            wordCount,
            preview: content.slice(0, 150) + '...',
            status: 'ready',
          });
        };
        reader.readAsText(file);
        continue;
      }
      
      onError(`File type "${file.type}" is not supported`);
    }
  }, [onAttachment, onError]);
  
  return {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
```

---

### 4. Attachment Chip Component

**File:** `apps/web/components/chat/AttachmentChip.tsx`

```typescript
'use client';

import { X, FileText, Music, Loader2, AlertCircle, Play, Pause } from 'lucide-react';
import { useState, useRef } from 'react';
import { ChatAttachment } from '@/types/chat';
import { formatFileSize, formatDuration } from '@/lib/utils';

interface AttachmentChipProps {
  attachment: ChatAttachment;
  onRemove: () => void;
  readonly?: boolean;
}

export function AttachmentChip({ attachment, onRemove, readonly }: AttachmentChipProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
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
      className={`
        inline-flex items-start gap-2 p-2 rounded-lg border max-w-xs
        ${hasError ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}
        ${isProcessing ? 'animate-pulse' : ''}
      `}
    >
      {/* Icon */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded flex items-center justify-center
        ${isAudio ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}
        ${hasError ? 'bg-red-100 text-red-600' : ''}
      `}>
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : hasError ? (
          <AlertCircle className="w-4 h-4" />
        ) : isAudio ? (
          <Music className="w-4 h-4" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {attachment.name}
        </p>
        <p className="text-xs text-slate-500">
          {isAudio && attachment.duration && (
            <span>{formatDuration(attachment.duration)} • </span>
          )}
          {isText && attachment.wordCount && (
            <span>{attachment.wordCount.toLocaleString()} words • </span>
          )}
          {formatFileSize(attachment.size)}
          {isProcessing && attachment.progress && (
            <span> • {attachment.progress}%</span>
          )}
        </p>
        
        {/* Text preview */}
        {isText && attachment.preview && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
            "{attachment.preview}"
          </p>
        )}
        
        {/* Error message */}
        {hasError && attachment.error && (
          <p className="text-xs text-red-600 mt-1">
            {attachment.error}
          </p>
        )}
        
        {/* Audio preview player */}
        {isAudio && attachment.file && !isProcessing && (
          <button
            onClick={togglePlay}
            className="mt-1 text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
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
          className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      
      {/* Hidden audio element for preview */}
      {isAudio && attachment.file && (
        <audio
          ref={audioRef}
          src={URL.createObjectURL(attachment.file)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
}
```

---

### 5. Inline Audio Recorder Component

**File:** `apps/web/components/chat/InlineRecorder.tsx`

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Pause, Play, X } from 'lucide-react';
import { ChatAttachment } from '@/types/chat';
import { v4 as uuid } from 'uuid';

interface InlineRecorderProps {
  onRecordingComplete: (attachment: ChatAttachment) => void;
  onCancel: () => void;
}

export function InlineRecorder({ onRecordingComplete, onCancel }: InlineRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  
  useEffect(() => {
    // Start recording immediately when component mounts
    startRecording();
    
    return () => {
      stopRecording();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio analysis for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Start visualization
      const updateLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
      
      // Start recording
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `recording-${Date.now()}.webm`, {
          type: 'audio/webm',
        });
        
        onRecordingComplete({
          id: uuid(),
          type: 'audio',
          name: file.name,
          size: file.size,
          file,
          mimeType: 'audio/webm',
          duration,
          status: 'ready',
        });
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      onCancel();
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    
    if (isPaused) {
      mediaRecorderRef.current.resume();
    } else {
      mediaRecorderRef.current.pause();
    }
    setIsPaused(!isPaused);
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
      {/* Recording indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
        <span className="text-sm font-medium text-red-700">
          {isPaused ? 'Paused' : 'Recording'}
        </span>
      </div>
      
      {/* Audio level visualization */}
      <div className="flex-1 h-8 bg-red-100 rounded overflow-hidden">
        <div 
          className="h-full bg-red-400 transition-all duration-100"
          style={{ width: `${audioLevel * 100}%` }}
        />
      </div>
      
      {/* Duration */}
      <span className="text-sm font-mono text-red-700 min-w-[50px]">
        {formatTime(duration)}
      </span>
      
      {/* Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={togglePause}
          className="p-2 text-red-600 hover:bg-red-100 rounded"
          title={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
        
        <button
          onClick={stopRecording}
          className="p-2 text-red-600 hover:bg-red-100 rounded"
          title="Stop recording"
        >
          <Square className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => {
            stopRecording();
            chunksRef.current = [];
            onCancel();
          }}
          className="p-2 text-slate-400 hover:bg-slate-100 rounded"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

---

### 6. Updated Chat Input Component

**File:** `apps/web/components/chat/ChatInput.tsx`

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, Mic, Loader2 } from 'lucide-react';
import { ChatAttachment } from '@/types/chat';
import { AttachmentChip } from './AttachmentChip';
import { InlineRecorder } from './InlineRecorder';
import { useSmartPaste } from '@/lib/hooks/useSmartPaste';
import { useFileDropZone } from '@/lib/hooks/useFileDropZone';

interface ChatInputProps {
  onSend: (message: string, attachments: ChatAttachment[]) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, isLoading, placeholder }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Smart paste handling
  const { handlePaste } = useSmartPaste({
    onAttachment: (attachment) => {
      setAttachments(prev => [...prev, attachment]);
      setError(null);
    },
    onRegularPaste: () => {
      // Let it paste normally into textarea
    },
  });
  
  // File drop zone
  const {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useFileDropZone({
    onAttachment: (attachment) => {
      setAttachments(prev => [...prev, attachment]);
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
  
  const handleSend = () => {
    if ((!message.trim() && attachments.length === 0) || isLoading) return;
    
    // Check if any attachments are still processing
    const processing = attachments.some(a => 
      a.status === 'uploading' || a.status === 'transcribing'
    );
    if (processing) {
      setError('Please wait for attachments to finish processing');
      return;
    }
    
    onSend(message, attachments);
    setMessage('');
    setAttachments([]);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.type.startsWith('audio/')) {
        setAttachments(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'audio',
          name: file.name,
          size: file.size,
          file,
          mimeType: file.type,
          status: 'ready',
        }]);
      } else if (file.type.startsWith('text/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          setAttachments(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'text',
            name: file.name,
            size: file.size,
            content,
            wordCount: content.split(/\s+/).filter(Boolean).length,
            preview: content.slice(0, 150) + '...',
            status: 'ready',
          }]);
        };
        reader.readAsText(file);
      }
    });
    // Reset input
    e.target.value = '';
  };
  
  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };
  
  return (
    <div
      className={`
        border rounded-lg transition-colors
        ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}
      `}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Inline recorder */}
      {isRecording && (
        <div className="p-2 border-b">
          <InlineRecorder
            onRecordingComplete={(attachment) => {
              setAttachments(prev => [...prev, attachment]);
              setIsRecording(false);
            }}
            onCancel={() => setIsRecording(false)}
          />
        </div>
      )}
      
      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="p-2 border-b flex flex-wrap gap-2">
          {attachments.map(attachment => (
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
        <div className="px-3 py-2 text-sm text-red-600 bg-red-50 border-b">
          {error}
        </div>
      )}
      
      {/* Drop zone overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary-50/90 rounded-lg z-10">
          <div className="text-center">
            <Paperclip className="w-8 h-8 mx-auto text-primary-500 mb-2" />
            <p className="text-primary-700 font-medium">Drop files here</p>
            <p className="text-sm text-primary-500">Audio or text files</p>
          </div>
        </div>
      )}
      
      {/* Input area */}
      <div className="flex items-end gap-2 p-2">
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          title="Attach file"
        >
          <Paperclip className="w-5 h-5" />
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
          disabled={isRecording}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          title="Record audio"
        >
          <Mic className="w-5 h-5" />
        </button>
        
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Ask a question or paste content...'}
          rows={1}
          className="flex-1 resize-none border-0 focus:ring-0 text-sm py-2 max-h-[200px]"
          disabled={isLoading}
        />
        
        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={isLoading || (!message.trim() && attachments.length === 0)}
          className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
```

---

### 7. Audio Transcription Before Sending

**File:** `apps/web/lib/hooks/useChatWithAttachments.ts`

```typescript
import { useState, useCallback } from 'react';
import { ChatAttachment, ChatMessage } from '@/types/chat';

interface UseChatOptions {
  meetingId?: string;
  onTranscriptionNeeded?: (attachment: ChatAttachment) => Promise<string>;
}

export function useChatWithAttachments({ meetingId, onTranscriptionNeeded }: UseChatOptions) {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const prepareAttachments = useCallback(async (
    attachments: ChatAttachment[]
  ): Promise<ChatAttachment[]> => {
    setIsProcessing(true);
    
    try {
      const processed = await Promise.all(
        attachments.map(async (attachment) => {
          // Audio files need transcription first
          if (attachment.type === 'audio' && attachment.file && !attachment.transcribedText) {
            try {
              // Update status
              attachment.status = 'transcribing';
              
              // Upload and transcribe
              const formData = new FormData();
              formData.append('file', attachment.file);
              
              const response = await fetch('/api/v1/audio/transcribe-inline', {
                method: 'POST',
                body: formData,
              });
              
              if (!response.ok) {
                throw new Error('Transcription failed');
              }
              
              const result = await response.json();
              
              return {
                ...attachment,
                transcribedText: result.data.text,
                status: 'ready' as const,
              };
            } catch (error) {
              return {
                ...attachment,
                status: 'error' as const,
                error: 'Failed to transcribe audio',
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
  }, []);
  
  const buildPromptWithAttachments = useCallback((
    message: string,
    attachments: ChatAttachment[]
  ): string => {
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
  }, []);
  
  return {
    isProcessing,
    prepareAttachments,
    buildPromptWithAttachments,
  };
}
```

---

### 8. Inline Transcription Endpoint

**File:** `apps/api/src/routes/audio.ts`

Add this new endpoint for transcribing audio directly in chat:

```typescript
/**
 * @route POST /api/v1/audio/transcribe-inline
 * @description Transcribe audio file directly without creating a meeting
 * Used for chat attachments
 */
audioRouter.post(
  '/transcribe-inline',
  requireScope('meetings:write'),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const file = req.file;
    
    if (!file) {
      throw new BadRequestError('No audio file provided');
    }
    
    // Validate file type
    storageService.validateFile(file.mimetype, file.size);
    
    // Transcribe directly using Deepgram
    const result = await deepgramService.transcribeBuffer(
      file.buffer,
      file.mimetype,
      {
        model: 'nova-2',
        language: 'en',
        smart_format: true,
        diarize: true,
      }
    );
    
    // Get duration from Deepgram response
    const duration = result.metadata?.duration || 0;
    
    // Format transcript
    const text = result.results?.channels[0]?.alternatives[0]?.transcript || '';
    
    res.json({
      success: true,
      data: {
        text,
        duration: Math.round(duration),
        wordCount: text.split(/\s+/).filter(Boolean).length,
      },
    });
  })
);
```

---

### 9. Update MeetingChat to Use New Components

**File:** `apps/web/components/meetings/MeetingChat.tsx`

Replace the input section:

```typescript
import { ChatInput } from '@/components/chat/ChatInput';
import { useChatWithAttachments } from '@/lib/hooks/useChatWithAttachments';

// Inside MeetingChat component:

const { isProcessing, prepareAttachments, buildPromptWithAttachments } = useChatWithAttachments({
  meetingId,
});

const handleSend = async (message: string, attachments: ChatAttachment[]) => {
  // Process attachments (transcribe audio if needed)
  const processedAttachments = await prepareAttachments(attachments);
  
  // Check for errors
  const errors = processedAttachments.filter(a => a.status === 'error');
  if (errors.length > 0) {
    // Show error toast
    return;
  }
  
  // Build full prompt with attachment contents
  const fullPrompt = buildPromptWithAttachments(message, processedAttachments);
  
  // Send to AI (using existing mutation)
  askMutation.mutate({ question: fullPrompt });
};

// In JSX, replace the old input with:
<ChatInput
  onSend={handleSend}
  isLoading={askMutation.isPending || isProcessing}
  placeholder="Ask about this meeting, paste a transcript, or attach audio..."
/>
```

---

## Files Summary

### New Files
- `apps/web/types/chat.ts`
- `apps/web/lib/hooks/useSmartPaste.ts`
- `apps/web/lib/hooks/useFileDropZone.ts`
- `apps/web/lib/hooks/useChatWithAttachments.ts`
- `apps/web/components/chat/AttachmentChip.tsx`
- `apps/web/components/chat/InlineRecorder.tsx`
- `apps/web/components/chat/ChatInput.tsx`

### Modified Files
- `apps/api/src/routes/audio.ts` (add transcribe-inline endpoint)
- `apps/web/components/meetings/MeetingChat.tsx` (use new ChatInput)

---

## Testing

```typescript
describe('Smart Chat Input', () => {
  describe('Smart Paste', () => {
    it('should convert large text paste to attachment');
    it('should allow small text to paste normally');
    it('should detect pasted audio files');
  });
  
  describe('File Drop', () => {
    it('should accept dropped audio files');
    it('should accept dropped text files');
    it('should reject unsupported file types');
    it('should reject files over 500MB');
  });
  
  describe('Inline Recording', () => {
    it('should start recording on click');
    it('should show audio level visualization');
    it('should create attachment when stopped');
  });
  
  describe('Attachment Processing', () => {
    it('should transcribe audio before sending');
    it('should include text content in prompt');
    it('should handle transcription errors');
  });
});
```

---

## Success Metrics

- Large paste (>500 chars) automatically becomes attachment
- Audio files can be dropped/attached to chat
- Inline recording works smoothly
- Audio is transcribed before AI analyzes
- No UI breakage with multiple attachments
- Processing states show clearly (uploading, transcribing)
