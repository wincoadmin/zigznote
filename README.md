# zigznote - Claude Code Starter Kit

This starter kit contains everything you need to build **zigznote** — your AI meeting assistant — with Claude Code.

## 📁 Files Included

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project context for Claude Code (reads automatically via `/init`) |
| `PROJECT_BRIEF.md` | Requirements, feature checklist, and technical specs |
| `RESEARCH.md` | Technical teardown of Circleback, Fireflies, and competitors |
| `BRANDING.md` | **Complete brand identity** — colors, typography, UI patterns, logo specs |
| `STARTER_PROMPTS.md` | Autonomous phase prompts (one prompt per phase, runs start-to-finish) |

## 🚀 Quick Start

### Step 1: Create Your Project Folder

```powershell
# Windows PowerShell
mkdir zigznote
cd zigznote
```

### Step 2: Copy All Files

Copy all 5 `.md` files into your `zigznote` folder:

```
zigznote/
├── CLAUDE.md
├── PROJECT_BRIEF.md
├── RESEARCH.md
├── BRANDING.md
└── STARTER_PROMPTS.md
```

### Step 3: Start Claude Code

```powershell
claude
```

### Step 4: Initialize the Project

```
/init
```

This loads `CLAUDE.md` so Claude Code understands the project context.

### Step 5: Start Building

Open `STARTER_PROMPTS.md` and paste **Phase 0** into Claude Code.

Each phase runs autonomously from start to finish — just wait for it to complete, then paste the next phase.

## 📋 Build Phases Overview

| Phase | What Gets Built |
|-------|-----------------|
| **Phase 0** | Project setup, monorepo, Docker, CI/CD |
| **Phase 1** | Database, API server, authentication |
| **Phase 2** | Google Calendar integration |
| **Phase 3** | Meeting bots (Recall.ai), transcription (Deepgram) |
| **Phase 4** | AI summarization (Claude/GPT) |
| **Phase 5** | Frontend dashboard with zigznote branding |
| **Phase 6** | Integrations (Slack, HubSpot, Webhooks) |
| **Phase 7** | Search and final polish |

## 🎨 Brand Identity

zigznote has a complete brand identity defined in `BRANDING.md`:

| Attribute | Value |
|-----------|-------|
| **Primary Color** | #10B981 (Emerald Green) |
| **Font** | Plus Jakarta Sans + Inter |
| **Style** | Modern, card-based, soft shadows |
| **Dark Mode** | Yes, with system preference |
| **Animations** | Smooth, purposeful micro-interactions |

## 🛠️ Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + Next.js 14 + TailwindCSS
- **Database**: PostgreSQL + pgvector + Prisma
- **Queue**: BullMQ + Redis
- **Mobile**: React Native + Expo

## 📚 Key Third-Party Services

| Service | Purpose | Docs |
|---------|---------|------|
| Recall.ai | Meeting bots | https://docs.recall.ai |
| Deepgram | Transcription | https://developers.deepgram.com |
| Anthropic Claude | Summarization | https://docs.anthropic.com |
| Clerk | Authentication | https://clerk.com/docs |

## 💡 Tips for Success

1. **One phase at a time** — Each phase is self-contained and runs autonomously
2. **Don't interrupt** — Let each phase complete fully before starting the next
3. **Check PHASE_X_COMPLETE.md** — Created after each phase as a handoff document
4. **Use `/compact`** — Run at end of each phase to manage context
5. **Test coverage** — Every phase includes tests (80%+ coverage required)

## ❓ Need Help?

If Claude Code encounters an error:
1. It should fix it automatically and continue
2. If stuck, share the error and relevant files
3. Check RESEARCH.md for detailed implementation guidance

Good luck building zigznote! 🚀
