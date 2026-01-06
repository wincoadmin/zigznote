/**
 * @ownership
 * @domain Database Backup & Recovery
 * @description Handles database backups, restores, and cleanup operations
 * @single-responsibility YES — handles all backup operations
 * @last-reviewed 2026-01-06
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { prisma, Prisma } from '@zigznote/database';

type BackupType = 'FULL' | 'INCREMENTAL' | 'SCHEDULED' | 'MANUAL' | 'PRE_MIGRATION';
type BackupStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'DELETED';
import { storageService } from './storageService';
import { logger } from '../utils/logger';
import { config } from '../config';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const BACKUP_CONFIG = {
  retentionDays: { daily: 7, weekly: 30, monthly: 365 },
  backupDir: process.env.BACKUP_DIR || path.join(os.tmpdir(), 'zigznote-backups'),
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

  /**
   * Create a database backup
   */
  async createBackup(type: BackupType = 'MANUAL', createdById?: string): Promise<BackupResult> {
    if (this.isBackupInProgress) {
      throw new Error('A backup is already in progress');
    }

    this.isBackupInProgress = true;
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `zigznote-backup-${type.toLowerCase()}-${timestamp}.sql.gz`;
    const localPath = path.join(BACKUP_CONFIG.backupDir, filename);

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

      // Parse DATABASE_URL
      const dbUrl = config.databaseUrl;
      if (!dbUrl) {
        throw new Error('DATABASE_URL is not configured');
      }

      const url = new URL(dbUrl);
      const host = url.hostname;
      const port = url.port || '5432';
      const database = url.pathname.slice(1);
      const username = url.username;
      const password = url.password;

      // Build pg_dump command
      const isWindows = process.platform === 'win32';
      const envPrefix = isWindows
        ? `set PGPASSWORD=${password}&&`
        : `PGPASSWORD="${password}"`;

      const dumpCommand = `${envPrefix} pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --format=plain --no-owner --no-acl`;

      if (isWindows) {
        // Windows: use PowerShell for piping
        await execAsync(`powershell -Command "${dumpCommand} | gzip > '${localPath}'"`, {
          shell: 'cmd.exe',
        });
      } else {
        await execAsync(`${dumpCommand} | gzip -${BACKUP_CONFIG.compressionLevel} > "${localPath}"`);
      }

      const stats = statSync(localPath);
      const size = stats.size;
      const checksum = await this.calculateChecksum(localPath);

      let storageUrl: string | undefined;
      if (storageService.isConfigured()) {
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
          metadata: metadata as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      const duration = Date.now() - startTime;
      logger.info({ backupId: backup.id, size, duration, checksum }, 'Database backup completed');

      // Clean up local file if uploaded to storage
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

  /**
   * Restore a database from backup
   */
  async restoreBackup(backupId: string, dryRun = false): Promise<void> {
    const backup = await prisma.databaseBackup.findUnique({ where: { id: backupId } });

    if (!backup) throw new Error(`Backup not found: ${backupId}`);
    if (backup.status !== 'COMPLETED') throw new Error(`Cannot restore backup with status: ${backup.status}`);

    const localPath = path.join(BACKUP_CONFIG.backupDir, backup.filename);

    // Download from storage if not local
    if (!existsSync(localPath) && backup.storageUrl) {
      await this.downloadFromStorage(backup.storageUrl, localPath);
    }

    if (!existsSync(localPath)) throw new Error('Backup file not found');

    // Verify checksum
    const currentChecksum = await this.calculateChecksum(localPath);
    if (currentChecksum !== backup.checksum) {
      throw new Error('Backup checksum verification failed');
    }

    if (dryRun) {
      logger.info({ backupId }, 'Dry run completed - backup verified');
      return;
    }

    // Parse DATABASE_URL
    const dbUrl = config.databaseUrl;
    if (!dbUrl) {
      throw new Error('DATABASE_URL is not configured');
    }

    const url = new URL(dbUrl);
    const isWindows = process.platform === 'win32';
    const envPrefix = isWindows
      ? `set PGPASSWORD=${url.password}&&`
      : `PGPASSWORD="${url.password}"`;

    const restoreCommand = isWindows
      ? `powershell -Command "gunzip -c '${localPath}' | ${envPrefix} psql -h ${url.hostname} -p ${url.port || '5432'} -U ${url.username} -d ${url.pathname.slice(1)}"`
      : `gunzip -c "${localPath}" | ${envPrefix} psql -h ${url.hostname} -p ${url.port || '5432'} -U ${url.username} -d ${url.pathname.slice(1)}`;

    await execAsync(restoreCommand);

    logger.info({ backupId }, 'Database restore completed');
  }

  /**
   * List backups with pagination and filtering
   */
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

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backup = await prisma.databaseBackup.findUnique({ where: { id: backupId } });
    if (!backup) throw new Error(`Backup not found: ${backupId}`);

    // Delete from storage if exists
    if (backup.storageUrl && storageService.isConfigured()) {
      try {
        const key = `backups/${backup.filename}`;
        await storageService.deleteFile(key);
      } catch (error) {
        logger.warn({ backupId, error }, 'Failed to delete backup from storage');
      }
    }

    // Delete local file if exists
    const localPath = path.join(BACKUP_CONFIG.backupDir, backup.filename);
    if (existsSync(localPath)) unlinkSync(localPath);

    await prisma.databaseBackup.update({ where: { id: backupId }, data: { status: 'DELETED' } });
    logger.info({ backupId }, 'Backup deleted');
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<{ valid: boolean; message: string }> {
    const backup = await prisma.databaseBackup.findUnique({ where: { id: backupId } });
    if (!backup) return { valid: false, message: 'Backup not found' };
    if (backup.status !== 'COMPLETED') return { valid: false, message: `Status is ${backup.status}` };

    const localPath = path.join(BACKUP_CONFIG.backupDir, backup.filename);

    // Download if not local
    if (!existsSync(localPath) && backup.storageUrl) {
      try {
        await this.downloadFromStorage(backup.storageUrl, localPath);
      } catch {
        return { valid: false, message: 'Failed to download backup from storage' };
      }
    }

    if (!existsSync(localPath)) return { valid: false, message: 'File not accessible' };

    // Verify checksum
    const currentChecksum = await this.calculateChecksum(localPath);
    if (currentChecksum !== backup.checksum) return { valid: false, message: 'Checksum mismatch' };

    // Verify file format
    try {
      const isWindows = process.platform === 'win32';
      const headCommand = isWindows
        ? `powershell -Command "gunzip -c '${localPath}' | Select-Object -First 20"`
        : `gunzip -c "${localPath}" | head -20`;

      const { stdout } = await execAsync(headCommand);
      if (!stdout.includes('PostgreSQL database dump') && !stdout.includes('SET statement_timeout')) {
        return { valid: false, message: 'Invalid backup format' };
      }
    } catch {
      return { valid: false, message: 'Failed to read backup file' };
    }

    return { valid: true, message: 'Backup verified successfully' };
  }

  /**
   * Cleanup expired backups
   */
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

  /**
   * Get latest successful backup
   */
  async getLatestBackup(): Promise<{ id: string; filename: string; completedAt: Date } | null> {
    const backup = await prisma.databaseBackup.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      select: { id: true, filename: true, completedAt: true },
    });
    return backup ? { ...backup, completedAt: backup.completedAt! } : null;
  }

  /**
   * Calculate SHA-256 checksum of a file
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Upload backup to cloud storage
   */
  private async uploadToStorage(localPath: string, filename: string): Promise<string> {
    const key = `backups/${filename}`;
    const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = createReadStream(localPath);
      stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    // Use uploadFileBuffer instead of uploadFile with stream
    await storageService.uploadFileBuffer('backups', filename, 'application/gzip', fileBuffer);
    return `s3://${config.aws?.bucket || 'zigznote'}/${key}`;
  }

  /**
   * Download backup from cloud storage
   */
  private async downloadFromStorage(storageUrl: string, localPath: string): Promise<void> {
    const key = storageUrl.replace(/^s3:\/\/[^/]+\//, '');
    const stream = await storageService.getFileStream(key);
    const writeStream = createWriteStream(localPath);
    await pipeline(stream, writeStream);
  }

  /**
   * Get metadata about current database state
   */
  private async getBackupMetadata(): Promise<Record<string, unknown>> {
    const tables = ['organizations', 'users', 'meetings', 'transcripts', 'summaries'];
    const counts: Record<string, number> = {};

    for (const table of tables) {
      try {
        const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
          `SELECT COUNT(*) as count FROM "${table}"`
        );
        counts[table] = Number(result[0].count);
      } catch {
        counts[table] = -1;
      }
    }

    return { tableCounts: counts, timestamp: new Date().toISOString() };
  }

  /**
   * Calculate expiry date based on backup type
   */
  private calculateExpiryDate(type: BackupType): Date {
    const now = Date.now();
    const days = type === 'PRE_MIGRATION' ? BACKUP_CONFIG.retentionDays.monthly :
                 type === 'SCHEDULED' ? BACKUP_CONFIG.retentionDays.daily :
                 BACKUP_CONFIG.retentionDays.weekly;
    return new Date(now + days * 24 * 60 * 60 * 1000);
  }
}

export const backupService = new BackupService();
