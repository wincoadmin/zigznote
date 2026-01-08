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
import { createGzip, createGunzip } from 'zlib';
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
      const tempPath = localPath.replace('.gz', '');

      // Try to find container name from environment or use default
      const containerName = process.env.POSTGRES_CONTAINER || 'zigznote-postgres';

      // Check if we should use Docker (when pg_dump not available locally)
      const useDocker = await this.shouldUseDocker();

      if (useDocker) {
        // Use Docker to run pg_dump inside the container
        logger.info({ containerName }, 'Using Docker for pg_dump');
        const dockerCmd = `docker exec -e PGPASSWORD=${password} ${containerName} pg_dump -h localhost -U ${username} -d ${database} --format=plain --no-owner --no-acl`;
        const { stdout } = await execAsync(dockerCmd);
        // Write output to temp file
        const { writeFileSync } = await import('fs');
        writeFileSync(tempPath, stdout);
      } else if (isWindows) {
        // Windows: Use cmd.exe with proper syntax
        const dumpCmd = `set PGPASSWORD=${password}&& pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --format=plain --no-owner --no-acl -f "${tempPath}"`;
        await execAsync(dumpCmd, { shell: 'cmd.exe' });
      } else {
        const envPrefix = `PGPASSWORD="${password}"`;
        const dumpCommand = `${envPrefix} pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --format=plain --no-owner --no-acl`;
        await execAsync(`${dumpCommand} > "${tempPath}"`);
      }

      // Compress using Node.js zlib
      await pipeline(
        createReadStream(tempPath),
        createGzip({ level: BACKUP_CONFIG.compressionLevel }),
        createWriteStream(localPath)
      );
      unlinkSync(tempPath);

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
    const useDocker = await this.shouldUseDocker();

    // Decompress to temp file first
    const tempPath = localPath.replace('.gz', '.tmp.sql');
    await pipeline(
      createReadStream(localPath),
      createGunzip(),
      createWriteStream(tempPath)
    );

    try {
      if (useDocker) {
        // Use Docker to run psql inside the container
        const containerName = process.env.POSTGRES_CONTAINER || 'zigznote-postgres';
        logger.info({ containerName }, 'Using Docker for psql restore');

        // Copy the SQL file into the container and run psql
        await execAsync(`docker cp "${tempPath}" ${containerName}:/tmp/restore.sql`);
        const dockerCmd = `docker exec -e PGPASSWORD=${url.password} ${containerName} psql -U ${url.username} -d ${url.pathname.slice(1)} -f /tmp/restore.sql`;
        await execAsync(dockerCmd);
        await execAsync(`docker exec ${containerName} rm /tmp/restore.sql`);
      } else if (isWindows) {
        const restoreCmd = `set PGPASSWORD=${url.password}&& psql -h ${url.hostname} -p ${url.port || '5432'} -U ${url.username} -d ${url.pathname.slice(1)} -f "${tempPath}"`;
        await execAsync(restoreCmd, { shell: 'cmd.exe' });
      } else {
        const envPrefix = `PGPASSWORD="${url.password}"`;
        const restoreCommand = `${envPrefix} psql -h ${url.hostname} -p ${url.port || '5432'} -U ${url.username} -d ${url.pathname.slice(1)} -f "${tempPath}"`;
        await execAsync(restoreCommand);
      }
    } finally {
      unlinkSync(tempPath);
    }

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
      let header: string;

      if (isWindows) {
        // Windows: Use Node.js to decompress and read header
        header = await this.readGzipHeader(localPath);
      } else {
        const { stdout } = await execAsync(`gunzip -c "${localPath}" | head -20`);
        header = stdout;
      }

      if (!header.includes('PostgreSQL database dump') && !header.includes('SET statement_timeout')) {
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
   * Read first ~20 lines from a gzipped file (for Windows verification)
   */
  private async readGzipHeader(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let lineCount = 0;
      const maxLines = 20;

      const gunzipStream = createGunzip();
      const fileStream = createReadStream(filePath);

      gunzipStream.on('data', (chunk: Buffer) => {
        if (lineCount < maxLines) {
          chunks.push(chunk);
          lineCount += chunk.toString().split('\n').length - 1;
          if (lineCount >= maxLines) {
            fileStream.destroy();
            gunzipStream.destroy();
          }
        }
      });

      gunzipStream.on('end', () => {
        const content = Buffer.concat(chunks).toString();
        const lines = content.split('\n').slice(0, maxLines);
        resolve(lines.join('\n'));
      });

      gunzipStream.on('close', () => {
        const content = Buffer.concat(chunks).toString();
        const lines = content.split('\n').slice(0, maxLines);
        resolve(lines.join('\n'));
      });

      gunzipStream.on('error', reject);
      fileStream.on('error', reject);

      fileStream.pipe(gunzipStream);
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
   * Check if we should use Docker for database commands
   * Returns true if pg_dump is not available locally but Docker is
   */
  private async shouldUseDocker(): Promise<boolean> {
    const isWindows = process.platform === 'win32';

    // Check if pg_dump is available locally
    try {
      const checkCmd = isWindows ? 'where pg_dump' : 'which pg_dump';
      await execAsync(checkCmd);
      return false; // pg_dump available locally
    } catch {
      // pg_dump not available, check for Docker
    }

    // Check if Docker is available and container is running
    try {
      const containerName = process.env.POSTGRES_CONTAINER || 'zigznote-postgres';
      await execAsync(`docker ps --filter "name=${containerName}" --filter "status=running" -q`);
      return true; // Docker available
    } catch {
      throw new Error('pg_dump not available locally and Docker container not running');
    }
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
