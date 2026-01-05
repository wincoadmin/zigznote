# Phase 6.6.1: Intelligent Speaker Recognition - COMPLETE

**Date:** 2026-01-05
**Status:** Complete

## Summary

Implemented intelligent speaker recognition that automatically detects speaker names from verbal introductions (e.g., "Hi, I'm Sarah") and persists voice profiles across meetings. This matches Circleback's speaker identification capability.

## What Was Built

### 1. Database Schema Updates

Added three new Prisma models:

**VoiceProfile** - Cross-meeting speaker persistence
- `id`, `organizationId`, `displayName`, `email`, `userId`
- `voiceEmbedding` (Bytes), `voiceHash` (String) - for future voice matching
- `sampleCount`, `totalDuration`, `confidence` - learning metadata
- `firstMeetingId`, `lastMeetingId` - source tracking
- Unique constraint: `[organizationId, email]`

**SpeakerMatch** - Per-meeting speaker identification
- `id`, `meetingId`, `voiceProfileId`, `speakerLabel`
- `matchMethod`: "introduction", "voice_match", "calendar", "manual"
- `confidence`, `detectedPhrase`, `detectedAt`
- Unique constraints: `[meetingId, speakerLabel]`, `[meetingId, voiceProfileId]`

**NamePattern** - Configurable detection patterns
- `id`, `organizationId` (null for global)
- `pattern` (regex), `nameGroup`, `priority`, `isActive`

### 2. Name Detector Service
Location: `services/transcription/src/nameDetector.ts`

Features:
- 7 built-in detection patterns ordered by confidence (0.6-0.95)
- Custom pattern support per organization
- False positive prevention (days, months, common words)
- Case-insensitive name normalization
- Introduction window focus (first 5 minutes prioritized)

Detection Patterns:
| Pattern | Example | Confidence |
|---------|---------|------------|
| intro_im | "Hi, I'm Sarah" | 0.95 |
| intro_name_is | "My name is John Smith" | 0.95 |
| intro_this_is | "This is Jennifer from marketing" | 0.90 |
| intro_speaking | "Michael speaking" | 0.85 |
| intro_joining | "Chris joining from NY" | 0.80 |
| intro_its | "It's Amanda here" | 0.75 |
| thanks_name | "Thanks Sarah" | 0.60 |

### 3. Voice Profile Service
Location: `apps/api/src/services/voiceProfileService.ts`

Methods:
- `createProfile()` - Create new voice profile
- `findOrCreateByName()` - Case-insensitive lookup or create
- `recordMatch()` - Upsert speaker match for meeting
- `getMeetingSpeakers()` - Get identified speakers
- `getSpeakerAliasMap()` - Get Map<speakerLabel, displayName>
- `matchFromCalendarParticipants()` - Match by email
- `confirmMatch()` - Adjust confidence (+/-0.1)
- `mergeProfiles()` - Combine duplicate profiles
- `deleteProfile()` - Remove profile

### 4. Speaker Recognition Processor
Location: `services/transcription/src/speakerRecognition.ts`

Pipeline:
1. Apply existing manual aliases (highest priority)
2. Load calendar participant profiles (for context)
3. Detect names from introductions
4. Find or create voice profiles
5. Record speaker matches
6. Return merged speaker map

### 5. Transcription Pipeline Integration
Location: `services/transcription/src/processor.ts`

Added speaker recognition step after transcription, before post-processing:
- Convert segments to recognition format
- Run speaker recognition
- Merge detected names with existing aliases
- Use merged aliases for post-processing

### 6. API Routes
Location: `apps/api/src/routes/voiceProfiles.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/voice-profiles` | List all profiles |
| GET | `/voice-profiles/:id` | Get profile with matches |
| POST | `/voice-profiles` | Create profile |
| PATCH | `/voice-profiles/:id` | Update profile |
| DELETE | `/voice-profiles/:id` | Delete profile |
| POST | `/voice-profiles/merge` | Merge two profiles |
| GET | `/voice-profiles/meetings/:id/speakers` | Get meeting speakers |
| POST | `/voice-profiles/meetings/:id/speakers/reprocess` | Re-detect names |
| POST | `/voice-profiles/meetings/:id/speakers/:label/confirm` | Confirm/reject |

### 7. Frontend Components

**SpeakerEditor** (`apps/web/components/meetings/SpeakerEditor.tsx`)
- Display identified speakers with confidence
- Confirm/reject auto-detected names
- Edit speaker names manually
- Re-process speaker detection

**API Client** (`apps/web/lib/api.ts`)
- Added `voiceProfilesApi` with all API methods
- Added `speakersApi` for speaker alias management
- TypeScript interfaces for VoiceProfile and SpeakerIdentification

## Test Coverage

| Component | Tests |
|-----------|-------|
| Name Detector | 24 tests |
| Voice Profile Service | 17 tests |
| Transcription Worker | 96 tests total |
| Summarization Worker | 95 tests |
| API | 227 tests total |
| Web | 141 tests |
| **Total** | **559 tests** |

All tests passing.

## Files Created/Modified

### New Files
- `packages/database/prisma/schema.prisma` - Added 3 models
- `services/transcription/src/nameDetector.ts`
- `services/transcription/src/speakerRecognition.ts`
- `services/transcription/tests/nameDetector.test.ts`
- `apps/api/src/services/voiceProfileService.ts`
- `apps/api/src/routes/voiceProfiles.ts`
- `apps/api/tests/services/voiceProfileService.test.ts`
- `apps/web/components/meetings/SpeakerEditor.tsx`

### Modified Files
- `packages/database/prisma/schema.prisma` - Updated Organization, User, Meeting relations
- `services/transcription/src/processor.ts` - Added speaker recognition step
- `apps/api/src/routes/api.ts` - Registered voiceProfiles router
- `apps/api/src/services/index.ts` - Export voiceProfileService
- `apps/web/lib/api.ts` - Added voiceProfilesApi and speakersApi

## Commands to Verify

```bash
# Generate Prisma client
pnpm --filter @zigznote/database generate

# Run transcription worker tests
pnpm --filter @zigznote/transcription-worker test

# Run API tests
pnpm --filter @zigznote/api test

# Run all tests
pnpm --filter @zigznote/api test && pnpm --filter @zigznote/transcription-worker test && pnpm --filter @zigznote/summarization-worker test && pnpm --filter @zigznote/web test -- --passWithNoTests --maxWorkers=2
```

## API Examples

### Get Meeting Speakers
```bash
curl -X GET http://localhost:3001/api/v1/voice-profiles/meetings/{meetingId}/speakers \
  -H "Authorization: Bearer sk_live_..."
```

### Confirm Speaker Detection
```bash
curl -X POST http://localhost:3001/api/v1/voice-profiles/meetings/{meetingId}/speakers/Speaker%200/confirm \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"confirmed": true}'
```

### Create Voice Profile
```bash
curl -X POST http://localhost:3001/api/v1/voice-profiles \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"displayName": "Sarah Johnson", "email": "sarah@example.com"}'
```

### Merge Profiles
```bash
curl -X POST http://localhost:3001/api/v1/voice-profiles/merge \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"keepId": "profile-1-uuid", "mergeId": "profile-2-uuid"}'
```

## Key Design Decisions

1. **Detection Priority**: Self-introductions (0.95) > Context from others (0.60)
2. **Introduction Window**: First 5 minutes have higher confidence
3. **Late Joiner Handling**: Still detected, but 10% confidence penalty
4. **Graceful Degradation**: Speaker recognition failure doesn't break transcription
5. **Profile Persistence**: Voice profiles persist across meetings in same organization
6. **Confirmation Learning**: User confirmations adjust profile confidence

## Notes for Next Phase

- Phase 6.7 (Audio Input Sources) should use voice profiles for multi-source recognition
- Phase 7 (Admin Panel) should include voice profile management for admins
- Future: Add voice embedding matching for speaker identification without introductions
- Future: Auto-detect names from calendar invites

## Before/After Example

**Before (Phase 6.6):**
```
Speaker 0: I think we should proceed with the budget.
Speaker 1: That sounds good to me.
```

**After (Phase 6.6.1):**
```
Sarah: I think we should proceed with the budget.
John: That sounds good to me.
```

---

**Phase 6.6.1 Complete. Ready for Phase 6.7 (Audio Input Sources) or Phase 7 (Admin Panel).**
