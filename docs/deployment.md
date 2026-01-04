# zigznote Deployment Guide

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker and Docker Compose

### Setup

1. Clone the repository:
```bash
git clone https://github.com/your-org/zigznote.git
cd zigznote
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy environment file:
```bash
cp .env.example .env
```

4. Start Docker services:
```bash
pnpm docker:up
```

5. Run database migrations:
```bash
pnpm db:migrate
```

6. Seed the database (optional):
```bash
pnpm db:seed
```

7. Start development servers:
```bash
pnpm dev
```

### Access Points

- Web App: http://localhost:3000
- API: http://localhost:3001
- Prisma Studio: `pnpm db:studio`

---

## Production Deployment

### Environment Variables

Ensure all required environment variables are set:

```env
# Required
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...

# Third-party APIs
RECALL_API_KEY=...
DEEPGRAM_API_KEY=...
ANTHROPIC_API_KEY=...

# Optional
LOG_LEVEL=info
```

### Database

1. Create PostgreSQL database with pgvector extension
2. Run migrations:
```bash
pnpm db:migrate:prod
```

### Build

```bash
pnpm build
```

This builds all packages in dependency order via Turborepo.

### API Server

The API can be deployed as a Docker container or directly:

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
```

### Web App

The Next.js app can be deployed to Vercel or as a Docker container:

```bash
# Vercel deployment
vercel deploy --prod

# Or Docker
docker build -f apps/web/Dockerfile -t zigznote-web .
```

### Worker Services

Deploy workers separately with auto-scaling:

```bash
# Transcription worker
node services/transcription/dist/index.js

# Summarization worker
node services/summarization/dist/index.js
```

---

## Infrastructure Recommendations

### Production Stack

| Component | Recommendation |
|-----------|----------------|
| API | AWS ECS / Google Cloud Run |
| Web | Vercel / AWS Amplify |
| Database | AWS RDS / Supabase |
| Redis | AWS ElastiCache / Upstash |
| Workers | AWS ECS / Google Cloud Run |
| Storage | AWS S3 / Cloudflare R2 |
| CDN | CloudFront / Cloudflare |

### Monitoring

- **APM**: Datadog / New Relic
- **Logging**: CloudWatch / Datadog Logs
- **Error Tracking**: Sentry
- **Uptime**: Better Uptime / Pingdom

### CI/CD

The included GitHub Actions workflow handles:
- Linting and type checking
- Running tests with coverage
- Building all packages
- Deploying to staging/production

---

## Scaling Considerations

### Horizontal Scaling

- API servers are stateless - scale horizontally
- Use Redis for session storage and rate limiting
- Workers process jobs from shared queue

### Database Scaling

- Enable connection pooling (PgBouncer)
- Use read replicas for queries
- Partition large tables (meetings, transcripts)

### Caching Strategy

- Cache meeting lists (5-minute TTL)
- Cache summaries (indefinite, invalidate on update)
- Use CDN for static assets

---

## Security Checklist

- [ ] Enable HTTPS/TLS everywhere
- [ ] Configure CORS for specific origins
- [ ] Set secure cookie flags
- [ ] Enable rate limiting
- [ ] Use secrets manager for credentials
- [ ] Enable database encryption at rest
- [ ] Configure WAF rules
- [ ] Set up DDoS protection
- [ ] Enable audit logging
- [ ] Regular security scans
