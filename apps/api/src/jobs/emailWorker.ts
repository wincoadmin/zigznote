/**
 * Email Worker
 * Processes email jobs from the queue using Resend
 */

import { Worker, Job } from 'bullmq';
import { Resend } from 'resend';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getRedisConnection, type EmailJobData } from './queues';

let resend: Resend | null = null;
let emailWorker: Worker<EmailJobData> | null = null;

/**
 * Get or create Resend client
 */
function getResendClient(): Resend | null {
  if (!config.resend?.apiKey) {
    return null;
  }

  if (!resend) {
    resend = new Resend(config.resend.apiKey);
  }

  return resend;
}

/**
 * Process email job
 */
async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, html, from } = job.data;
  const client = getResendClient();

  if (!client) {
    // If Resend is not configured, log and skip (for development)
    logger.warn(
      { to, subject, jobId: job.id },
      'Resend not configured, skipping email'
    );
    return;
  }

  try {
    const result = await client.emails.send({
      from: from || config.email?.from || 'zigznote <noreply@zigznote.com>',
      to,
      subject,
      html,
    });

    if (result.error) {
      logger.error(
        { to, subject, error: result.error, jobId: job.id },
        'Resend API returned error'
      );
      throw new Error(result.error.message);
    }

    logger.info(
      { to, subject, emailId: result.data?.id, jobId: job.id },
      'Email sent successfully'
    );
  } catch (error) {
    logger.error({ to, subject, error, jobId: job.id }, 'Failed to send email');
    throw error; // Will trigger retry
  }
}

/**
 * Start the email worker
 */
export function startEmailWorker(): Worker<EmailJobData> | null {
  if (!config.resend?.apiKey) {
    logger.info('Email worker not started - Resend API key not configured');
    return null;
  }

  if (emailWorker) {
    return emailWorker;
  }

  emailWorker = new Worker<EmailJobData>(
    'email',
    processEmailJob,
    {
      connection: getRedisConnection(),
      concurrency: 5, // Process up to 5 emails concurrently
    }
  );

  emailWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Email job completed');
  });

  emailWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, error: err.message, attempts: job?.attemptsMade },
      'Email job failed'
    );
  });

  emailWorker.on('error', (err) => {
    logger.error({ error: err }, 'Email worker error');
  });

  logger.info('Email worker started');

  return emailWorker;
}

/**
 * Stop the email worker
 */
export async function stopEmailWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
    logger.info('Email worker stopped');
  }
}

/**
 * Get the email worker instance
 */
export function getEmailWorker(): Worker<EmailJobData> | null {
  return emailWorker;
}
