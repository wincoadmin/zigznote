# zigznote Architecture

## Overview

zigznote is a production-ready AI meeting assistant built with a modern monorepo
architecture. The system automatically joins meetings, transcribes conversations,
generates intelligent summaries, and extracts action items.

## System Architecture

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

## Monorepo Structure

```
zigznote/
├── apps/
│   ├── api/              # Express.js backend
│   └── web/              # Next.js frontend
├── packages/
│   ├── database/         # Prisma schema + client
│   ├── shared/           # Shared types, utils, constants
│   └── config/           # Shared ESLint, TypeScript, Jest configs
├── services/
│   ├── transcription/    # Deepgram transcription worker
│   └── summarization/    # Claude/GPT summarization worker
└── docker/               # Docker Compose for local development
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express + TypeScript |
| Frontend | React + Next.js 14 + TailwindCSS |
| Database | PostgreSQL + Prisma + pgvector |
| Cache/Queue | Redis + BullMQ |
| Testing | Jest + Supertest + React Testing Library |

## Design Principles

### Clean Architecture

The API follows Clean Architecture with clear separation:

- **Routes**: Define endpoints and wire up middleware
- **Controllers**: Handle HTTP request/response, validation
- **Services**: Business logic, orchestration
- **Repositories**: Data access abstraction

### SOLID Principles

- **Single Responsibility**: Each module has one reason to change
- **Open/Closed**: Extend via composition, not modification
- **Liskov Substitution**: Interfaces define contracts
- **Interface Segregation**: Small, focused interfaces
- **Dependency Inversion**: Depend on abstractions

## Data Flow

### Meeting Processing Pipeline

1. **Calendar Sync**: Background job fetches upcoming meetings
2. **Bot Join**: Recall.ai bot joins at scheduled time
3. **Recording**: Audio/video captured and uploaded
4. **Transcription**: Deepgram worker processes audio
5. **Summarization**: Claude worker generates summary
6. **Notification**: Webhooks/integrations triggered

### Real-time Updates

WebSocket connections provide live updates for:
- Transcription progress
- Summary generation status
- Action item extraction

## Security

- JWT authentication via Clerk
- RBAC with organization-scoped access
- Encrypted credentials storage
- Rate limiting on all endpoints
- CORS configuration
- Helmet security headers

## Scalability

- Horizontal scaling via stateless API
- Redis-backed job queues
- PostgreSQL read replicas (planned)
- CDN for static assets
- Serverless worker functions (planned)
