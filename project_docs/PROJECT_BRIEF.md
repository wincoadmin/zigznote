# zigznote - Project Brief

## Vision
Build **zigznote** — a best-in-class AI meeting assistant that automatically joins meetings, transcribes conversations, generates intelligent summaries, extracts action items, and integrates with CRMs and productivity tools.

**Tagline**: "Your meetings, simplified"

---

## Target Users
- Sales teams (discovery calls, demos, follow-ups)
- Product teams (user interviews, sprint planning)
- Recruiters (candidate interviews)
- Consultants (client meetings)
- Anyone who has too many meetings

---

## Core Features

### 🎯 MVP (Phase 1) - Target: 8-10 weeks

#### Authentication & User Management
- [ ] User signup/login via Clerk
- [ ] Organization/team support
- [ ] Role-based access (admin, member)

#### Calendar Integration
- [ ] Google Calendar OAuth connection
- [ ] Sync upcoming meetings with video links
- [ ] Auto-detect Zoom/Meet/Teams links
- [ ] Show meeting participants from calendar

#### Meeting Bot
- [ ] Integrate Recall.ai for bot management
- [ ] Bot auto-joins scheduled meetings
- [ ] Bot manual invite via link
- [ ] Bot naming customization
- [ ] Recording status notifications

#### Transcription
- [ ] Deepgram Nova-3 integration
- [ ] Real-time transcript streaming (websocket)
- [ ] Speaker diarization (who said what)
- [ ] 95%+ accuracy target
- [ ] Support for 30+ languages

#### AI Summaries
- [ ] Claude 3.5 Sonnet for summarization
- [ ] Structured summary by topics
- [ ] Action items with assignees
- [ ] Key decisions highlighted
- [ ] Custom summary prompts (user-defined)

#### Dashboard UI
- [ ] Upcoming meetings view
- [ ] Past meetings library
- [ ] Meeting detail page with:
  - Audio/video player
  - Synced transcript (click to jump)
  - Summary panel
  - Action items list
- [ ] Search across all meetings

---

### 🚀 Phase 2 - Target: 6-8 weeks

#### Advanced Features
- [ ] Voice memory (remember speaker names across meetings)
- [ ] Video clip creation (shareable highlights)
- [ ] Custom insights extraction (user-defined fields)
- [ ] Meeting templates by type (sales, interview, etc.)

#### Integrations
- [ ] Slack (send summaries to channels)
- [ ] HubSpot CRM (log meetings, update contacts)
- [ ] Salesforce CRM (log meetings, update opportunities)
- [ ] Notion (create pages from meetings)
- [ ] Linear/Asana (create tasks from action items)
- [ ] Zapier webhook (connect to anything)

#### Search & Intelligence
- [ ] Semantic search with pgvector
- [ ] AI assistant to query past meetings
- [ ] Filter by date, participants, tags

---

### 🏢 Phase 3 - Target: 8-10 weeks

#### Mobile App
- [ ] React Native app (iOS + Android)
- [ ] Record in-person meetings
- [ ] Offline recording with sync
- [ ] Push notifications
- [ ] View meetings and summaries

#### Enterprise Features
- [ ] Microsoft Outlook calendar
- [ ] Microsoft Teams meeting support
- [ ] SSO (SAML/OIDC)
- [ ] Audit logs
- [ ] Custom data retention policies
- [ ] HIPAA compliance option

#### Conversation Intelligence
- [ ] Talk-to-listen ratio analytics
- [ ] Question tracking
- [ ] Sentiment analysis
- [ ] Multi-meeting trend reports

---

## Technical Architecture

### Services Overview
```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                                │
│  Next.js App (Dashboard, Settings, Meeting Viewer)          │
│  React Native App (Mobile recording, viewing)               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                               │
│  Node.js/Express API (REST + WebSocket)                     │
│  - Authentication (Clerk)                                   │
│  - Meeting CRUD                                             │
│  - Calendar sync                                            │
│  - Bot management                                           │
│  - Search endpoints                                         │
└────────┬────────────────┬───────────────────┬───────────────┘
         │                │                   │
         ▼                ▼                   ▼
┌─────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│  PostgreSQL │  │  Redis + BullMQ │  │  Third-Party APIs    │
│  + pgvector │  │  (Job Queues)   │  │  - Recall.ai (bots)  │
│             │  │                 │  │  - Deepgram (STT)    │
│  - Users    │  │  - Transcribe   │  │  - Claude (LLM)      │
│  - Meetings │  │  - Summarize    │  │  - Google Calendar   │
│  - Transcripts│ │  - Sync CRM    │  │  - Slack, HubSpot    │
│  - Embeddings│ │  - Send notifs  │  └──────────────────────┘
└─────────────┘  └─────────────────┘
```

### Database Schema (Core Tables)
```sql
-- Users and organizations
users (id, email, name, clerk_id, org_id, role, created_at)
organizations (id, name, plan, settings, created_at)

-- Calendar connections
calendar_connections (id, user_id, provider, access_token, refresh_token)

-- Meetings
meetings (id, org_id, title, platform, meeting_url, start_time, end_time, status)
meeting_participants (id, meeting_id, name, email, speaker_label)

-- Transcripts and content
transcripts (id, meeting_id, segments JSONB, full_text, word_count)
summaries (id, meeting_id, content JSONB, model_used, created_at)
action_items (id, meeting_id, text, assignee, due_date, completed)

-- Search
transcript_embeddings (id, meeting_id, chunk_text, embedding vector(1536))

-- Integrations
integration_connections (id, org_id, provider, credentials, settings)
automation_rules (id, org_id, trigger, actions JSONB, enabled)
```

---

## API Endpoints (MVP)

### Auth
- `POST /auth/webhook` - Clerk webhook handler

### Meetings
- `GET /meetings` - List meetings (with filters)
- `GET /meetings/:id` - Get meeting details
- `POST /meetings` - Create manual meeting
- `DELETE /meetings/:id` - Delete meeting
- `POST /meetings/:id/bot` - Send bot to meeting

### Transcripts
- `GET /meetings/:id/transcript` - Get transcript
- `WS /meetings/:id/transcript/live` - Live transcript stream

### Summaries
- `GET /meetings/:id/summary` - Get summary
- `POST /meetings/:id/summary/regenerate` - Regenerate summary

### Calendar
- `GET /calendar/connect` - Start OAuth flow
- `GET /calendar/callback` - OAuth callback
- `POST /calendar/sync` - Force sync
- `GET /calendar/events` - List upcoming events

### Search
- `GET /search` - Search meetings (query, filters)
- `POST /search/ask` - AI assistant query

---

## Third-Party API Costs (Estimated)

| Service | Cost | Notes |
|---------|------|-------|
| Deepgram Nova-3 | $0.0043/min | ~$0.26 per 1-hour meeting |
| Claude 3.5 Sonnet | ~$0.05/meeting | For summaries |
| Recall.ai | $0.02-0.05/min | Bot hosting |
| OpenAI Embeddings | $0.0001/1K tokens | For search |
| **Total per meeting** | **~$3-5** | 1-hour meeting |

---

## Success Metrics
- Transcription accuracy: >95%
- Summary quality: Users don't edit before sharing (>80%)
- Processing time: Summary available <2 min after meeting
- Uptime: 99.9%
- User retention: >60% weekly active

---

## Competitive Advantages to Build
1. **Best summary quality** - Use Claude, fine-tune prompts
2. **Custom insights** - User-defined extraction fields
3. **Multi-meeting intelligence** - Trends across all meetings
4. **Fair pricing** - Usage-based, not per-seat
5. **Open API** - Let developers build on top

---

## Reference Documents
- `RESEARCH.md` - Full technical teardown of Circleback, Fireflies, Otter, etc.
- `CLAUDE.md` - Project context for Claude Code
