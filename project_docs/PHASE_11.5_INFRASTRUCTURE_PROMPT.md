# Phase 11.5: Self-Hosted Infrastructure Implementation

## Mission
Replace paid cloud services with self-hosted alternatives. Integrate AWS SES for email, self-hosted Redis for rate limiting/caching, and MinIO for S3-compatible storage. **DO NOT STOP until all services are working.**

---

## Rules
1. **Do NOT ask for permission** - just build and continue
2. **Do NOT stop** until all services work
3. **Test each service** before moving to the next
4. **Keep existing functionality** working throughout

---

## What to Implement

| Service | Replace | With |
|---------|---------|------|
| Email | Resend | AWS SES |
| Rate Limiting | Upstash | Self-hosted Redis |
| File Storage | S3 (if used) | MinIO |
| Error Tracking | Sentry Cloud | GlitchTip (optional) |

---

## Step 1: Install Dependencies

```bash
# Web app - email and rate limiting
cd apps/web
pnpm remove resend @upstash/ratelimit @upstash/redis
pnpm add @aws-sdk/client-ses ioredis
pnpm add -D @types/ioredis

# API - storage
cd ../api
pnpm add minio ioredis
pnpm add -D @types/ioredis
```

---

## Step 2: Update Docker Compose

Update `docker/docker-compose.prod.yml` to add Redis and MinIO:

```yaml
services:
  # ... existing postgres service ...

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
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin123}
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

---

## Step 3: Create AWS SES Email Service

Create `apps/web/lib/email.ts`:

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

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: React.ReactElement;
}): Promise<void> {
  const html = render(react);
  
  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  });

  await sesClient.send(command);
}

// Re-export convenience functions using the new sendEmail
export async function sendWelcomeEmail(email: string, name: string) {
  const { WelcomeEmail } = await import('./email-templates');
  await sendEmail({
    to: email,
    subject: 'Welcome to zigznote! 🎉',
    react: WelcomeEmail({ name }),
  });
}

export async function sendVerificationEmail(email: string, name: string, token: string) {
  const { VerificationEmail } = await import('./email-templates');
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify your email address',
    react: VerificationEmail({ name, verifyUrl }),
  });
}

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const { PasswordResetEmail } = await import('./email-templates');
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset your password',
    react: PasswordResetEmail({ name, resetUrl }),
  });
}

export async function sendPasswordChangedEmail(email: string, name: string) {
  const { PasswordChangedEmail } = await import('./email-templates');
  await sendEmail({
    to: email,
    subject: 'Your password has been changed',
    react: PasswordChangedEmail({ name }),
  });
}
```

---

## Step 4: Create Redis Rate Limiting Service

Create `apps/web/lib/rate-limit.ts`:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const redisKey = `ratelimit:${key}`;

  await redis.zremrangebyscore(redisKey, 0, windowStart);
  const count = await redis.zcard(redisKey);

  if (count >= limit) {
    return { success: false, remaining: 0, reset: windowSeconds };
  }

  await redis.zadd(redisKey, now, `${now}-${Math.random()}`);
  await redis.expire(redisKey, windowSeconds);

  return { success: true, remaining: limit - count - 1, reset: windowSeconds };
}

// Pre-configured rate limiters
export const checkLoginRateLimit = (ip: string, email?: string) =>
  checkRateLimit(email ? `login:${ip}:${email}` : `login:${ip}`, 5, 15 * 60);

export const checkRegisterRateLimit = (ip: string) =>
  checkRateLimit(`register:${ip}`, 3, 60 * 60);

export const checkPasswordResetRateLimit = (ip: string) =>
  checkRateLimit(`password-reset:${ip}`, 3, 60 * 60);

export const checkApiRateLimit = (userId: string) =>
  checkRateLimit(`api:${userId}`, 100, 60);

export async function recordFailedAttempt(ip: string, email: string) {
  const key = `failed:${ip}:${email}`;
  await redis.incr(key);
  await redis.expire(key, 24 * 60 * 60);
}

export async function resetFailedAttempts(ip: string, email: string) {
  await redis.del(`failed:${ip}:${email}`);
}
```

---

## Step 5: Create MinIO Storage Service

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

const BUCKETS = {
  AUDIO: 'zigznote-audio',
  EXPORTS: 'zigznote-exports',
  AVATARS: 'zigznote-avatars',
  BACKUPS: 'zigznote-backups',
};

export async function initializeBuckets(): Promise<void> {
  for (const bucket of Object.values(BUCKETS)) {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket);
      console.log(`Created bucket: ${bucket}`);
    }
  }
}

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

export async function getFileStream(
  bucket: keyof typeof BUCKETS,
  fileName: string
): Promise<Readable> {
  return minioClient.getObject(BUCKETS[bucket], fileName);
}

export async function deleteFile(
  bucket: keyof typeof BUCKETS,
  fileName: string
): Promise<void> {
  await minioClient.removeObject(BUCKETS[bucket], fileName);
}

export async function getUploadUrl(
  bucket: keyof typeof BUCKETS,
  fileName: string,
  expirySeconds = 3600
): Promise<string> {
  return minioClient.presignedPutObject(BUCKETS[bucket], fileName, expirySeconds);
}

export async function getDownloadUrl(
  bucket: keyof typeof BUCKETS,
  fileName: string,
  expirySeconds = 3600
): Promise<string> {
  return minioClient.presignedGetObject(BUCKETS[bucket], fileName, expirySeconds);
}

export { minioClient, BUCKETS };
```

---

## Step 6: Initialize MinIO on API Startup

Update `apps/api/src/index.ts` or `apps/api/src/app.ts`:

```typescript
import { initializeBuckets } from './services/storageService';

// Add after database connection
await initializeBuckets();
console.log('MinIO buckets initialized');
```

---

## Step 7: Update Environment Variables

Create/update `.env` files:

```bash
# AWS SES (use existing AWS account)
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=your-existing-aws-access-key
AWS_SES_SECRET_ACCESS_KEY=your-existing-aws-secret-key
AWS_SES_FROM_EMAIL=noreply@zigznote.com

# Redis (self-hosted)
REDIS_URL=redis://localhost:6379

# MinIO (self-hosted)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=your-secure-minio-password
```

---

## Step 8: Update Any Existing S3 Code

Search for and replace any AWS S3 usage with MinIO:

```bash
# Find S3 references
grep -r "aws-sdk.*s3\|@aws-sdk/client-s3\|S3Client" apps/
```

Replace with MinIO storage service calls:
- `s3.putObject()` → `uploadFile()`
- `s3.getObject()` → `downloadFile()` or `getFileStream()`
- `s3.deleteObject()` → `deleteFile()`
- `getSignedUrl()` → `getUploadUrl()` or `getDownloadUrl()`

---

## Step 9: Update API Rate Limiting (if exists)

If the API has rate limiting, update to use the new Redis service:

```typescript
// apps/api/src/middleware/rateLimit.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Use same pattern as web app rate limiting
```

---

## Step 10: Test Each Service

### Test Redis
```bash
# Start Redis
docker-compose up -d redis

# Test connection
docker exec -it zigznote-redis redis-cli ping
# Should return: PONG
```

### Test MinIO
```bash
# Start MinIO
docker-compose up -d minio

# Open browser: http://localhost:9001
# Login with MINIO_ACCESS_KEY and MINIO_SECRET_KEY
```

### Test AWS SES
```bash
# Send test email (create a simple test script)
node -e "
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const client = new SESClient({ region: 'us-east-1' });
client.send(new SendEmailCommand({
  Source: 'noreply@zigznote.com',
  Destination: { ToAddresses: ['your-email@test.com'] },
  Message: {
    Subject: { Data: 'Test' },
    Body: { Text: { Data: 'Test email from zigznote' } }
  }
})).then(() => console.log('Sent!')).catch(console.error);
"
```

---

## Step 11: Run Full Stack Test

```bash
# Start all services
docker-compose up -d

# Run the app
pnpm dev

# Test:
# 1. Sign up (should send verification email via SES)
# 2. Sign in multiple times quickly (should hit rate limit)
# 3. Upload a file (should store in MinIO)
```

---

## Definition of Done

- [ ] AWS SES sends all emails (verification, reset, welcome)
- [ ] Redis handles rate limiting
- [ ] Redis handles session/caching (if applicable)
- [ ] MinIO stores file uploads
- [ ] MinIO generates presigned URLs
- [ ] All buckets auto-created on startup
- [ ] Docker compose includes all services
- [ ] All existing functionality still works
- [ ] Environment variables documented

---

## Files to Create/Update

| File | Action |
|------|--------|
| `apps/web/lib/email.ts` | Replace Resend with AWS SES |
| `apps/web/lib/rate-limit.ts` | Replace Upstash with ioredis |
| `apps/api/src/services/storageService.ts` | Create MinIO service |
| `apps/api/src/index.ts` | Initialize MinIO buckets |
| `docker/docker-compose.prod.yml` | Add Redis, MinIO services |
| `.env.example` | Update with new variables |

---

## Begin Now

1. Install dependencies
2. Update Docker compose
3. Create AWS SES email service
4. Create Redis rate limiting
5. Create MinIO storage service
6. Update existing code to use new services
7. Test everything

**DO NOT STOP until all services are working.**

Go! 🚀
