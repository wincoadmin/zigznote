/**
 * @ownership
 * @domain Scheduled Backups
 * @description Scheduled backup worker for daily backups and cleanup
 * @single-responsibility YES — handles scheduled backup operations
 * @last-reviewed 2026-01-06
 */

import cron from 'node-cron';
import { backupService } from '../services/backupService';
import { logger } from '../utils/logger';

let isRunning = false;

/**
 * Start the backup worker with scheduled tasks
 */
export function startBackupWorker(): void {
  if (isRunning) {
    logger.warn('Backup worker is already running');
    return;
  }

  isRunning = true;

  // Daily backup at 2:00 AM UTC
  cron.schedule('0 2 * * *', async () => {
    logger.info('Starting scheduled daily backup');
    try {
      const result = await backupService.createBackup('SCHEDULED');
      logger.info(
        { backupId: result.id, size: result.size, duration: result.duration },
        'Scheduled backup completed'
      );
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

  // Weekly full backup on Sunday at 4:00 AM UTC
  cron.schedule('0 4 * * 0', async () => {
    logger.info('Starting scheduled weekly full backup');
    try {
      const result = await backupService.createBackup('FULL');
      logger.info(
        { backupId: result.id, size: result.size, duration: result.duration },
        'Weekly full backup completed'
      );
    } catch (error) {
      logger.error({ error }, 'Weekly full backup failed');
    }
  });

  logger.info('Backup worker started - scheduled: daily 2AM, cleanup 3AM, weekly full 4AM Sunday (UTC)');
}

/**
 * Stop the backup worker (for graceful shutdown)
 */
export function stopBackupWorker(): void {
  isRunning = false;
  logger.info('Backup worker stopped');
}
