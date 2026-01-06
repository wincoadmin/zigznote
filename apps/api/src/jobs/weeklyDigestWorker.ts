/**
 * Weekly Digest Worker
 * Sends weekly summary emails to users
 */

import { Worker, Job, Queue } from 'bullmq';
import { getBullMQConnection } from './queues';
import { analyticsService } from '../services';
import { logger } from '../utils/logger';
import {
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
  type WeeklyDigestJobData,
} from '@zigznote/shared';

let worker: Worker<WeeklyDigestJobData> | null = null;
let queue: Queue<WeeklyDigestJobData> | null = null;

/**
 * Gets or creates the weekly digest queue
 */
export function getWeeklyDigestQueue(): Queue<WeeklyDigestJobData> {
  if (!queue) {
    queue = new Queue<WeeklyDigestJobData>(QUEUE_NAMES.WEEKLY_DIGEST, {
      connection: getBullMQConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }) as Queue<WeeklyDigestJobData>;
  }
  return queue!;
}

/**
 * Schedules a weekly digest for a single user
 */
export async function queueWeeklyDigest(userId: string): Promise<void> {
  const q = getWeeklyDigestQueue();
  await q.add('send', { userId });
}

/**
 * Schedules weekly digests for all eligible users
 * Should be called by a cron job (e.g., Monday mornings)
 */
export async function queueAllWeeklyDigests(): Promise<void> {
  const q = getWeeklyDigestQueue();
  await q.add('sendAll', { sendAll: true });
}

/**
 * Process a single weekly digest job
 */
async function processDigestJob(job: Job<WeeklyDigestJobData>): Promise<{
  sent: number;
  errors: number;
}> {
  const { userId, sendAll } = job.data;

  let sent = 0;
  let errors = 0;

  try {
    if (sendAll) {
      // Get all users eligible for digest
      const users = await analyticsService.getUsersForWeeklyDigest();

      logger.info({ userCount: users.length }, 'Processing weekly digests for all users');

      for (const user of users) {
        try {
          await sendDigestToUser(user);
          sent++;
        } catch (error) {
          errors++;
          logger.error(
            { userId: user.id, error },
            'Failed to send digest to user'
          );
        }
      }
    } else if (userId) {
      // Send to specific user
      const users = await analyticsService.getUsersForWeeklyDigest();
      const user = users.find((u) => u.id === userId);

      if (user) {
        await sendDigestToUser(user);
        sent = 1;
      } else {
        logger.warn({ userId }, 'User not eligible for digest');
      }
    }

    return { sent, errors };
  } catch (error) {
    logger.error({ error }, 'Weekly digest job failed');
    throw error;
  }
}

/**
 * Send digest email to a specific user
 */
async function sendDigestToUser(user: {
  id: string;
  email: string;
  name: string | null;
  organizationId: string;
}): Promise<void> {
  try {
    // Get digest data
    const digestData = await analyticsService.getWeeklyDigestData(user.id);

    // Skip if no activity this week
    if (digestData.meetingsThisWeek === 0) {
      logger.debug({ userId: user.id }, 'Skipping digest - no activity this week');
      return;
    }

    // Build email content (will be used when email service is integrated)
    buildDigestEmail(user.name || user.email, digestData);

    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    // For now, just log the email content
    logger.info(
      {
        userId: user.id,
        email: user.email,
        meetingsThisWeek: digestData.meetingsThisWeek,
        hoursSaved: digestData.hoursSaved,
      },
      'Would send weekly digest email'
    );

    // Mark digest as sent
    await analyticsService.markDigestSent(user.id);

    logger.debug(
      { userId: user.id },
      'Weekly digest sent successfully'
    );
  } catch (error) {
    logger.error({ userId: user.id, error }, 'Failed to send weekly digest');
    throw error;
  }
}

/**
 * Build the digest email content
 */
function buildDigestEmail(
  userName: string,
  data: {
    meetingsThisWeek: number;
    actionItemsCompleted: number;
    hoursSaved: number;
    streak: number;
    topAchievement: string | null;
  }
): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your Week in Review - ${data.meetingsThisWeek} meetings processed`;

  const text = `
Hi ${userName},

Here's your weekly summary from zigznote:

Meetings This Week: ${data.meetingsThisWeek}
Action Items Completed: ${data.actionItemsCompleted}
Time Saved: ${data.hoursSaved} hours
Current Streak: ${data.streak} days
${data.topAchievement ? `New Achievement: ${data.topAchievement}` : ''}

Keep up the great work!

- The zigznote Team
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
    .stat { display: inline-block; text-align: center; padding: 15px; margin: 5px; background: white; border-radius: 8px; min-width: 100px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #6366f1; }
    .stat-label { font-size: 12px; color: #64748b; }
    .achievement { background: #fef3c7; padding: 10px; border-radius: 8px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Week in Review</h1>
      <p>Hi ${userName}, here's your weekly summary</p>
    </div>
    <div class="content">
      <div style="text-align: center;">
        <div class="stat">
          <div class="stat-value">${data.meetingsThisWeek}</div>
          <div class="stat-label">Meetings</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.actionItemsCompleted}</div>
          <div class="stat-label">Tasks Done</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.hoursSaved}h</div>
          <div class="stat-label">Time Saved</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.streak}</div>
          <div class="stat-label">Day Streak</div>
        </div>
      </div>
      ${
        data.topAchievement
          ? `
      <div class="achievement">
        <strong>New Achievement Unlocked!</strong><br/>
        ${data.topAchievement}
      </div>
      `
          : ''
      }
      <p style="text-align: center; margin-top: 20px;">
        <a href="https://app.zigznote.com/dashboard" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          View Dashboard
        </a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Starts the weekly digest worker
 */
export function startWeeklyDigestWorker(): Worker<WeeklyDigestJobData> {
  if (worker) {
    return worker;
  }

  worker = new Worker<WeeklyDigestJobData>(
    QUEUE_NAMES.WEEKLY_DIGEST,
    processDigestJob,
    {
      connection: getBullMQConnection(),
      concurrency: 1, // Process one at a time to avoid rate limits
    }
  );

  worker.on('completed', (job, result) => {
    logger.info(
      { jobId: job.id, sent: result.sent, errors: result.errors },
      'Weekly digest job completed'
    );
  });

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, error },
      'Weekly digest job failed'
    );
  });

  logger.info('Weekly digest worker started');

  return worker;
}

/**
 * Stops the weekly digest worker
 */
export async function stopWeeklyDigestWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('Weekly digest worker stopped');
  }
}

/**
 * Schedule the weekly digest cron job
 * Should be called on app startup
 */
export async function scheduleWeeklyDigestCron(): Promise<void> {
  const q = getWeeklyDigestQueue();

  // Remove existing repeatable job if any
  const repeatableJobs = await q.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === 'sendAll') {
      await q.removeRepeatableByKey(job.key);
    }
  }

  // Schedule new repeatable job
  // Runs every Monday at 9:00 AM UTC
  await q.add(
    'sendAll',
    { sendAll: true },
    {
      repeat: {
        pattern: '0 9 * * 1', // Cron: 9:00 AM every Monday
      },
    }
  );

  logger.info('Weekly digest cron scheduled for Mondays at 9:00 AM UTC');
}
