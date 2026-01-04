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
zigznote/
├── apps/
│   ├── api/                 # Express.js backend (serves both user & admin)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── api/     # User-facing API routes
│   │   │   │   └── admin/   # Admin-only API routes
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts          # User auth (Clerk)
│   │   │   │   └── adminAuth.ts     # Admin auth (separate)
│   │   │   ├── jobs/
│   │   │   ├── integrations/
│   │   │   └── config/
│   │   └── tests/
│   ├── web/                 # User app (app.zigznote.com)
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── tests/
│   └── admin/               # Admin panel (admin.zigznote.com) ← SEPARATE APP
│       ├── app/
│       │   ├── (auth)/          # Admin login (email + password + 2FA)
│       │   └── (dashboard)/     # Admin dashboard pages
│       │       ├── page.tsx             # Overview dashboard
│       │       ├── api-keys/            # API key management
│       │       ├── users/               # User management
│       │       ├── organizations/       # Org management + billing override
│       │       ├── billing/             # Subscription & revenue
│       │       ├── analytics/           # Usage analytics
│       │       ├── system/              # Config, feature flags
│       │       ├── security/            # Audit logs, access control
│       │       ├── support/             # Support tools
│       │       ├── operations/          # System health, jobs
│       │       └── settings/            # Admin settings
│       ├── components/
│       ├── lib/
│       └── tests/
├── packages/
│   ├── database/            # Prisma schema + repositories (shared)
│   ├── shared/              # Shared types, utils, constants
│   └── config/              # Shared ESLint, TypeScript, Jest configs
├── services/
│   ├── transcription/       # Deepgram worker service
│   └── summarization/       # LLM summarization worker
├── docker/
├── docs/
└── .github/workflows/
```

### Deployment URLs
```
app.zigznote.com        →  apps/web     (User Dashboard)
admin.zigznote.com      →  apps/admin   (Admin Panel - IP restricted)
api.zigznote.com        →  apps/api     (Shared API)
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
- **Files**: Single responsibility (large files OK if one domain)
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
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/zigznote
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/zigznote_test

# Redis
REDIS_URL=redis://localhost:6379

# Authentication (Clerk - User App)
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

# Admin Panel Authentication
ADMIN_JWT_SECRET=               # Secret for admin JWT tokens
ADMIN_2FA_ISSUER=zigznote       # 2FA app display name
ADMIN_ALLOWED_IPS=              # Comma-separated IP allowlist (optional)

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

# Payment Providers (at least one required)
DEFAULT_PAYMENT_PROVIDER=stripe  # 'stripe' or 'flutterwave'

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Flutterwave
FLUTTERWAVE_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_WEBHOOK_SECRET=

# App URLs
API_URL=http://localhost:3001
WEB_URL=http://localhost:3000
ADMIN_URL=http://localhost:3002

# Encryption (for storing API keys in database)
ENCRYPTION_KEY=                 # 32-byte key for AES-256 encryption
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
- [ ] zigznote branding & logo

### Phase 6: Integrations & Billing
- [ ] Slack integration
- [ ] HubSpot integration
- [ ] Webhooks system
- [ ] Payment provider abstraction layer
- [ ] Stripe provider implementation
- [ ] Flutterwave provider implementation
- [ ] Subscription management
- [ ] Billing UI

### Phase 7: Admin Panel (Separate App)
- [ ] Admin authentication (email + 2FA)
- [ ] API key management vault
- [ ] User & organization management
- [ ] Billing overrides (complimentary accounts)
- [ ] System configuration & feature flags
- [ ] Analytics & reporting dashboards
- [ ] Security & audit logs
- [ ] Support tools (impersonation, debug)
- [ ] Operations monitoring (jobs, health)

### Phase 8: Search & Polish
- [ ] Full-text search
- [ ] Semantic search with pgvector
- [ ] Search UI
- [ ] AI meeting assistant (Q&A)
- [ ] In-app help assistant (hardened)
- [ ] Onboarding flow
- [ ] Proactive help system
- [ ] Production documentation

### Phase 8.5: Hardening & Stress Testing
- [ ] Edge case tests for all phases
- [ ] Security penetration testing (OWASP Top 10)
- [ ] Load testing (100+ concurrent users)
- [ ] Chaos engineering (fault injection)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Performance benchmarks
- [ ] E2E critical path tests
- [ ] 95%+ coverage on critical code

### 🔧 Retrofit (if needed)
If Phase 0/1 were completed before production simulation was added, run the **"RETROFIT: Production Quality Upgrade"** prompt in STARTER_PROMPTS.md to upgrade existing infrastructure without breaking anything.

---

## 📚 Reference Documents

| Document | Purpose |
|----------|---------|
| `RESEARCH.md` | Full technical teardown of Circleback and competitors |
| `PROJECT_BRIEF.md` | Condensed requirements and milestones |
| `STARTER_PROMPTS.md` | Phase-by-phase prompts for Claude Code |
| `BRANDING.md` | Complete brand identity, colors, typography, UI patterns |
| `GOVERNANCE.md` | **Development governance rules and quality standards** |
| `ERROR_HANDLING.md` | **Error handling patterns and Sentry monitoring setup** |
| `PATTERNS.md` | **Code templates, naming conventions, and checklists** |
| `PHASES.md` | **Phase overview, status tracking, and change log (UPDATE AFTER EACH PHASE)** |
| `PHASE_X_COMPLETE.md` | Phase completion summaries (created as you build) |

---

## ⚖️ Development Governance (MANDATORY)

Claude Code must follow the rules in `GOVERNANCE.md`. Key principles:

### Read-First Rule
Before making ANY changes:
1. Read existing files in the area you're modifying
2. Check for existing patterns and conventions
3. Identify potential duplicates
4. Plan minimal changes

### Duplication Prevention
Before writing code, verify:
- [ ] No duplicate components/functions exist
- [ ] No conflicting implementations
- [ ] Existing code can't be reused or extended

### Complexity Limits
| Metric | Limit |
|--------|-------|
| File length | 400 lines max |
| Function length | 50 lines max |
| Parameters | 4 max (use options object) |
| Nesting depth | 3 levels max |

### Pre-Commit Checklist
Before every commit:
- [ ] All tests pass
- [ ] Linting passes
- [ ] Type checking passes
- [ ] No console.logs or commented code
- [ ] Changes match commit scope

### Error Handling (Non-Negotiable)
- All errors must use custom error classes (see `ERROR_HANDLING.md`)
- All errors must include trace ID
- All errors must be logged with context
- All unexpected errors must be sent to Sentry
- Never swallow errors silently

---

## ⚠️ Important Notes

1. **Read GOVERNANCE.md first** - Follow development discipline rules
2. **Never skip tests** - Every function needs tests before moving on
3. **Mock external APIs** - Tests should never make real API calls
4. **Follow the phases** - Each phase builds on the previous
5. **Create handoff files** - PHASE_X_COMPLETE.md ensures continuity
6. **Use ultrathink** - For architecture decisions and complex debugging
7. **80%+ coverage** - Non-negotiable minimum for all code
8. **Check for duplicates** - Before writing new code, verify it doesn't exist
