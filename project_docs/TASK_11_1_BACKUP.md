# Task 11.1: Backup & Recovery System

## Overview
Implement a complete database backup system with scheduled backups, admin API, and restore functionality.

---

## Step 1: Add Database Model

**File:** `packages/database/prisma/schema.prisma`

Add at the end of the file:

```prisma
// ============================================
// Backup & Recovery
// ============================================

model DatabaseBackup {
  id            String       @id @default(uuid())
  filename      String       @unique
  size          BigInt       // Size in bytes
  type          BackupType
  status        BackupStatus @default(PENDING)
  storageUrl    String?      @map("storage_url")
  checksum      String?      // SHA-256 hash
  metadata      Json?
  startedAt     DateTime     @default(now()) @map("started_at")
  completedAt   DateTime?    @map("completed_at")
  expiresAt     DateTime?    @map("expires_at")
  createdById   String?      @map("created_by_id")
  errorMessage  String?      @map("error_message")
  
  @@index([status])
  @@index([type])
  @@index([createdById])
  @@index([expiresAt])
  @@map("database_backups")
}

enum BackupType {
  FULL
  INCREMENTAL
  SCHEDULED
  MANUAL
  PRE_MIGRATION
}

enum BackupStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
  EXPIRED
  DELETED
}
```

Run migration:
```bash
pnpm prisma migrate dev --name add_backup_system
```

---

## Step 2: Create Backup Service

**File:** `apps/api/src/services/backupService.ts`

```typescript
/**
 * Database Backup & Recovery Service
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { prisma, BackupType, BackupStatus } from '@zigznote/database';
import { storageService } from './storageService';
import { logger } from '../utils/logger';
import { config } from '../config';

const execAsync = promisify(exec);

const BACKUP_CONFIG = {
  retentionDays: { daily: 7, weekly: 30, monthly: 365 },
  backupDir: '/tmp/zigznote-backups',
  compressionLevel: 9,
};

export interface BackupResult {
  id: string;
  filename: string;
  size: number;
  checksum: string;
  duration: number;
  storageUrl?: string;
}

class BackupService {
  private isBackupInProgress = false;

  constructor() {
    if (!existsSync(BACKUP_CONFIG.backupDir)) {
      mkdirSync(BACKUP_CONFIG.backupDir, { recursive: true });
    }
  }

  async createBackup(type: BackupType = 'MANUAL', createdById?: string): Promise<BackupResult> {
    if (this.isBackupInProgress) {
      throw new Error('A backup is already in progress');
    }

    this.isBackupInProgress = true;
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `zigznote-backup-${type.toLowerCase()}-${timestamp}.sql.gz`;
    const localPath = `${BACKUP_CONFIG.backupDir}/${filename}`;

    const backup = await prisma.databaseBackup.create({
      data: {
        filename,
        size: BigInt(0),
        type,
        status: 'IN_PROGRESS',
        createdById,
        expiresAt: this.calculateExpiryDate(type),
      },
    });

    try {
      logger.info({ backupId: backup.id, type, filename }, 'Starting database backup');

      const dbUrl = new URL(config.database.url);
      const host = dbUrl.hostname;
      const port = dbUrl.port || '5432';
      const database = dbUrl.pathname.slice(1);
      const username = dbUrl.username;
      const password = dbUrl.password;

      const dumpCommand = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --format=plain --no-owner --no-acl`;
      await execAsync(`${dumpCommand} | gzip -${BACKUP_CONFIG.compressionLevel} > ${localPath}`);

      const stats = statSync(localPath);
      const size = stats.size;
      const checksum = await this.calculateChecksum(localPath);

      let storageUrl: string | undefined;
      if (config.storage?.bucket) {
        storageUrl = await this.uploadToStorage(localPath, filename);
      }

      const metadata = await this.getBackupMetadata();

      await prisma.databaseBackup.update({
        where: { id: backup.id },
        data: {
          size: BigInt(size),
          status: 'COMPLETED',
          checksum,
          storageUrl,
          metadata,
          completedAt: new Date(),
        },
      });

      const duration = Date.now() - startTime;
      logger.info({ backupId: backup.id, size, duration, checksum }, 'Database backup completed');

      if (storageUrl && existsSync(localPath)) {
        unlinkSync(localPath);
      }

      return { id: backup.id, filename, size, checksum, duration, storageUrl };
    } catch (error) {
      logger.error({ backupId: backup.id, error }, 'Database backup failed');

      await prisma.databaseBackup.update({
        where: { id: backup.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });

      if (existsSync(localPath)) {
        unlinkSync(localPath);
      }

      throw error;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  async restoreBackup(backupId: string, dryRun = false): Promise<void> {
    const backup = await prisma.databaseBackup.findUnique({ where: { id: backupId } });

    if (!backup) throw new Error(`Backup not found: ${backupId}`);
    if (backup.status !== 'COMPLETED') throw new Error(`Cannot restore backup with status: ${backup.status}`);

    const localPath = `${BACKUP_CONFIG.backupDir}/${backup.filename}`;
    
    if (!existsSync(localPath) && backup.storageUrl) {
      await this.downloadFromStorage(backup.storageUrl, localPath);
    }

    if (!existsSync(localPath)) throw new Error('Backup file not found');

    const currentChecksum = await this.calculateChecksum(localPath);
    if (currentChecksum !== backup.checksum) {
      throw new Error('Backup checksum verification failed');
    }

    if (dryRun) {
      logger.info({ backupId }, 'Dry run completed - backup verified');
      return;
    }

    const dbUrl = new URL(config.database.url);
    const restoreCommand = `gunzip -c ${localPath} | PGPASSWORD="${dbUrl.password}" psql -h ${dbUrl.hostname} -p ${dbUrl.port || '5432'} -U ${dbUrl.username} -d ${dbUrl.pathname.slice(1)}`;
    await execAsync(restoreCommand);

    logger.info({ backupId }, 'Database restore completed');
  }

  async listBackups(options: { page?: number; limit?: number; type?: BackupType; status?: BackupStatus } = {}) {
    const { page = 1, limit = 20, type, status } = options;
    const skip = (page - 1) * limit;
    const where = { ...(type && { type }), ...(status && { status }) };

    const [backups, total] = await Promise.all([
      prisma.databaseBackup.findMany({ where, orderBy: { startedAt: 'desc' }, skip, take: limit }),
      prisma.databaseBackup.count({ where }),
    ]);

    return {
      backups: backups.map(b => ({ ...b, size: Number(b.size) })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async deleteBackup(backupId: string): Promise<void> {
    const backup = await prisma.databaseBackup.findUnique({ where: { id: backupId } });
    if (!backup) throw new Error(`Backup not found: ${backupId}`);

    if (backup.storageUrl) {
      await storageService.deleteFile(backup.filename, 'backups');
    }

    const localPath = `${BACKUP_CONFIG.backupDir}/${backup.filename}`;
    if (existsSync(localPath)) unlinkSync(localPath);

    await prisma.databaseBackup.update({ where: { id: backupId }, data: { status: 'DELETED' } });
    logger.info({ backupId }, 'Backup deleted');
  }

  async verifyBackup(backupId: string): Promise<{ valid: boolean; message: string }> {
    const backup = await prisma.databaseBackup.findUnique({ where: { id: backupId } });
    if (!backup) return { valid: false, message: 'Backup not found' };
    if (backup.status !== 'COMPLETED') return { valid: false, message: `Status is ${backup.status}` };

    const localPath = `${BACKUP_CONFIG.backupDir}/${backup.filename}`;
    if (!existsSync(localPath) && backup.storageUrl) {
      await this.downloadFromStorage(backup.storageUrl, localPath);
    }
    if (!existsSync(localPath)) return { valid: false, message: 'File not accessible' };

    const currentChecksum = await this.calculateChecksum(localPath);
    if (currentChecksum !== backup.checksum) return { valid: false, message: 'Checksum mismatch' };

    try {
      const { stdout } = await execAsync(`gunzip -c ${localPath} | head -20`);
      if (!stdout.includes('PostgreSQL database dump')) {
        return { valid: false, message: 'Invalid backup format' };
      }
    } catch {
      return { valid: false, message: 'Failed to read backup file' };
    }

    return { valid: true, message: 'Backup verified successfully' };
  }

  async cleanupExpiredBackups(): Promise<number> {
    const expiredBackups = await prisma.databaseBackup.findMany({
      where: { expiresAt: { lt: new Date() }, status: { in: ['COMPLETED', 'FAILED'] } },
    });

    let deletedCount = 0;
    for (const backup of expiredBackups) {
      try {
        await this.deleteBackup(backup.id);
        deletedCount++;
      } catch (error) {
        logger.error({ backupId: backup.id, error }, 'Failed to delete expired backup');
      }
    }

    logger.info({ deletedCount }, 'Expired backups cleanup completed');
    return deletedCount;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async uploadToStorage(localPath: string, filename: string): Promise<string> {
    const fileStream = createReadStream(localPath);
    const key = `backups/${filename}`;
    await storageService.uploadFile(fileStream, key, 'application/gzip');
    return `s3://${config.storage.bucket}/${key}`;
  }

  private async downloadFromStorage(storageUrl: string, localPath: string): Promise<void> {
    const key = storageUrl.replace(`s3://${config.storage.bucket}/`, '');
    const stream = await storageService.getFileStream(key);
    const writeStream = createWriteStream(localPath);
    await pipeline(stream, writeStream);
  }

  private async getBackupMetadata(): Promise<Record<string, unknown>> {
    const tables = ['organizations', 'users', 'meetings', 'transcripts', 'summaries'];
    const counts: Record<string, number> = {};

    for (const table of tables) {
      try {
        const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`SELECT COUNT(*) as count FROM ${table}`);
        counts[table] = Number(result[0].count);
      } catch {
        counts[table] = -1;
      }
    }

    return { tableCounts: counts, timestamp: new Date().toISOString() };
  }

  private calculateExpiryDate(type: BackupType): Date {
    const now = Date.now();
    const days = type === 'PRE_MIGRATION' ? BACKUP_CONFIG.retentionDays.monthly :
                 type === 'SCHEDULED' ? BACKUP_CONFIG.retentionDays.daily :
                 BACKUP_CONFIG.retentionDays.weekly;
    return new Date(now + days * 24 * 60 * 60 * 1000);
  }
}

export const backupService = new BackupService();
```

---

## Step 3: Create Backup Routes

**File:** `apps/api/src/routes/admin/backups.ts`

```typescript
/**
 * Admin Backup Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { backupService } from '../../services/backupService';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validateRequest } from '../../middleware/validateRequest';
import { adminAuth, AdminRequest } from '../../middleware/adminAuth';
import { auditService } from '../../services/auditService';
import { BackupType } from '@zigznote/database';

const router: Router = Router();
router.use(adminAuth);

// POST /admin/backups - Create backup
const createBackupSchema = z.object({
  body: z.object({ type: z.enum(['FULL', 'MANUAL', 'PRE_MIGRATION']).default('MANUAL') }),
});

router.post('/', validateRequest(createBackupSchema), asyncHandler(async (req: Request, res: Response) => {
  const adminReq = req as AdminRequest;
  const { type } = req.body;
  const result = await backupService.createBackup(type as BackupType, adminReq.admin.id);

  await auditService.log({
    adminId: adminReq.admin.id,
    action: 'backup.create',
    resource: 'database_backup',
    resourceId: result.id,
    details: { type, size: result.size, filename: result.filename },
  });

  res.status(201).json({ message: 'Backup created successfully', backup: result });
}));

// GET /admin/backups - List backups
const listBackupsSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    type: z.enum(['FULL', 'INCREMENTAL', 'SCHEDULED', 'MANUAL', 'PRE_MIGRATION']).optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED', 'DELETED']).optional(),
  }),
});

router.get('/', validateRequest(listBackupsSchema), asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, type, status } = req.query as any;
  const result = await backupService.listBackups({ page, limit, type, status });
  res.json(result);
}));

// POST /admin/backups/:id/verify - Verify backup
router.post('/:id/verify', asyncHandler(async (req: Request, res: Response) => {
  const result = await backupService.verifyBackup(req.params.id);
  res.json(result);
}));

// POST /admin/backups/:id/restore - Restore backup
const restoreSchema = z.object({
  body: z.object({
    dryRun: z.boolean().default(true),
    confirmRestore: z.literal(true),
  }),
});

router.post('/:id/restore', validateRequest(restoreSchema), asyncHandler(async (req: Request, res: Response) => {
  const adminReq = req as AdminRequest;
  const { dryRun } = req.body;

  await auditService.log({
    adminId: adminReq.admin.id,
    action: 'backup.restore',
    resource: 'database_backup',
    resourceId: req.params.id,
    details: { dryRun },
  });

  await backupService.restoreBackup(req.params.id, dryRun);
  res.json({ message: dryRun ? 'Dry run completed' : 'Database restored successfully' });
}));

// DELETE /admin/backups/:id - Delete backup
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const adminReq = req as AdminRequest;
  await backupService.deleteBackup(req.params.id);

  await auditService.log({
    adminId: adminReq.admin.id,
    action: 'backup.delete',
    resource: 'database_backup',
    resourceId: req.params.id,
  });

  res.json({ message: 'Backup deleted successfully' });
}));

// POST /admin/backups/cleanup - Cleanup expired
router.post('/cleanup', asyncHandler(async (req: Request, res: Response) => {
  const adminReq = req as AdminRequest;
  const deletedCount = await backupService.cleanupExpiredBackups();

  await auditService.log({
    adminId: adminReq.admin.id,
    action: 'backup.cleanup',
    resource: 'database_backup',
    details: { deletedCount },
  });

  res.json({ message: `Cleaned up ${deletedCount} expired backups`, deletedCount });
}));

export default router;
```

---

## Step 4: Create Backup Worker

**File:** `apps/api/src/jobs/backupWorker.ts`

```typescript
/**
 * Scheduled Backup Worker
 */

import cron from 'node-cron';
import { backupService } from '../services/backupService';
import { logger } from '../utils/logger';

export function startBackupWorker(): void {
  // Daily backup at 2:00 AM UTC
  cron.schedule('0 2 * * *', async () => {
    logger.info('Starting scheduled daily backup');
    try {
      const result = await backupService.createBackup('SCHEDULED');
      logger.info({ backupId: result.id, size: result.size }, 'Scheduled backup completed');
    } catch (error) {
      logger.error({ error }, 'Scheduled backup failed');
    }
  });

  // Cleanup expired backups at 3:00 AM UTC
  cron.schedule('0 3 * * *', async () => {
    logger.info('Starting expired backup cleanup');
    try {
      const deletedCount = await backupService.cleanupExpiredBackups();
      logger.info({ deletedCount }, 'Backup cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Backup cleanup failed');
    }
  });

  logger.info('Backup worker started');
}
```

---

## Step 6: Start Backup Worker in App

**File:** `apps/api/src/index.ts` or `apps/api/src/app.ts`

Add import and start the worker:

```typescript
import { startBackupWorker } from './jobs/backupWorker';

// After app starts listening:
startBackupWorker();
```

---

## Step 7: Add to Admin Router

**File:** `apps/api/src/routes/admin/index.ts`

Add this import and route:

```typescript
import backupsRouter from './backups';

// Add with other admin routes
router.use('/backups', backupsRouter);
```

---

## Step 8: Create Shell Scripts

**File:** `scripts/backup.sh`

```bash
#!/bin/bash
set -e

BACKUP_TYPE=${1:-manual}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_FILE="zigznote-backup-${BACKUP_TYPE}-${TIMESTAMP}.sql.gz"

echo "🔄 Starting ${BACKUP_TYPE} backup..."
mkdir -p "$BACKUP_DIR"

if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

DB_HOST=$(echo $DATABASE_URL | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_USER=$(echo $DATABASE_URL | sed -n 's|.*//\([^:]*\):.*|\1|p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --format=plain --no-owner --no-acl | gzip -9 > "${BACKUP_DIR}/${BACKUP_FILE}"

CHECKSUM=$(sha256sum "${BACKUP_DIR}/${BACKUP_FILE}" | cut -d' ' -f1)
SIZE=$(stat -c%s "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_DIR}/${BACKUP_FILE}")

echo "✅ Backup completed!"
echo "   File: ${BACKUP_DIR}/${BACKUP_FILE}"
echo "   Size: ${SIZE} bytes"
echo "   Checksum: ${CHECKSUM}"
```

**File:** `scripts/restore.sh`

```bash
#!/bin/bash
set -e

BACKUP_FILE=$1
DRY_RUN=$2

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./scripts/restore.sh <backup-file> [--dry-run]"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Preparing to restore from: ${BACKUP_FILE}"

if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

CHECKSUM=$(sha256sum "$BACKUP_FILE" | cut -d' ' -f1)
echo "   Checksum: ${CHECKSUM}"

gunzip -t "$BACKUP_FILE" 2>/dev/null && echo "   ✓ Backup file is valid" || { echo "   ✗ Backup corrupted"; exit 1; }

if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "🔍 Dry run - backup verified, no changes made"
    exit 0
fi

echo "⚠️  WARNING: This will REPLACE ALL DATA"
read -p "Type 'yes' to confirm: " CONFIRM
[ "$CONFIRM" != "yes" ] && { echo "Cancelled."; exit 0; }

DB_HOST=$(echo $DATABASE_URL | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_USER=$(echo $DATABASE_URL | sed -n 's|.*//\([^:]*\):.*|\1|p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --quiet

echo "✅ Database restored successfully!"
```

Make executable:
```bash
chmod +x scripts/backup.sh scripts/restore.sh
```

---

## Verification Checklist

- [ ] Migration runs: `pnpm prisma migrate dev --name add_backup_system`
- [ ] Backup service compiles without errors
- [ ] Manual backup works: `./scripts/backup.sh manual`
- [ ] Backup file created in `./backups/`
- [ ] Admin API responds: `GET /api/admin/backups`
