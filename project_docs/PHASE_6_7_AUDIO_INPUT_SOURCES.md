# Phase 6.7: Audio Input Sources

**Goal:** Enable recording and transcription beyond meeting bots — support audio file uploads and browser-based recording for in-person meetings.

**Model:** Default

---

## Pre-Phase Checklist

- [ ] Read PHASE_6_6_COMPLETE.md (or latest completed phase)
- [ ] Read project_docs/GOVERNANCE.md
- [ ] Verify current tests pass: `pnpm test`

---

## Mandatory Updates (CRITICAL)

After completing this phase, you MUST:
1. Create PHASE_6_7_COMPLETE.md with summary and key decisions
2. **Update project_docs/PHASES.md**:
   - Add Phase 6.7 section after Phase 6.6
   - Add row to Summary Table: `| 6.7 | Audio Input Sources | ✅ | 45-60 min |`
   - Update Total Estimated Time
   - Add entry to Change Log
3. Run all tests and record coverage

---

## Why This Matters

Current limitation: zigznote only works with Zoom/Meet/Teams via Recall.ai bots.

Competitors like Circleback also support:
- Upload existing audio files (mp3, wav, m4a, webm)
- Record in-person meetings via browser microphone
- Record phone calls (via mobile app - Phase 9)

This phase adds the first two capabilities.

---

=== EXECUTION RULES ===
1. DO NOT STOP until all tasks are complete and verified
2. If you encounter an error, fix it and continue
3. Run all commands and verify their output
4. Create all files with proper content (no placeholders)
5. Run tests and ensure they pass before completing
6. Follow the engineering principles in GOVERNANCE.md
7. Domain cohesion > line counts (large files OK if single responsibility)

=== TASK LIST (Execute All) ===

**6.7.1 Database Schema Updates**

Update packages/database/prisma/schema.prisma - modify Meeting model:

```prisma
model Meeting {
  // ... existing fields ...
  
  // Audio source tracking
  source          String    @default("bot") // "bot", "upload", "browser", "mobile"
  audioFileUrl    String?   @map("audio_file_url") // S3/storage URL for uploaded/recorded audio
  audioFileName   String?   @map("audio_file_name") // Original filename
  audioFileSize   Int?      @map("audio_file_size") // Size in bytes
  audioDuration   Int?      @map("audio_duration") // Duration in seconds (from file metadata)
  
  // ... rest of existing fields ...
}
```

Add source enum comment for clarity:
```prisma
// source values:
// - "bot": Recorded via Recall.ai meeting bot (Zoom, Meet, Teams, Webex)
// - "upload": User uploaded audio file
// - "browser": Recorded via browser microphone
// - "mobile": Recorded via mobile app (future)
```

Run migration:
```bash
pnpm db:migrate --name add_audio_sources
```

**6.7.2 File Storage Service**

Create apps/api/src/services/storageService.ts:

```typescript
/**
 * @ownership
 * @domain File Storage
 * @description Handles audio file uploads to S3-compatible storage
 * @single-responsibility YES — all file storage operations
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { BadRequestError } from '@zigznote/shared';

// Supported audio formats
const ALLOWED_MIME_TYPES = [
  'audio/mpeg',       // mp3
  'audio/mp3',        // mp3 alternate
  'audio/wav',        // wav
  'audio/wave',       // wav alternate
  'audio/x-wav',      // wav alternate
  'audio/webm',       // webm (browser recording)
  'audio/ogg',        // ogg
  'audio/mp4',        // m4a
  'audio/x-m4a',      // m4a alternate
  'audio/aac',        // aac
  'video/webm',       // webm with video (we extract audio)
] as const;

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const UPLOAD_EXPIRY = 60 * 60; // 1 hour for presigned URLs

export interface UploadResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  key: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresAt: Date;
}

class StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      region: config.aws?.region || 'us-east-1',
      endpoint: config.aws?.endpoint, // For S3-compatible services like MinIO, R2
      credentials: config.aws?.accessKeyId ? {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey!,
      } : undefined,
      forcePathStyle: !!config.aws?.endpoint, // Required for MinIO/R2
    });
    this.bucket = config.aws?.bucket || 'zigznote-audio';
  }

  /**
   * Validate file before upload
   */
  validateFile(mimeType: string, fileSize: number): void {
    if (!ALLOWED_MIME_TYPES.includes(mimeType as any)) {
      throw new BadRequestError(
        `Unsupported file type: ${mimeType}. Supported: mp3, wav, m4a, webm, ogg, aac`
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestError(
        `File too large: ${Math.round(fileSize / 1024 / 1024)}MB. Maximum: 500MB`
      );
    }
  }

  /**
   * Generate a presigned URL for direct browser upload
   * This allows uploading directly to S3 without going through our server
   */
  async getPresignedUploadUrl(
    organizationId: string,
    fileName: string,
    mimeType: string,
    fileSize: number
  ): Promise<PresignedUploadResult> {
    this.validateFile(mimeType, fileSize);

    const fileId = randomUUID();
    const extension = this.getExtension(fileName, mimeType);
    const key = `audio/${organizationId}/${fileId}${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: fileSize,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_EXPIRY,
    });

    const fileUrl = this.getPublicUrl(key);
    const expiresAt = new Date(Date.now() + UPLOAD_EXPIRY * 1000);

    return { uploadUrl, fileUrl, key, expiresAt };
  }

  /**
   * Upload file directly (for server-side uploads)
   */
  async uploadFile(
    organizationId: string,
    fileName: string,
    mimeType: string,
    body: Buffer | Uint8Array
  ): Promise<UploadResult> {
    this.validateFile(mimeType, body.length);

    const fileId = randomUUID();
    const extension = this.getExtension(fileName, mimeType);
    const key = `audio/${organizationId}/${fileId}${extension}`;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
    }));

    return {
      fileUrl: this.getPublicUrl(key),
      fileName,
      fileSize: body.length,
      mimeType,
      key,
    };
  }

  /**
   * Get a presigned URL for downloading/streaming
   */
  async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }

  /**
   * Get public URL for a file
   */
  private getPublicUrl(key: string): string {
    if (config.aws?.cdnUrl) {
      return `${config.aws.cdnUrl}/${key}`;
    }
    if (config.aws?.endpoint) {
      return `${config.aws.endpoint}/${this.bucket}/${key}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  /**
   * Get file extension from filename or mime type
   */
  private getExtension(fileName: string, mimeType: string): string {
    // Try to get from filename first
    const match = fileName.match(/\.[a-zA-Z0-9]+$/);
    if (match) return match[0].toLowerCase();

    // Fall back to mime type
    const mimeExtensions: Record<string, string> = {
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/wav': '.wav',
      'audio/wave': '.wav',
      'audio/x-wav': '.wav',
      'audio/webm': '.webm',
      'audio/ogg': '.ogg',
      'audio/mp4': '.m4a',
      'audio/x-m4a': '.m4a',
      'audio/aac': '.aac',
      'video/webm': '.webm',
    };

    return mimeExtensions[mimeType] || '.audio';
  }
}

export const storageService = new StorageService();
```

**6.7.3 Audio Processing Service**

Create apps/api/src/services/audioProcessingService.ts:

```typescript
/**
 * @ownership
 * @domain Audio Processing
 * @description Handles audio file processing for uploaded and recorded audio
 * @single-responsibility YES — audio processing pipeline for non-bot sources
 */

import { meetingRepository, transcriptRepository } from '@zigznote/database';
import { storageService } from './storageService';
import { transcriptionQueue } from '../jobs/queues';
import { logger } from '../utils/logger';
import { NotFoundError, BadRequestError } from '@zigznote/shared';

export interface CreateFromUploadInput {
  organizationId: string;
  userId: string;
  title: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  audioDuration?: number;
}

export interface CreateFromRecordingInput {
  organizationId: string;
  userId: string;
  title: string;
  audioBlob: Buffer;
  mimeType: string;
  duration: number;
}

class AudioProcessingService {
  /**
   * Create a meeting from an uploaded audio file
   */
  async createFromUpload(input: CreateFromUploadInput): Promise<{ meetingId: string }> {
    // Create meeting record
    const meeting = await meetingRepository.create({
      organizationId: input.organizationId,
      createdById: input.userId,
      title: input.title,
      source: 'upload',
      status: 'processing',
      audioFileUrl: input.fileUrl,
      audioFileName: input.fileName,
      audioFileSize: input.fileSize,
      audioDuration: input.audioDuration,
    });

    logger.info({ meetingId: meeting.id, fileName: input.fileName }, 'Created meeting from upload');

    // Queue for transcription
    await transcriptionQueue.add('transcribe-audio', {
      meetingId: meeting.id,
      audioUrl: input.fileUrl,
      organizationId: input.organizationId,
      source: 'upload',
    });

    return { meetingId: meeting.id };
  }

  /**
   * Create a meeting from browser-recorded audio
   */
  async createFromRecording(input: CreateFromRecordingInput): Promise<{ meetingId: string }> {
    // Upload to storage
    const fileName = `recording-${Date.now()}.webm`;
    const upload = await storageService.uploadFile(
      input.organizationId,
      fileName,
      input.mimeType,
      input.audioBlob
    );

    // Create meeting record
    const meeting = await meetingRepository.create({
      organizationId: input.organizationId,
      createdById: input.userId,
      title: input.title,
      source: 'browser',
      status: 'processing',
      audioFileUrl: upload.fileUrl,
      audioFileName: fileName,
      audioFileSize: upload.fileSize,
      audioDuration: input.duration,
    });

    logger.info({ meetingId: meeting.id, duration: input.duration }, 'Created meeting from browser recording');

    // Queue for transcription
    await transcriptionQueue.add('transcribe-audio', {
      meetingId: meeting.id,
      audioUrl: upload.fileUrl,
      organizationId: input.organizationId,
      source: 'browser',
    });

    return { meetingId: meeting.id };
  }

  /**
   * Get presigned upload URL for direct browser upload
   */
  async getUploadUrl(
    organizationId: string,
    fileName: string,
    mimeType: string,
    fileSize: number
  ) {
    return storageService.getPresignedUploadUrl(
      organizationId,
      fileName,
      mimeType,
      fileSize
    );
  }

  /**
   * Finalize an upload after file is uploaded to S3
   */
  async finalizeUpload(
    organizationId: string,
    userId: string,
    title: string,
    fileUrl: string,
    fileName: string,
    fileSize: number,
    audioDuration?: number
  ): Promise<{ meetingId: string }> {
    return this.createFromUpload({
      organizationId,
      userId,
      title,
      fileUrl,
      fileName,
      fileSize,
      audioDuration,
    });
  }
}

export const audioProcessingService = new AudioProcessingService();
```

**6.7.4 Update Config for AWS/Storage**

Add to apps/api/src/config/index.ts:

```typescript
export const config = {
  // ... existing config ...

  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.AWS_S3_BUCKET || 'zigznote-audio',
    endpoint: process.env.AWS_S3_ENDPOINT, // For S3-compatible (MinIO, R2, etc.)
    cdnUrl: process.env.AWS_CDN_URL, // CloudFront or CDN URL
  },
};
```

Add to .env.example:
```bash
# Storage (S3 or S3-compatible like MinIO, Cloudflare R2)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=zigznote-audio
AWS_S3_ENDPOINT=        # Optional: For MinIO/R2 (e.g., http://localhost:9000)
AWS_CDN_URL=            # Optional: CloudFront URL for faster delivery
```

**6.7.5 Audio Upload Routes**

Create apps/api/src/routes/audio.ts:

```typescript
/**
 * Audio upload and recording routes
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { audioProcessingService } from '../services/audioProcessingService';
import { requireAuth, asyncHandler, validateRequest, type AuthenticatedRequest } from '../middleware';

export const audioRouter: IRouter = Router();

audioRouter.use(requireAuth);

// Multer config for direct uploads (fallback if presigned URLs not used)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// Validation schemas
const getUploadUrlSchema = z.object({
  body: z.object({
    fileName: z.string().min(1).max(255),
    mimeType: z.string().min(1),
    fileSize: z.number().int().positive().max(500 * 1024 * 1024),
  }),
});

const finalizeUploadSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(500),
    fileUrl: z.string().url(),
    fileName: z.string().min(1).max(255),
    fileSize: z.number().int().positive(),
    audioDuration: z.number().int().positive().optional(),
  }),
});

const browserRecordingSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(500),
    duration: z.number().int().positive(),
  }),
});

/**
 * POST /api/v1/audio/upload-url
 * Get a presigned URL for direct upload to S3
 * This is the recommended approach for large files
 */
audioRouter.post(
  '/upload-url',
  validateRequest(getUploadUrlSchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    
    const result = await audioProcessingService.getUploadUrl(
      authReq.auth!.organizationId,
      req.body.fileName,
      req.body.mimeType,
      req.body.fileSize
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/audio/finalize
 * After uploading to S3 via presigned URL, call this to create the meeting
 */
audioRouter.post(
  '/finalize',
  validateRequest(finalizeUploadSchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;

    const result = await audioProcessingService.finalizeUpload(
      authReq.auth!.organizationId,
      authReq.auth!.userId,
      req.body.title,
      req.body.fileUrl,
      req.body.fileName,
      req.body.fileSize,
      req.body.audioDuration
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Audio uploaded. Processing will begin shortly.',
    });
  })
);

/**
 * POST /api/v1/audio/upload
 * Direct upload through our server (for smaller files or fallback)
 */
audioRouter.post(
  '/upload',
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No audio file provided' },
      });
    }

    const title = req.body.title || file.originalname.replace(/\.[^.]+$/, '');

    const result = await audioProcessingService.createFromRecording({
      organizationId: authReq.auth!.organizationId,
      userId: authReq.auth!.userId,
      title,
      audioBlob: file.buffer,
      mimeType: file.mimetype,
      duration: parseInt(req.body.duration) || 0,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Audio uploaded. Processing will begin shortly.',
    });
  })
);

/**
 * POST /api/v1/audio/recording
 * Save a browser recording
 */
audioRouter.post(
  '/recording',
  upload.single('audio'),
  validateRequest(browserRecordingSchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No audio file provided' },
      });
    }

    const result = await audioProcessingService.createFromRecording({
      organizationId: authReq.auth!.organizationId,
      userId: authReq.auth!.userId,
      title: req.body.title,
      audioBlob: file.buffer,
      mimeType: file.mimetype,
      duration: req.body.duration,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Recording saved. Processing will begin shortly.',
    });
  })
);
```

Register in apps/api/src/routes/api.ts:
```typescript
import { audioRouter } from './audio';

apiRouter.use('/v1/audio', audioRouter);
```

**6.7.6 Install Dependencies**

```bash
cd apps/api
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner multer
pnpm add -D @types/multer
```

**6.7.7 Update Transcription Worker**

Update services/transcription/src/processor.ts to handle non-bot audio:

The worker should already accept an audioUrl — verify it works with S3 URLs.

If the worker expects Recall.ai-specific data, update it:

```typescript
// In the job processor, check the source
interface TranscriptionJobData {
  meetingId: string;
  audioUrl: string;
  organizationId: string;
  source: 'bot' | 'upload' | 'browser' | 'mobile';
  // Optional Recall-specific fields (only present for bot source)
  recallBotId?: string;
}

// In processJob:
if (job.data.source === 'bot') {
  // Existing Recall.ai flow
  // Get audio from Recall
} else {
  // Direct audio URL (S3)
  // Send directly to Deepgram
  const audioUrl = job.data.audioUrl;
  const transcript = await deepgramService.transcribe(audioUrl, {
    organizationId: job.data.organizationId,
  });
}
```

**6.7.8 Frontend: Upload Component**

Create apps/web/components/audio/AudioUploader.tsx:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';

interface AudioUploaderProps {
  onUploadComplete?: (meetingId: string) => void;
}

const ACCEPTED_TYPES = {
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/x-wav': ['.wav'],
  'audio/webm': ['.webm'],
  'audio/mp4': ['.m4a'],
  'audio/x-m4a': ['.m4a'],
  'audio/ogg': ['.ogg'],
  'audio/aac': ['.aac'],
};

export function AudioUploader({ onUploadComplete }: AudioUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const audioFile = acceptedFiles[0];
    if (audioFile) {
      setFile(audioFile);
      setTitle(audioFile.name.replace(/\.[^.]+$/, '')); // Remove extension
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024, // 500MB
  });

  const handleUpload = async () => {
    if (!file || !title) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get presigned URL
      const urlResponse = await api.post<{
        uploadUrl: string;
        fileUrl: string;
        key: string;
      }>('/api/v1/audio/upload-url', {
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      if (!urlResponse.success || !urlResponse.data) {
        throw new Error(urlResponse.error?.message || 'Failed to get upload URL');
      }

      setProgress(10);

      // Step 2: Upload to S3
      const { uploadUrl, fileUrl } = urlResponse.data;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = 10 + (e.loaded / e.total) * 70; // 10-80%
            setProgress(Math.round(percent));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      setProgress(85);

      // Step 3: Finalize upload
      const finalizeResponse = await api.post<{ meetingId: string }>('/api/v1/audio/finalize', {
        title,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
      });

      if (!finalizeResponse.success || !finalizeResponse.data) {
        throw new Error(finalizeResponse.error?.message || 'Failed to process upload');
      }

      setProgress(100);

      // Success!
      onUploadComplete?.(finalizeResponse.data.meetingId);
      
      // Reset form
      setFile(null);
      setTitle('');
      setProgress(0);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-primary-400'}
            ${file ? 'border-green-500 bg-green-50' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          {file ? (
            <div className="space-y-2">
              <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-slate-600">
                {isDragActive ? 'Drop the audio file here' : 'Drag & drop an audio file, or click to select'}
              </p>
              <p className="text-xs text-slate-400">
                Supports MP3, WAV, M4A, WebM, OGG, AAC (up to 500MB)
              </p>
            </div>
          )}
        </div>

        {file && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Meeting Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for this recording"
              />
            </div>

            {uploading && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-slate-500 text-center">
                  {progress < 10 ? 'Preparing...' :
                   progress < 80 ? 'Uploading...' :
                   progress < 100 ? 'Processing...' : 'Complete!'}
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setTitle('');
                  setError(null);
                }}
                disabled={uploading}
              >
                Clear
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!title || uploading}
                isLoading={uploading}
              >
                Upload & Process
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

Install react-dropzone:
```bash
cd apps/web
pnpm add react-dropzone
```

**6.7.9 Frontend: Browser Recording Component**

Create apps/web/components/audio/BrowserRecorder.tsx:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface BrowserRecorderProps {
  onRecordingComplete?: (meetingId: string) => void;
}

type RecordingState = 'idle' | 'requesting' | 'recording' | 'paused' | 'uploading';

export function BrowserRecorder({ onRecordingComplete }: BrowserRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    setState('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setState('recording');

      // Start duration timer
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

    } catch (err) {
      setError('Could not access microphone. Please grant permission and try again.');
      setState('idle');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;
    if (!title.trim()) {
      setError('Please enter a title for this recording');
      return;
    }

    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current);

    // Stop recording
    mediaRecorderRef.current.stop();
    
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    setState('uploading');

    // Wait for final data
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create blob and upload
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');
    formData.append('title', title);
    formData.append('duration', String(duration));

    try {
      const response = await fetch('/api/v1/audio/recording', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        onRecordingComplete?.(data.data.meetingId);
        // Reset
        setTitle('');
        setDuration(0);
        setState('idle');
      } else {
        throw new Error(data.error?.message || 'Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recording');
      setState('idle');
    }
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    chunksRef.current = [];
    setTitle('');
    setDuration(0);
    setState('idle');
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
          </svg>
          Record In-Person Meeting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Title input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Meeting Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Team standup, Client meeting"
            disabled={state === 'uploading'}
          />
        </div>

        {/* Recording UI */}
        <div className="flex flex-col items-center py-6 space-y-4">
          {/* Duration display */}
          <div className="text-4xl font-mono font-bold text-slate-900">
            {formatDuration(duration)}
          </div>

          {/* Recording indicator */}
          {(state === 'recording' || state === 'paused') && (
            <div className="flex items-center gap-2">
              <span 
                className={`h-3 w-3 rounded-full ${
                  state === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'
                }`} 
              />
              <span className="text-sm text-slate-600">
                {state === 'recording' ? 'Recording...' : 'Paused'}
              </span>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            {state === 'idle' && (
              <Button onClick={startRecording} size="lg">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="6" />
                </svg>
                Start Recording
              </Button>
            )}

            {state === 'requesting' && (
              <Button disabled size="lg">
                Requesting microphone...
              </Button>
            )}

            {state === 'recording' && (
              <>
                <Button onClick={pauseRecording} variant="outline">
                  Pause
                </Button>
                <Button onClick={stopRecording} variant="destructive">
                  Stop & Save
                </Button>
              </>
            )}

            {state === 'paused' && (
              <>
                <Button onClick={resumeRecording}>
                  Resume
                </Button>
                <Button onClick={stopRecording} variant="destructive">
                  Stop & Save
                </Button>
              </>
            )}

            {state === 'uploading' && (
              <Button disabled isLoading size="lg">
                Saving recording...
              </Button>
            )}

            {(state === 'recording' || state === 'paused') && (
              <Button onClick={cancelRecording} variant="ghost">
                Cancel
              </Button>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        <p className="text-xs text-slate-400 text-center">
          Recording uses your browser's microphone. Works best in a quiet environment.
        </p>
      </CardContent>
    </Card>
  );
}
```

**6.7.10 Frontend: New Meeting Page**

Create apps/web/app/(dashboard)/meetings/new/page.tsx:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AudioUploader } from '@/components/audio/AudioUploader';
import { BrowserRecorder } from '@/components/audio/BrowserRecorder';

export default function NewMeetingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('upload');

  const handleComplete = (meetingId: string) => {
    router.push(`/meetings/${meetingId}`);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">New Meeting</h1>
        <p className="text-slate-500 mt-1">
          Upload a recording or record an in-person meeting
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="upload">Upload Audio</TabsTrigger>
          <TabsTrigger value="record">Record Meeting</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <AudioUploader onUploadComplete={handleComplete} />
        </TabsContent>

        <TabsContent value="record">
          <BrowserRecorder onRecordingComplete={handleComplete} />
        </TabsContent>
      </Tabs>

      <div className="mt-8 p-4 bg-slate-50 rounded-lg">
        <h3 className="font-medium text-slate-900 mb-2">Other options</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• For Zoom, Google Meet, or Teams meetings, go to your calendar and the bot will join automatically</li>
          <li>• Or paste a meeting link on the meetings page to send a bot</li>
        </ul>
      </div>
    </div>
  );
}
```

**6.7.11 Update Navigation**

Add "New Meeting" to the sidebar/header navigation.

Update apps/web/components/layout/Sidebar.tsx to add:
```tsx
// In the navigation items array
{ name: 'New Meeting', href: '/meetings/new', icon: PlusCircleIcon },
```

**6.7.12 Export Components**

Create apps/web/components/audio/index.ts:
```typescript
export { AudioUploader } from './AudioUploader';
export { BrowserRecorder } from './BrowserRecorder';
```

---

=== VERIFICATION CHECKLIST ===

Before completing, verify:
- [ ] `pnpm db:migrate` runs successfully
- [ ] `pnpm build` succeeds for all packages
- [ ] `pnpm test` passes all tests
- [ ] Audio upload works (presigned URL flow)
- [ ] Browser recording works (MediaRecorder → upload)
- [ ] Uploaded audio gets transcribed and summarized
- [ ] Meeting shows correct source ("upload" or "browser")
- [ ] /meetings/new page renders correctly
- [ ] **PHASES.md updated with Phase 6.7 section**
- [ ] PHASE_6_7_COMPLETE.md created

---

=== UPDATE PHASES.md ===

Add this section to project_docs/PHASES.md after Phase 6.6:

```markdown
## Phase 6.7: Audio Input Sources

**Status:** ✅ Complete
**Estimated Time:** 45-60 minutes

### Planned Deliverables
- Audio file upload (mp3, wav, m4a, webm, ogg, aac)
- Presigned URL upload for large files
- Browser-based recording (MediaRecorder API)
- S3-compatible storage integration
- New meeting page with upload/record tabs
- Integration with existing transcription pipeline

### Key Features
| Feature | Purpose |
|---------|---------|
| File Upload | Process existing recordings |
| Browser Recording | Record in-person meetings |
| Presigned URLs | Efficient large file uploads |
| Multi-format Support | MP3, WAV, M4A, WebM, OGG, AAC |

### Key Decisions Made
_Fill after completion_

### Actual Changes from Plan
_Fill after completion_

### Handoff File
`PHASE_6_7_COMPLETE.md`
```

Add row to Summary Table:
```
| 6.7 | Audio Input Sources | ✅ | 45-60 min |
```

Add to Change Log:
```
| 2026-01-XX | Phase 6.7 | Audio upload and browser recording for in-person meetings |
```

---

=== GIT COMMIT ===

```bash
git add .
git commit -m "feat: add audio upload and browser recording

- Audio file upload with presigned S3 URLs (mp3, wav, m4a, webm, ogg, aac)
- Browser-based recording using MediaRecorder API
- S3-compatible storage service (works with AWS, MinIO, R2)
- New /meetings/new page with upload and record tabs
- Meeting source tracking (bot, upload, browser, mobile)
- Integration with existing transcription and summarization pipeline
- Drag-and-drop upload with progress indicator"
```

---

## Summary

After completing Phase 6.7:

| Recording Method | Status |
|------------------|--------|
| Meeting bots (Zoom, Meet, Teams) | ✅ Already done |
| Audio file upload | ✅ |
| Browser recording | ✅ |
| Mobile app recording | Phase 9 (future) |

This matches Circleback's core recording capabilities. Mobile app is the only remaining gap.

Ready for Phase 7: Admin Panel.
