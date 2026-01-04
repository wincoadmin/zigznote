/**
 * Summary repository for meeting summary operations
 * Split from transcriptRepository.ts per governance file size limits
 */

import type { Summary } from '@prisma/client';
import { prisma } from '../client';
import type { CreateSummaryInput } from '../types';

/**
 * Repository for Summary operations
 */
export class SummaryRepository {
  /**
   * Finds a summary by meeting ID
   */
  async findByMeetingId(meetingId: string): Promise<Summary | null> {
    return prisma.summary.findUnique({
      where: { meetingId },
    });
  }

  /**
   * Finds a summary by ID
   */
  async findById(id: string): Promise<Summary | null> {
    return prisma.summary.findUnique({
      where: { id },
    });
  }

  /**
   * Creates a summary for a meeting
   */
  async create(data: CreateSummaryInput): Promise<Summary> {
    return prisma.summary.create({
      data: {
        meetingId: data.meetingId,
        content: data.content,
        modelUsed: data.modelUsed,
        promptVersion: data.promptVersion,
      },
    });
  }

  /**
   * Updates a summary
   */
  async update(meetingId: string, data: Partial<CreateSummaryInput>): Promise<Summary> {
    return prisma.summary.update({
      where: { meetingId },
      data,
    });
  }

  /**
   * Upserts a summary (creates or updates)
   */
  async upsert(data: CreateSummaryInput): Promise<Summary> {
    return prisma.summary.upsert({
      where: { meetingId: data.meetingId },
      create: data,
      update: {
        content: data.content,
        modelUsed: data.modelUsed,
        promptVersion: data.promptVersion,
      },
    });
  }

  /**
   * Deletes a summary
   */
  async delete(meetingId: string): Promise<void> {
    await prisma.summary.delete({
      where: { meetingId },
    });
  }

  /**
   * Checks if a summary exists for a meeting
   */
  async exists(meetingId: string): Promise<boolean> {
    const count = await prisma.summary.count({
      where: { meetingId },
    });
    return count > 0;
  }
}

// Export singleton instance
export const summaryRepository = new SummaryRepository();
