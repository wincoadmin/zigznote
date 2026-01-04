# zigznote - Project Context for Claude Code

## 🎯 Project Overview

Building **zigznote** — a production-ready AI meeting assistant application that rivals Circleback.ai, with capabilities matching or exceeding competitors like Fireflies, Otter, Fathom, and tl;dv.

**App Name**: zigznote
**Tagline**: "Your meetings, simplified"

**Target Users**: Startups and SMBs — sales teams, product teams, recruiters, consultants, and anyone with too many meetings.

**Core Value Proposition**: Automatically join meetings, transcribe conversations, generate intelligent summaries, extract action items, and integrate with CRMs and productivity tools.

---

## 🧠 Model Selection Guide

Use different reasoning depths for different tasks:

| Task Type | How to Invoke | When to Use |
|-----------|---------------|-------------|
| **Architecture decisions** | Prefix with `ultrathink:` | System design, database schema, API design, complex debugging |
| **Standard implementation** | Default (no prefix) | Writing code, tests, configs, simple fixes |

Example:
```
ultrathink: Design the database schema for storing meeting transcripts with support for full-text search and speaker diarization.
```

---

## 📁 Project Structure (Monorepo)

```
meeting-assistant/
├── apps/
│   ├── api/                 # Express.js backend (Clean Architecture)
│   │   ├── src/
│   │   │   ├── routes/      # Route definitions
│   │   │   ├── controllers/ # Request handlers (thin, delegate to services)
│   │   │   ├── services/    # Business logic (testable, no framework deps)
│   │   │   ├── repositories/# Data access (abstracts database)
│   │   │   ├── middleware/  # Express middleware
│   │   │   ├── jobs/        # Background job definitions
│   │   │   ├── integrations/# Third-party integrations
│   │   │   ├── utils/       # Helpers
│   │   │   ├── types/       # TypeScript types
│   │   │   └── config/      # Configuration
│   │   └── tests/
│   └── web/                 # Next.js 14 frontend (App Router)
│       ├── app/             # Pages and layouts
│       ├── components/      # React components
│       ├── lib/             # API client, hooks, utilities
│       └── tests/
├── packages/
│   ├── database/            # Prisma schema + repositories
│   ├── shared/              # Shared types, utils, constants
│   └── config/              # Shared ESLint, TypeScript, Jest configs
├── services/
│   ├── transcription/       # Deepgram worker service
│   └── summarization/       # LLM summarization worker
├── docker/
├── docs/
└── .github/workflows/
```

---

## 🛠️ Tech Stack (CONFIRMED - Do Not Change)

| Layer | Technology | Notes |
|-------|------------|-------|
| **Backend** | Node.js + Express + TypeScript | Clean Architecture pattern |
| **Frontend** | React + Next.js 14 + TailwindCSS | App Router, Server Components |
| **Database** | PostgreSQL + Prisma ORM | With pgvector for semantic search |
| **Cache/Queue** | Redis + BullMQ | Job queues for async processing |
| **Mobile** | React Native + Expo | Phase 3 |
| **Testing** | Jest + Supertest + RTL + MSW | 80%+ coverage required |

---

## 🔌 Third-Party Services

| Service | Purpose | Docs |
|---------|---------|------|
| **Recall.ai** | Meeting bots (Zoom, Meet, Teams) | https://docs.recall.ai |
| **Deepgram** | Speech-to-text (Nova-3) | https://developers.deepgram.com |
| **Anthropic Claude** | Summarization (3.5 Sonnet) | https://docs.anthropic.com |
| **OpenAI** | Summarization fallback (GPT-4o-mini) | https://platform.openai.com |
| **Clerk** | Authentication | https://clerk.com/docs |
| **Google Calendar API** | Calendar sync | https://developers.google.com/calendar |

---

## 📐 Engineering Principles (ALWAYS FOLLOW)

### Architecture
- **SOLID Principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **Clean Architecture**: routes → controllers → services → repositories
- **Dependency Injection**: Constructor injection for testability
- **Repository Pattern**: Abstract data access behind interfaces

### Code Style
- **Naming**: Descriptive names, no abbreviations (except id, url, etc.)
- **Functions**: < 50 lines, single responsibility
- **Files**: < 400 lines, one main export per file
- **Imports**: Use barrel exports (index.ts) for clean imports

### Documentation
- **JSDoc**: On all public functions with @param, @returns, @throws
- **README**: In each major folder explaining purpose
- **Comments**: Explain WHY, not WHAT (code should be self-documenting)

### Error Handling
- **Custom Errors**: Extend base AppError class with status codes
- **Centralized Handler**: Global error middleware formats all errors
- **Async Safety**: All async functions in try/catch or error boundary
- **User Messages**: Friendly for users, detailed in logs

### Testing
- **Location**: Test files next to source (*.test.ts)
- **Naming**: "should [behavior] when [condition]"
- **Pattern**: AAA (Arrange, Act, Assert)
- **Mocking**: Mock external deps, never real APIs in tests
- **Coverage**: Minimum 80%, 90%+ for auth/security code

---

## 🔄 Context Management

### Phase Handoff Files
After each phase, create `PHASE_X_COMPLETE.md` containing:
- Summary of what was built
- Key design decisions
- Test coverage report
- Commands to verify
- Notes for next phase

### Resuming After Break
```bash
# Read the latest phase completion file
cat PHASE_X_COMPLETE.md

# Then tell Claude Code:
"Read PHASE_X_COMPLETE.md and continue from where we left off"
```

### Context Compaction
At the end of each phase, run:
```
/compact

Summary: [Brief description of what was completed]
```

---

## 🔑 Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/meeting_assistant
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/meeting_assistant_test

# Redis
REDIS_URL=redis://localhost:6379

# Authentication (Clerk)
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

# Meeting Bots (Recall.ai)
RECALL_API_KEY=
RECALL_WEBHOOK_SECRET=

# Transcription (Deepgram)
DEEPGRAM_API_KEY=

# AI/LLM
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# App
API_URL=http://localhost:3001
WEB_URL=http://localhost:3000
```

---

## 📋 Development Commands

```bash
# Install dependencies
pnpm install

# Start Docker services (PostgreSQL, Redis)
docker-compose up -d

# Run database migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Start all services in development
pnpm dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Type check
pnpm typecheck

# Build all packages
pnpm build
```

---

## ✅ Feature Checklist

### Phase 0: Project Setup
- [ ] Monorepo with pnpm + Turborepo
- [ ] Docker (PostgreSQL + Redis)
- [ ] Jest testing infrastructure
- [ ] GitHub Actions CI

### Phase 1: Database & Backend
- [ ] Prisma schema (all tables)
- [ ] Repository pattern
- [ ] Express API with middleware
- [ ] BullMQ job queues

### Phase 2: Auth & Calendar
- [ ] Clerk authentication
- [ ] Google Calendar OAuth
- [ ] Calendar sync job

### Phase 3: Bots & Transcription
- [ ] Recall.ai integration
- [ ] Deepgram transcription
- [ ] WebSocket updates

### Phase 4: Summarization
- [ ] Claude/GPT summarization
- [ ] Action item extraction
- [ ] Custom insights

### Phase 5: Frontend
- [ ] Next.js dashboard
- [ ] Meeting list & detail
- [ ] Player + transcript sync

### Phase 6: Integrations
- [ ] Slack
- [ ] HubSpot
- [ ] Webhooks

### Phase 7: Search & Polish
- [ ] Full-text search
- [ ] Semantic search
- [ ] Production docs

---

## 📚 Reference Documents

| Document | Purpose |
|----------|---------|
| `RESEARCH.md` | Full technical teardown of Circleback and competitors |
| `PROJECT_BRIEF.md` | Condensed requirements and milestones |
| `STARTER_PROMPTS.md` | Phase-by-phase prompts for Claude Code |
| `PHASE_X_COMPLETE.md` | Phase completion summaries (created as you build) |

---

## ⚠️ Important Notes

1. **Never skip tests** - Every function needs tests before moving on
2. **Mock external APIs** - Tests should never make real API calls
3. **Follow the phases** - Each phase builds on the previous
4. **Create handoff files** - PHASE_X_COMPLETE.md ensures continuity
5. **Use ultrathink** - For architecture decisions and complex debugging
6. **80%+ coverage** - Non-negotiable minimum for all code
