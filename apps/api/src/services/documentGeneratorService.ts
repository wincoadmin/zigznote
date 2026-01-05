/**
 * Document Generator Service
 * Generates PDF, DOCX, Markdown, and CSV documents from meeting content
 */

import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import pino from 'pino';
import { storageService } from './storageService';
import { config } from '../config';
import { randomUUID } from 'crypto';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface GenerateDocumentOptions {
  content: string;
  format: 'pdf' | 'docx' | 'md' | 'csv';
  title: string;
  meetingId?: string;
  contentType?: 'summary' | 'action_items' | 'decisions' | 'transcript_excerpt' | 'custom';
  userId: string;
  organizationId: string;
}

export interface GeneratedDocument {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  expiresAt: Date;
  mimeType: string;
}

// MIME types for each format
const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  md: 'text/markdown',
  csv: 'text/csv',
};

class DocumentGeneratorService {
  /**
   * Generate a document from content
   */
  async generate(options: GenerateDocumentOptions): Promise<GeneratedDocument> {
    const { content, format, title, userId, organizationId } = options;
    const startTime = Date.now();

    // Sanitize title for filename
    const safeTitle = title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);

    const timestamp = Date.now();
    const fileName = `${safeTitle}_${timestamp}.${format}`;

    let buffer: Buffer;

    switch (format) {
      case 'pdf':
        buffer = await this.generatePDF(content, title);
        break;
      case 'docx':
        buffer = await this.generateDOCX(content, title);
        break;
      case 'md':
        buffer = this.generateMarkdown(content, title);
        break;
      case 'csv':
        buffer = this.generateCSV(content);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const mimeType = MIME_TYPES[format]!;
    let downloadUrl: string;
    let expiresAt: Date;

    // If storage is configured, upload to S3
    if (storageService.isConfigured()) {
      const fileId = randomUUID();
      const storagePath = `generated-docs/${organizationId}/${userId}/${fileId}/${fileName}`;

      // Use a custom upload method that accepts any content type
      await this.uploadToStorage(storagePath, buffer, mimeType);

      // Generate signed URL (expires in 1 hour)
      expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      downloadUrl = await storageService.getPresignedDownloadUrl(storagePath, 3600);
    } else {
      // For development without S3, return base64 data URL
      const base64 = buffer.toString('base64');
      downloadUrl = `data:${mimeType};base64,${base64}`;
      expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    }

    const latencyMs = Date.now() - startTime;

    logger.info(
      {
        format,
        fileSize: buffer.length,
        latencyMs,
        userId,
        organizationId,
        hasStorage: storageService.isConfigured(),
      },
      'Document generated'
    );

    return {
      downloadUrl,
      fileName,
      fileSize: buffer.length,
      expiresAt,
      mimeType,
    };
  }

  /**
   * Upload buffer to S3 storage
   */
  private async uploadToStorage(
    path: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<void> {
    if (!config.aws?.accessKeyId || !config.aws?.secretAccessKey) {
      throw new Error('S3 storage is not configured');
    }

    const client = new S3Client({
      region: config.aws?.region || 'us-east-1',
      endpoint: config.aws?.endpoint,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
      forcePathStyle: !!config.aws?.endpoint,
    });

    const bucket = config.aws?.bucket || 'zigznote-audio';

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: buffer,
      ContentType: mimeType,
      ContentDisposition: `attachment; filename="${path.split('/').pop()}"`,
    }));
  }

  /**
   * Generate PDF document
   */
  private async generatePDF(content: string, title: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown();

      // Date
      doc.fontSize(10).font('Helvetica').fillColor('#666666')
        .text(`Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);

      // Content - handle markdown-like formatting
      doc.fillColor('#000000').fontSize(11).font('Helvetica');

      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('# ')) {
          doc.moveDown().fontSize(16).font('Helvetica-Bold')
            .text(line.slice(2)).font('Helvetica').fontSize(11);
        } else if (line.startsWith('## ')) {
          doc.moveDown().fontSize(14).font('Helvetica-Bold')
            .text(line.slice(3)).font('Helvetica').fontSize(11);
        } else if (line.startsWith('### ')) {
          doc.moveDown().fontSize(12).font('Helvetica-Bold')
            .text(line.slice(4)).font('Helvetica').fontSize(11);
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          doc.text(`  \u2022  ${line.slice(2)}`);
        } else if (line.match(/^\d+\.\s/)) {
          doc.text(`  ${line}`);
        } else if (line.trim() === '') {
          doc.moveDown(0.5);
        } else {
          doc.text(line);
        }
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).fillColor('#999999')
        .text('Generated by zigznote', { align: 'center' });

      doc.end();
    });
  }

  /**
   * Generate DOCX document
   */
  private async generateDOCX(content: string, title: string): Promise<Buffer> {
    const children: Paragraph[] = [];

    // Title
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
      })
    );

    // Date
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated on ${new Date().toLocaleDateString()}`,
            size: 20,
            color: '666666',
          }),
        ],
      })
    );

    // Empty paragraph for spacing
    children.push(new Paragraph({ text: '' }));

    // Content
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.startsWith('# ')) {
        children.push(new Paragraph({
          text: line.slice(2),
          heading: HeadingLevel.HEADING_1,
        }));
      } else if (line.startsWith('## ')) {
        children.push(new Paragraph({
          text: line.slice(3),
          heading: HeadingLevel.HEADING_2,
        }));
      } else if (line.startsWith('### ')) {
        children.push(new Paragraph({
          text: line.slice(4),
          heading: HeadingLevel.HEADING_3,
        }));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        children.push(new Paragraph({
          text: `\u2022 ${line.slice(2)}`,
        }));
      } else if (line.trim() !== '') {
        children.push(new Paragraph({ text: line }));
      }
    }

    // Footer
    children.push(new Paragraph({ text: '' }));
    children.push(new Paragraph({
      children: [
        new TextRun({
          text: 'Generated by zigznote',
          size: 16,
          color: '999999',
        }),
      ],
    }));

    const doc = new Document({
      sections: [{ children }],
    });

    return Packer.toBuffer(doc);
  }

  /**
   * Generate Markdown document
   */
  private generateMarkdown(content: string, title: string): Buffer {
    const md = `# ${title}

*Generated on ${new Date().toLocaleDateString()}*

---

${content}

---

*Generated by zigznote*
`;
    return Buffer.from(md, 'utf-8');
  }

  /**
   * Generate CSV document
   */
  private generateCSV(content: string): Buffer {
    // Parse content assuming it's a list format
    // Each line becomes a row, handle common patterns
    const lines = content.split('\n').filter(l => l.trim());

    let csv = '';

    // Detect if it's action items format (has assignees or due dates)
    const hasAssignees = content.includes('(') && content.includes(')');
    const hasDueDates = /due[:\s]/i.test(content) || /by\s+\d/i.test(content);

    if (hasAssignees || hasDueDates) {
      csv = 'Item,Assignee,Due Date,Status\n';
      for (const line of lines) {
        if (line.startsWith('-') || line.startsWith('*') || line.match(/^\d+\.\s/)) {
          const text = line.replace(/^[-*\d.]+\s*/, '');

          // Extract assignee from parentheses
          const assigneeMatch = text.match(/\(([^)]+)\)/);

          // Extract due date
          const dueMatch = text.match(/(?:due|by)[:\s]+([^,\n)]+)/i);

          // Clean item text
          let item = text
            .replace(/\([^)]+\)/g, '')
            .replace(/(?:due|by)[:\s]+[^,\n]+/i, '')
            .trim();

          // Remove trailing punctuation
          item = item.replace(/[,;]+$/, '').trim();

          const assignee = assigneeMatch?.[1]?.trim() || '';
          const due = dueMatch?.[1]?.trim() || '';

          csv += `"${this.escapeCSV(item)}","${this.escapeCSV(assignee)}","${this.escapeCSV(due)}","Pending"\n`;
        }
      }
    } else {
      // Generic list to CSV
      csv = 'Item\n';
      for (const line of lines) {
        // Skip headers
        if (line.startsWith('#')) continue;

        const cleanLine = line.replace(/^[-*\d.]+\s*/, '').trim();
        if (cleanLine) {
          csv += `"${this.escapeCSV(cleanLine)}"\n`;
        }
      }
    }

    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Escape CSV field value
   */
  private escapeCSV(value: string): string {
    // Escape double quotes by doubling them
    return value.replace(/"/g, '""');
  }
}

export const documentGeneratorService = new DocumentGeneratorService();
