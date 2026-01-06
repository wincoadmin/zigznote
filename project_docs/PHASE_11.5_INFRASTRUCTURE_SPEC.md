# Phase 11.5: Self-Hosted Infrastructure

## Overview

Replace paid cloud services with self-hosted alternatives and AWS SES for email. This phase sets up production-ready infrastructure with minimal ongoing costs.

**Services to implement:**
- AWS SES (Email) - Use existing AWS account
- Redis (Rate limiting, caching, queues)
- MinIO (S3-compatible file storage)
- Sentry Self-Hosted (Error tracking)

**Total monthly savings:** ~$50-100/month

---

## 12.1 AWS SES Email Integration

### Setup in AWS Console (Manual Steps)

1. **Verify Domain in SES:**
   - Go to AWS SES Console → Verified Identities
   - Add domain: `zigznote.com` (or your domain)
   - Add DNS records (DKIM, SPF) to your domain

2. **Create SMTP Credentials:**
   - Go to AWS SES → SMTP Settings
   - Create SMTP credentials
   - Save the username and password

3. **Request Production Access:**
   - By default, SES is in sandbox mode
   - Request production access to send to any email

### Environment Variables

```bash
# Add to .env
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=your-access-key
AWS_SES_SECRET_ACCESS_KEY=your-secret-key
AWS_SES_FROM_EMAIL=noreply@zigznote.com
```

### Update Email Service

Replace Resend with AWS SES in `apps/web/lib/email.ts`:

```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { render } from '@react-email/render';

const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY!,
  },
});

const FROM_EMAIL = process.env.AWS_SES_FROM_EMAIL || 'noreply@zigznote.com';

interface SendEmailOptions {
  to: string;
  subject: string;
  react: React.ReactElement;
}

export async function sendEmail({ to, subject, react }: SendEmailOptions): Promise<void> {
  const html = render(react);
  
  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: { Data: subject },
      Body: {
        Html: { Data: html },
      },
    },
  });

  try {
    await sesClient.send(command);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error('Failed to send email');
  }
}

// Convenience functions
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const { WelcomeEmail } = await import('./email-templates');
  await sendEmail({
    to: email,
    subject: 'Welcome to zigznote! 🎉',
    react: WelcomeEmail({ name }),
  });
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const { VerificationEmail } = await import('./email-templates');
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify your email address',
    react: VerificationEmail({ name, verifyUrl }),
  });
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const { PasswordResetEmail } = await import('./email-templates');
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset your password',
    react: PasswordResetEmail({ name, resetUrl }),
  });
}

export async function sendPasswordChangedEmail(email: string, name: string): Promise<void> {
  const { PasswordChangedEmail } = await import('./email-templates');
  await sendEmail({
    to: email,
    subject: 'Your password has been changed',
    react: PasswordChangedEmail({ name }),
  });
}

export async function sendNewLoginEmail(
  email: string,
  name: string,
  device: string,
  location: string,
  time: Date
): Promise<void> {
  const { NewLoginEmail } = await import('./email-templates');
  await sendEmail({
    to: email,
    subject: 'New sign-in to your account',
    react: NewLoginEmail({ name, device, location, time }),
  });
}
```

### Install AWS SDK

```bash
cd apps/web
pnpm add @aws-sdk/client-ses
```

---

## 12.2 Self-Hosted Redis

### Docker Compose Configuration

Add to `docker/docker-compose.prod.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: zigznote-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis_data:
```

### Environment Variables

```bash
# Replace Upstash with local Redis
REDIS_URL=redis://localhost:6379

# Or with password (recommended for production)
REDIS_URL=redis://:your-secure-password@localhost:6379
```

### Update Rate Limiting Service

Replace Upstash with ioredis in `apps/web/lib/rate-limit.ts`:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

// Sliding window rate limiter
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const redisKey = `ratelimit:${key}`;

  // Remove old entries
  await redis.zremrangebyscore(redisKey, 0, windowStart);

  // Count current entries
  const count = await redis.zcard(redisKey);

  if (count >= limit) {
    const oldestEntry = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
    const reset = oldestEntry.length > 1 
      ? Math.ceil((parseInt(oldestEntry[1]) + windowSeconds * 1000 - now) / 1000)
      : windowSeconds;
    
    return {
      success: false,
      remaining: 0,
      reset,
    };
  }

  // Add new entry
  await redis.zadd(redisKey, now, `${now}-${Math.random()}`);
  await redis.expire(redisKey, windowSeconds);

  return {
    success: true,
    remaining: limit - count - 1,
    reset: windowSeconds,
  };
}

// Pre-configured limiters
export async function checkLoginRateLimit(ip: string, email?: string): Promise<RateLimitResult> {
  const key = email ? `login:${ip}:${email}` : `login:${ip}`;
  return checkRateLimit(key, 5, 15 * 60); // 5 attempts per 15 minutes
}

export async function checkRegisterRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(`register:${ip}`, 3, 60 * 60); // 3 registrations per hour
}

export async function checkPasswordResetRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(`password-reset:${ip}`, 3, 60 * 60); // 3 resets per hour
}

export async function checkApiRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(`api:${userId}`, 100, 60); // 100 requests per minute
}

// Record failed attempts (for security logging)
export async function recordFailedAttempt(ip: string, email: string): Promise<void> {
  const key = `failed:${ip}:${email}`;
  await redis.incr(key);
  await redis.expire(key, 24 * 60 * 60); // Track for 24 hours
}

// Check if IP is suspicious
export async function isSuspiciousIP(ip: string): Promise<boolean> {
  const pattern = `failed:${ip}:*`;
  const keys = await redis.keys(pattern);
  
  if (keys.length === 0) return false;
  
  const values = await Promise.all(keys.map(k => redis.get(k)));
  const totalFailures = values.reduce((sum, v) => sum + (parseInt(v || '0')), 0);
  
  return totalFailures > 20; // More than 20 failures across all emails
}

// Reset failed attempts (on successful login)
export async function resetFailedAttempts(ip: string, email: string): Promise<void> {
  const key = `failed:${ip}:${email}`;
  await redis.del(key);
}
```

### Install ioredis

```bash
cd apps/web
pnpm remove @upstash/ratelimit @upstash/redis
pnpm add ioredis
pnpm add -D @types/ioredis
```

---

## 12.3 MinIO (S3-Compatible Storage)

### Docker Compose Configuration

Add to `docker/docker-compose.prod.yml`:

```yaml
services:
  minio:
    image: minio/minio:latest
    container_name: zigznote-minio
    restart: unless-stopped
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console
    volumes:
      - minio_data:/data
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin123}
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  minio_data:
```

### Environment Variables

```bash
# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123

# Buckets
MINIO_BUCKET_AUDIO=zigznote-audio
MINIO_BUCKET_EXPORTS=zigznote-exports
MINIO_BUCKET_AVATARS=zigznote-avatars
MINIO_BUCKET_BACKUPS=zigznote-backups
```

### Storage Service

Create `apps/api/src/services/storageService.ts`:

```typescript
import { Client } from 'minio';
import { Readable } from 'stream';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

// Bucket names
const BUCKETS = {
  AUDIO: process.env.MINIO_BUCKET_AUDIO || 'zigznote-audio',
  EXPORTS: process.env.MINIO_BUCKET_EXPORTS || 'zigznote-exports',
  AVATARS: process.env.MINIO_BUCKET_AVATARS || 'zigznote-avatars',
  BACKUPS: process.env.MINIO_BUCKET_BACKUPS || 'zigznote-backups',
};

// Initialize buckets on startup
export async function initializeBuckets(): Promise<void> {
  for (const bucket of Object.values(BUCKETS)) {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket);
      console.log(`Created bucket: ${bucket}`);
    }
  }
}

// Upload file
export async function uploadFile(
  bucket: keyof typeof BUCKETS,
  fileName: string,
  data: Buffer | Readable,
  contentType?: string
): Promise<string> {
  const bucketName = BUCKETS[bucket];
  
  const metaData = contentType ? { 'Content-Type': contentType } : {};
  
  await minioClient.putObject(bucketName, fileName, data, undefined, metaData);
  
  return `${bucketName}/${fileName}`;
}

// Download file
export async function downloadFile(
  bucket: keyof typeof BUCKETS,
  fileName: string
): Promise<Buffer> {
  const bucketName = BUCKETS[bucket];
  
  const stream = await minioClient.getObject(bucketName, fileName);
  
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// Get file stream (for large files)
export async function getFileStream(
  bucket: keyof typeof BUCKETS,
  fileName: string
): Promise<Readable> {
  const bucketName = BUCKETS[bucket];
  return minioClient.getObject(bucketName, fileName);
}

// Delete file
export async function deleteFile(
  bucket: keyof typeof BUCKETS,
  fileName: string
): Promise<void> {
  const bucketName = BUCKETS[bucket];
  await minioClient.removeObject(bucketName, fileName);
}

// Get presigned URL for upload (client-side uploads)
export async function getUploadUrl(
  bucket: keyof typeof BUCKETS,
  fileName: string,
  expirySeconds: number = 3600
): Promise<string> {
  const bucketName = BUCKETS[bucket];
  return minioClient.presignedPutObject(bucketName, fileName, expirySeconds);
}

// Get presigned URL for download
export async function getDownloadUrl(
  bucket: keyof typeof BUCKETS,
  fileName: string,
  expirySeconds: number = 3600
): Promise<string> {
  const bucketName = BUCKETS[bucket];
  return minioClient.presignedGetObject(bucketName, fileName, expirySeconds);
}

// List files in bucket
export async function listFiles(
  bucket: keyof typeof BUCKETS,
  prefix?: string
): Promise<string[]> {
  const bucketName = BUCKETS[bucket];
  const files: string[] = [];
  
  const stream = minioClient.listObjects(bucketName, prefix, true);
  
  return new Promise((resolve, reject) => {
    stream.on('data', (obj) => {
      if (obj.name) files.push(obj.name);
    });
    stream.on('end', () => resolve(files));
    stream.on('error', reject);
  });
}

// Get file info
export async function getFileInfo(
  bucket: keyof typeof BUCKETS,
  fileName: string
): Promise<{ size: number; lastModified: Date; contentType?: string }> {
  const bucketName = BUCKETS[bucket];
  const stat = await minioClient.statObject(bucketName, fileName);
  
  return {
    size: stat.size,
    lastModified: stat.lastModified,
    contentType: stat.metaData?.['content-type'],
  };
}

// Export for direct access if needed
export { minioClient, BUCKETS };
```

### Install MinIO Client

```bash
cd apps/api
pnpm add minio
```

### Update Audio Upload Route

Update `apps/api/src/routes/audio.ts` to use MinIO:

```typescript
import { uploadFile, getDownloadUrl } from '../services/storageService';

// In upload handler
const fileName = `${userId}/${Date.now()}-${originalName}`;
const filePath = await uploadFile('AUDIO', fileName, fileBuffer, mimeType);

// To get download URL
const downloadUrl = await getDownloadUrl('AUDIO', fileName, 3600);
```

---

## 12.4 Sentry Self-Hosted

### Option A: Docker Compose (Simpler)

Sentry self-hosted requires significant resources. For simpler setup, use GlitchTip instead:

Add to `docker/docker-compose.prod.yml`:

```yaml
services:
  glitchtip:
    image: glitchtip/glitchtip:latest
    container_name: zigznote-glitchtip
    restart: unless-stopped
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgres://zigznote:${DB_PASSWORD}@postgres:5432/glitchtip
      REDIS_URL: redis://redis:6379/1
      SECRET_KEY: ${GLITCHTIP_SECRET_KEY}
      PORT: 8000
      EMAIL_URL: smtp://${AWS_SES_ACCESS_KEY_ID}:${AWS_SES_SECRET_ACCESS_KEY}@email-smtp.${AWS_SES_REGION}.amazonaws.com:587
      DEFAULT_FROM_EMAIL: errors@zigznote.com
      GLITCHTIP_DOMAIN: https://errors.zigznote.com

  glitchtip-worker:
    image: glitchtip/glitchtip:latest
    container_name: zigznote-glitchtip-worker
    restart: unless-stopped
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgres://zigznote:${DB_PASSWORD}@postgres:5432/glitchtip
      REDIS_URL: redis://redis:6379/1
      SECRET_KEY: ${GLITCHTIP_SECRET_KEY}
    command: ./bin/run-celery-with-beat.sh
```

### Option B: Use Sentry Cloud Free Tier

If self-hosting is complex, Sentry has a free tier:
- 5K errors/month free
- Good for small apps

### Environment Variables

```bash
# GlitchTip / Sentry
GLITCHTIP_SECRET_KEY=your-random-secret-key
SENTRY_DSN=http://key@localhost:8000/1

# For apps
NEXT_PUBLIC_SENTRY_DSN=http://key@localhost:8000/1
```

### Update Sentry Configuration

`apps/web/lib/sentry.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  debug: process.env.NODE_ENV === 'development',
});

export { Sentry };
```

---

## 12.5 Complete Docker Compose

Full `docker/docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: zigznote-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: zigznote
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: zigznote
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zigznote"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis (Rate limiting, caching, queues)
  redis:
    image: redis:7-alpine
    container_name: zigznote-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio:latest
    container_name: zigznote-minio
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # API Server
  api:
    build:
      context: ..
      dockerfile: apps/api/Dockerfile
    container_name: zigznote-api
    restart: unless-stopped
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://zigznote:${DB_PASSWORD}@postgres:5432/zigznote
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
    env_file:
      - .env.prod

  # Web App
  web:
    build:
      context: ..
      dockerfile: apps/web/Dockerfile
    container_name: zigznote-web
    restart: unless-stopped
    ports:
      - "3000:3000"
    depends_on:
      - api
    environment:
      NODE_ENV: production
    env_file:
      - .env.prod

  # Admin Panel
  admin:
    build:
      context: ..
      dockerfile: apps/admin/Dockerfile
    container_name: zigznote-admin
    restart: unless-stopped
    ports:
      - "3002:3002"
    depends_on:
      - api
    environment:
      NODE_ENV: production
    env_file:
      - .env.prod

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

---

## 12.6 Environment File Template

Create `docker/.env.prod.example`:

```bash
# Database
DB_PASSWORD=your-secure-database-password

# Redis
REDIS_URL=redis://redis:6379

# MinIO
MINIO_ACCESS_KEY=your-minio-access-key
MINIO_SECRET_KEY=your-minio-secret-key-min-8-chars
MINIO_BUCKET_AUDIO=zigznote-audio
MINIO_BUCKET_EXPORTS=zigznote-exports
MINIO_BUCKET_AVATARS=zigznote-avatars
MINIO_BUCKET_BACKUPS=zigznote-backups

# AWS SES (using your existing AWS account)
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=your-aws-access-key
AWS_SES_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_SES_FROM_EMAIL=noreply@zigznote.com

# Sentry / GlitchTip
SENTRY_DSN=http://key@glitchtip:8000/1
NEXT_PUBLIC_SENTRY_DSN=http://key@glitchtip:8000/1
GLITCHTIP_SECRET_KEY=your-random-secret-key

# NextAuth (from Phase 11)
NEXTAUTH_URL=https://zigznote.com
NEXTAUTH_SECRET=your-nextauth-secret

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# External Services (still using paid)
DEEPGRAM_API_KEY=your-deepgram-key
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
RECALL_API_KEY=your-recall-key
STRIPE_SECRET_KEY=sk_live_your-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
```

---

## Testing Checklist

- [ ] AWS SES sends emails (verification, password reset)
- [ ] Redis rate limiting works
- [ ] MinIO file upload works
- [ ] MinIO file download works
- [ ] Presigned URLs work
- [ ] All buckets created
- [ ] Error tracking captures errors
- [ ] Docker compose starts all services
- [ ] Health checks pass

---

## Definition of Done

1. AWS SES integrated and sending emails
2. Redis self-hosted and handling rate limiting
3. MinIO self-hosted and storing files
4. All existing functionality works with new services
5. Docker compose runs full stack
6. Environment variables documented

---

## Estimated Time

| Task | Hours |
|------|-------|
| AWS SES setup & integration | 2 |
| Redis setup & rate limiting | 2 |
| MinIO setup & storage service | 3 |
| Update existing code to use new services | 2 |
| Docker compose updates | 1 |
| Testing | 2 |
| **Total** | **~12 hours** |
