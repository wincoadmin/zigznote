# Phase 6.7: Audio Input Sources - COMPLETE

**Date:** 2026-01-05
**Status:** Complete

## Summary

Implemented audio file uploads and browser-based recording as alternative meeting input sources. Users can now upload audio files (MP3, WAV, M4A, etc.) or record in-person meetings directly from the browser. Files are stored in S3 (or S3-compatible storage) and automatically processed through the transcription pipeline.

## What Was Built

### 1. Database Schema Updates

Added audio source fields to Meeting model:
- `source` - Origin type: "bot", "upload", "browser", "mobile"
- `audioFileUrl` - S3/storage URL
- `audioFileName` - Original filename
- `audioFileSize` - Size in bytes
- `audioDuration` - Duration in seconds
- Added index on `source` field

### 2. Storage Service

Location: `apps/api/src/services/storageService.ts`

Features:
- S3/S3-compatible storage (AWS, MinIO, Cloudflare R2)
- Presigned URL generation for direct browser uploads
- File validation (type and size)
- CDN support for file delivery

Supported Formats:
| Format | MIME Types |
|--------|------------|
| MP3 | audio/mpeg, audio/mp3 |
| WAV | audio/wav, audio/wave, audio/x-wav |
| WebM | audio/webm, video/webm |
| M4A | audio/mp4, audio/x-m4a |
| OGG | audio/ogg |
| AAC | audio/aac |

### 3. Audio Processing Service

Location: `apps/api/src/services/audioProcessingService.ts`

Methods:
- `createFromUpload()` - Create meeting from uploaded file
- `createFromRecording()` - Create meeting from browser recording
- `getUploadUrl()` - Get presigned URL for direct upload
- `finalizeUpload()` - Complete upload and queue transcription

### 4. API Routes

Location: `apps/api/src/routes/audio.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/audio/upload-url` | Get presigned URL for S3 upload |
| POST | `/audio/finalize` | Finalize upload after S3 transfer |
| POST | `/audio/upload` | Direct upload through server |
| POST | `/audio/recording` | Save browser recording |

### 5. Frontend Components

**AudioUploader** (`apps/web/components/audio/AudioUploader.tsx`)
- Drag-and-drop file upload
- Progress indicator with stages
- Large file support via presigned URLs
- Automatic title extraction from filename

**BrowserRecorder** (`apps/web/components/audio/BrowserRecorder.tsx`)
- MediaRecorder API integration
- Pause/resume functionality
- Duration display
- WebM + Opus codec for quality

**New Meeting Page** (`apps/web/app/(dashboard)/meetings/new/page.tsx`)
- Tabbed interface: Upload / Record
- Redirect to meeting page on completion
- Alternative input options info

### 6. API Client Updates

Location: `apps/web/lib/api.ts`

Added `audioApi`:
- `getUploadUrl()` - Request presigned URL
- `finalizeUpload()` - Complete upload process
- `uploadDirect()` - Server-side upload fallback
- `uploadRecording()` - Submit browser recording

### 7. Configuration

Added to `apps/api/src/config/index.ts`:
```typescript
aws: {
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  bucket: process.env.AWS_S3_BUCKET,
  endpoint: process.env.AWS_S3_ENDPOINT,  // For S3-compatible
  cdnUrl: process.env.AWS_CDN_URL,
}
```

Updated `.env.example` with storage variables.

## Test Coverage

| Component | Tests |
|-----------|-------|
| API | 227 tests |
| Transcription Worker | 96 tests |
| Summarization Worker | 95 tests |
| Web | 141 tests |
| **Total** | **559 tests** |

All tests passing.

## Files Created/Modified

### New Files
- `apps/api/src/services/storageService.ts`
- `apps/api/src/services/audioProcessingService.ts`
- `apps/api/src/routes/audio.ts`
- `apps/web/components/audio/AudioUploader.tsx`
- `apps/web/components/audio/BrowserRecorder.tsx`
- `apps/web/components/audio/index.ts`
- `apps/web/app/(dashboard)/meetings/new/page.tsx`

### Modified Files
- `packages/database/prisma/schema.prisma` - Added audio fields to Meeting
- `packages/database/src/types/index.ts` - Updated CreateMeetingInput
- `packages/database/src/repositories/meetingRepository.ts` - Updated create method
- `packages/shared/src/queues/index.ts` - Extended TranscriptionJobData
- `services/transcription/src/types.ts` - Extended TranscriptionJob
- `apps/api/src/config/index.ts` - Added AWS config
- `apps/api/src/routes/api.ts` - Registered audioRouter
- `apps/web/lib/api.ts` - Added audioApi
- `.env.example` - Added storage variables

## Commands to Verify

```bash
# Generate Prisma client
pnpm --filter @zigznote/database generate

# Run all tests
pnpm --filter @zigznote/api test && pnpm --filter @zigznote/transcription-worker test && pnpm --filter @zigznote/summarization-worker test && pnpm --filter @zigznote/web test -- --passWithNoTests --maxWorkers=2
```

## API Examples

### Get Presigned Upload URL
```bash
curl -X POST http://localhost:3001/api/v1/audio/upload-url \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"fileName": "meeting.mp3", "mimeType": "audio/mpeg", "fileSize": 15000000}'
```

### Finalize Upload
```bash
curl -X POST http://localhost:3001/api/v1/audio/finalize \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Q4 Planning Meeting",
    "fileUrl": "https://bucket.s3.amazonaws.com/audio/org-123/file.mp3",
    "fileName": "meeting.mp3",
    "fileSize": 15000000,
    "audioDuration": 3600
  }'
```

### Direct Upload (smaller files)
```bash
curl -X POST http://localhost:3001/api/v1/audio/upload \
  -H "Authorization: Bearer sk_live_..." \
  -F "audio=@meeting.mp3" \
  -F "title=Team Standup"
```

## Key Design Decisions

1. **Presigned URLs**: Files >10MB should use presigned URLs for efficiency
2. **S3 Compatibility**: Works with AWS S3, MinIO, Cloudflare R2
3. **Source Tracking**: Meeting.source distinguishes bot/upload/browser/mobile
4. **Unified Pipeline**: Same transcription flow regardless of source
5. **Browser Recording**: WebM + Opus for optimal quality/size balance
6. **Graceful Fallback**: Server-side upload if S3 not configured

## Notes for Next Phase

- Phase 7 (Admin Panel) can add storage quota management
- Future: Mobile app recording (source: "mobile")
- Future: Direct integration with conferencing APIs for audio extraction

## Before/After Example

**Before (Phase 6.6.1):**
Only meeting bots via Recall.ai could create transcribable meetings.

**After (Phase 6.7):**
- Upload audio files from external recordings
- Record in-person meetings via browser
- All sources processed through same pipeline

---

**Phase 6.7 Complete. Ready for Phase 7 (Admin Panel) or Phase 8 (Search & Polish).**
