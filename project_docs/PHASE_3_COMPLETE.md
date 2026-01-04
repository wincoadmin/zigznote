# Phase 3: Meeting Bots and Transcription - Complete

**Completed**: 2026-01-04

## Summary

Phase 3 implements the core meeting recording and transcription infrastructure for zigznote. This includes Recall.ai integration for bot management, Deepgram for speech-to-text, and WebSocket support for real-time updates.

## What Was Built

### 1. Recall.ai Integration (`apps/api/src/services/recallService.ts`)
- **Bot Lifecycle Management**: Create, stop, and monitor meeting bots
- **Meeting URL Parsing**: Support for Zoom, Google Meet, Teams, and Webex URLs
- **Webhook Handler**: Process bot events (join, leave, recording ready, transcription, errors)
- **Password Extraction**: Extract meeting passwords from calendar event bodies
- **Status Mapping**: Convert Recall.ai statuses to zigznote statuses

### 2. Bot Management Endpoints (`apps/api/src/routes/meetings.ts`)
- `POST /api/v1/meetings/:id/bot` - Create a bot for a meeting
- `GET /api/v1/meetings/:id/bot` - Get bot status and recording info
- `DELETE /api/v1/meetings/:id/bot` - Stop a bot
- Automatic duplicate bot detection
- Recording URL retrieval when available

### 3. Deepgram Transcription Service (`services/transcription/src/deepgramService.ts`)
- **Audio Transcription**: From URL or buffer
- **Speaker Diarization**: Extract and label speakers
- **Segment Processing**: Group words into speaker segments
- **Quality Warnings**: Flag low confidence transcripts (< 0.7)
- **Utility Functions**: Timing conversions, segment formatting

### 4. Transcription Job Processor (`services/transcription/src/processor.ts`)
- Process audio through Deepgram Nova-2
- Store transcripts in database
- Add meeting participants from speakers
- Queue summarization jobs
- Skip meetings under 30 seconds
- Handle job failures with permanent failure tracking

### 5. WebSocket Server (`apps/api/src/websocket/`)
- Socket.IO integration with Express
- Room-based broadcasting for meetings
- **Events Emitted**:
  - `bot.status` - Bot status changes
  - `transcript.chunk` - Real-time transcript chunks
  - `transcript.complete` - Transcription finished
  - `summary.complete` - Summary generated
  - `meeting.updated` - Meeting status changes

### 6. Webhook Handler (`apps/api/src/routes/webhooks/recall.ts`)
- HMAC-SHA256 signature verification
- Event processing for all bot lifecycle events
- Error-safe processing (returns 200 to prevent retries)

## Key Design Decisions

1. **WebSocket Architecture**: Used Socket.IO for robust connection handling and room-based broadcasting. Each meeting gets its own room for targeted updates.

2. **Error Classes**: Used specific `RecallApiError` and `DeepgramApiError` classes for better error handling and logging.

3. **Job Processing**: BullMQ with configurable concurrency and 5-minute lock duration for long transcription jobs.

4. **Segment Merging**: Adjacent segments from the same speaker are merged for cleaner transcripts.

5. **Quality Threshold**: 0.7 confidence threshold triggers quality warnings for potentially poor audio.

## Test Coverage

### API Tests (74 tests passing)
- `recallService.test.ts` - URL parsing, bot lifecycle, webhook verification
- `botEndpoints.test.ts` - Bot creation, status, stop endpoints
- `bots.edge-cases.test.ts` - URL edge cases, error handling
- `websocket.test.ts` - Connection, room management, event broadcasting
- `meetings.test.ts` - Core meeting CRUD
- `health.test.ts` - Health check endpoints

### Transcription Tests (33 tests passing)
- `deepgramService.test.ts` - Transcription, result processing, speaker extraction
- `edge-cases.test.ts` - Empty audio, many speakers, low confidence, special characters

### Web Tests (11 tests passing)
- `utils.test.ts` - Utility functions

**Total: 118 tests passing**

## Files Created/Modified

### New Files
```
apps/api/src/services/recallService.ts
apps/api/src/routes/webhooks/recall.ts
apps/api/src/websocket/types.ts
apps/api/src/websocket/server.ts
apps/api/src/websocket/index.ts
apps/api/tests/recallService.test.ts
apps/api/tests/botEndpoints.test.ts
apps/api/tests/bots.edge-cases.test.ts
apps/api/tests/websocket.test.ts
services/transcription/src/types.ts
services/transcription/src/deepgramService.ts
services/transcription/src/processor.ts
services/transcription/src/utils/timing.ts
services/transcription/src/utils/diarization.ts
services/transcription/src/utils/segments.ts
services/transcription/src/utils/index.ts
services/transcription/tests/deepgramService.test.ts
services/transcription/tests/edge-cases.test.ts
services/transcription/jest.config.js
```

### Modified Files
```
apps/api/src/config/index.ts - Added Recall.ai and Deepgram config
apps/api/src/app.ts - Added webhook route
apps/api/src/index.ts - Added WebSocket server initialization
apps/api/src/routes/meetings.ts - Added bot endpoints
apps/api/src/controllers/meetingController.ts - Added bot methods
apps/api/src/jobs/index.ts - Export addTranscriptionJob
services/transcription/src/index.ts - Use processor
```

## Verification Commands

```bash
# Build all packages
pnpm --filter @zigznote/shared build
pnpm --filter @zigznote/database build
pnpm --filter @zigznote/api build
pnpm --filter @zigznote/transcription-worker build
pnpm --filter @zigznote/web build

# Run all tests
pnpm --filter @zigznote/api test
pnpm --filter @zigznote/transcription-worker test
pnpm --filter @zigznote/web test
```

## Environment Variables Required

```env
# Recall.ai
RECALL_API_KEY=your_recall_api_key
RECALL_WEBHOOK_SECRET=your_webhook_secret
RECALL_BASE_URL=https://us-west-2.recall.ai/api/v1
RECALL_BOT_NAME=zigznote Assistant

# Deepgram
DEEPGRAM_API_KEY=your_deepgram_api_key
DEEPGRAM_BASE_URL=https://api.deepgram.com/v1
```

## Notes for Next Phase (Phase 4: Summarization)

1. **Summarization Queue Ready**: Jobs are queued to `summarization` queue after transcription completes
2. **Job Data**: Contains `meetingId` and `transcriptId` for processing
3. **WebSocket Integration**: `emitSummaryComplete` function ready to broadcast summary completion
4. **Database Schema**: Summary and ActionItem models already in place from Phase 1

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐
│  Recall.ai      │     │   Deepgram      │
│  (Meeting Bots) │     │  (Transcription)│
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│              Express API                 │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │ Bot Routes   │  │ Webhook Handler  │ │
│  └──────┬───────┘  └────────┬─────────┘ │
│         │                   │           │
│         ▼                   ▼           │
│  ┌──────────────────────────────────┐   │
│  │       RecallService              │   │
│  └──────────────────────────────────┘   │
│                  │                      │
│                  ▼                      │
│  ┌──────────────────────────────────┐   │
│  │    Socket.IO WebSocket Server    │◄──┼─── Clients
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│   BullMQ        │────►│  Transcription  │
│   (Redis)       │     │     Worker      │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │
│   (Prisma)      │
└─────────────────┘
```
