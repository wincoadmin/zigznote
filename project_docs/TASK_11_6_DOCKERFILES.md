# Task 11.6: Production Dockerfiles

## Overview
Create production-ready Dockerfiles for deploying the API and Web apps to cloud platforms.

---

## Step 1: API Dockerfile

**File:** `apps/api/Dockerfile`

```dockerfile
# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./

# Copy package.json files for dependency resolution
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api ./apps/api
COPY packages ./packages
COPY tsconfig.base.json ./

# Generate Prisma client
RUN pnpm --filter @zigznote/database prisma generate

# Build the API
RUN pnpm --filter @zigznote/api build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS runner

# Install required system tools
RUN apk add --no-cache postgresql-client wget

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api

# Copy built files
COPY --from=builder --chown=api:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=api:nodejs /app/apps/api/package.json ./
COPY --from=builder --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api:nodejs /app/packages/database/prisma ./prisma

# Switch to non-root user
USER api

# Environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]
```

---

## Step 2: Web Dockerfile

**File:** `apps/web/Dockerfile`

```dockerfile
# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Build
# ============================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source code
COPY apps/web ./apps/web
COPY packages ./packages
COPY tsconfig.base.json ./
COPY pnpm-workspace.yaml ./

# Build arguments for public env vars
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Build Next.js
WORKDIR /app/apps/web
RUN pnpm build

# ============================================
# Stage 3: Production
# ============================================
FROM node:20-alpine AS runner

RUN apk add --no-cache wget

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start Next.js
CMD ["node", "apps/web/server.js"]
```

---

## Step 3: Update Next.js Config

**File:** `apps/web/next.config.js`

Add or update the `output` setting:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Docker deployment
  
  // Keep existing config below...
  reactStrictMode: true,
  transpilePackages: ['@zigznote/shared', '@zigznote/config'],
  
  // ... rest of existing config
};

module.exports = nextConfig;
```

If the file uses ES modules (`next.config.mjs`), update accordingly:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // ... existing config
};

export default nextConfig;
```

---

## Step 4: Production Docker Compose

**File:** `docker/docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  api:
    build:
      context: ..
      dockerfile: apps/api/Dockerfile
    container_name: zigznote-api
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - RECALL_API_KEY=${RECALL_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
      - S3_BUCKET=${S3_BUCKET}
      - S3_REGION=${S3_REGION}
      - S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
      - S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1'
        reservations:
          memory: 512M
    networks:
      - zigznote

  web:
    build:
      context: ..
      dockerfile: apps/web/Dockerfile
      args:
        - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
        - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
    container_name: zigznote-web
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    ports:
      - "3000:3000"
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
    networks:
      - zigznote

  postgres:
    image: pgvector/pgvector:pg15
    container_name: zigznote-postgres-prod
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 1G
    networks:
      - zigznote

  redis:
    image: redis:7-alpine
    container_name: zigznote-redis-prod
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
      --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_prod_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 256M
    networks:
      - zigznote

volumes:
  postgres_prod_data:
  redis_prod_data:

networks:
  zigznote:
    name: zigznote-prod
```

---

## Step 5: Build Script

**File:** `scripts/build-prod.sh`

```bash
#!/bin/bash
set -e

echo "🔨 Building production Docker images..."

# Check required env vars
if [ -z "$NEXT_PUBLIC_API_URL" ]; then
  echo "⚠️  NEXT_PUBLIC_API_URL not set, using default"
  export NEXT_PUBLIC_API_URL="http://localhost:3001"
fi

if [ -z "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then
  echo "⚠️  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not set"
fi

if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
  echo "⚠️  NEXT_PUBLIC_APP_URL not set, using default"
  export NEXT_PUBLIC_APP_URL="http://localhost:3000"
fi

# Build API image
echo ""
echo "📦 Building API image..."
docker build \
  -f apps/api/Dockerfile \
  -t zigznote-api:latest \
  -t zigznote-api:$(git rev-parse --short HEAD 2>/dev/null || echo "dev") \
  .

# Build Web image
echo ""
echo "📦 Building Web image..."
docker build \
  -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
  --build-arg NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
  -t zigznote-web:latest \
  -t zigznote-web:$(git rev-parse --short HEAD 2>/dev/null || echo "dev") \
  .

echo ""
echo "✅ Build complete!"
echo ""
echo "Images created:"
docker images | grep zigznote | head -4
echo ""
echo "To run locally:"
echo "  docker-compose -f docker/docker-compose.prod.yml up -d"
echo ""
echo "To push to registry:"
echo "  docker tag zigznote-api:latest your-registry/zigznote-api:latest"
echo "  docker push your-registry/zigznote-api:latest"
```

Make executable:
```bash
chmod +x scripts/build-prod.sh
```

---

## Step 6: Production Environment Template

**File:** `docker/.env.prod.example`

```bash
# Database
POSTGRES_USER=zigznote
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=zigznote
DATABASE_URL=postgresql://zigznote:your-secure-password@postgres:5432/zigznote

# Redis
REDIS_PASSWORD=your-redis-password
REDIS_URL=redis://:your-redis-password@redis:6379

# Clerk Authentication
CLERK_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx

# API Keys
RECALL_API_KEY=xxx
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
DEEPGRAM_API_KEY=xxx

# Stripe Billing
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Storage (S3 or MinIO)
S3_BUCKET=zigznote-prod
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
S3_ENDPOINT=  # Leave empty for AWS S3

# Public URLs
NEXT_PUBLIC_API_URL=https://api.zigznote.com
NEXT_PUBLIC_APP_URL=https://app.zigznote.com

# Alerting (optional)
ALERT_EMAILS=admin@zigznote.com
SLACK_WEBHOOK_URL=
```

---

## Step 7: .dockerignore

**File:** `.dockerignore` (in project root)

```
# Dependencies
node_modules
.pnpm-store

# Build outputs
dist
.next
out
build

# Development
.env
.env.local
.env.*.local

# Git
.git
.gitignore

# IDE
.idea
.vscode
*.swp
*.swo

# Testing
coverage
.nyc_output
*.test.ts
*.spec.ts
__tests__

# Docs
*.md
docs
README*

# Docker
Dockerfile*
docker-compose*
.docker

# Misc
.DS_Store
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

---

## Verification Checklist

**Files Created:**
- [ ] `apps/api/Dockerfile`
- [ ] `apps/web/Dockerfile`
- [ ] `docker/docker-compose.prod.yml`
- [ ] `docker/.env.prod.example`
- [ ] `scripts/build-prod.sh`
- [ ] `.dockerignore`

**Config Updated:**
- [ ] `apps/web/next.config.js` has `output: 'standalone'`

**Build Test:**
```bash
# Test API build
docker build -f apps/api/Dockerfile -t zigznote-api:test .

# Test Web build (with dummy env vars)
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  -t zigznote-web:test .
```

- [ ] API image builds successfully
- [ ] Web image builds successfully
- [ ] Images are reasonably sized (<500MB each)

**Run Test (optional):**
```bash
# Copy env template
cp docker/.env.prod.example docker/.env.prod

# Edit with real values
nano docker/.env.prod

# Start services
docker-compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d

# Check health
docker-compose -f docker/docker-compose.prod.yml ps

# View logs
docker-compose -f docker/docker-compose.prod.yml logs -f
```

- [ ] All containers start
- [ ] Health checks pass
- [ ] API responds at http://localhost:3001/health
- [ ] Web responds at http://localhost:3000
