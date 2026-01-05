# Phase 9: AI-Powered Contextual File Generation

## Overview

Enable the meeting AI chat to intelligently offer downloadable files when appropriate, mimicking natural assistant behavior. The AI decides when a file would be useful (or user explicitly requests one), offers download options, and generates the file on user click.

**Estimated Time:** 2-3 hours  
**Priority:** Enhancement  
**Dependencies:** Phase 8.9 (export service exists)

---

## User Experience

### Scenario 1: User Explicitly Requests
```
User: "Create a PDF summary I can send to my manager"

AI: "I've prepared an executive summary for you:

    [Summary text here...]
    
    📄 Ready to download
    [Download PDF] [Download Word]"
```

### Scenario 2: AI Proactively Offers (Structured Data)
```
User: "What were all the action items?"

AI: "Here are the 7 action items from the meeting:

    1. Update roadmap (Sarah) - Due Jan 15
    2. Schedule legal review (Mike) - Due Jan 10
    3. Finalize budget proposal (Lisa) - Due Jan 12
    ...
    
    📋 Want this as a checklist?
    [Download PDF] [Download Markdown]"
```

### Scenario 3: Normal Chat (No File Offered)
```
User: "Who mentioned the budget?"

AI: "John raised budget concerns at 14:32. He mentioned that 
    Q1 allocation might need revision..."
    
    [No download options - just a normal response]
```

---

## Implementation

### 1. Update QA Response Interface

**File:** `apps/api/src/services/meetingQAService.ts`

```typescript
interface QAResponse {
  answer: string;
  sources: SourceReference[];
  tokensUsed: number;
  modelUsed: string;
  latencyMs: number;
  
  // NEW: AI can suggest file generation when appropriate
  fileOffer?: {
    shouldOffer: true;
    formats: ('pdf' | 'docx' | 'md' | 'csv')[];
    suggestedTitle: string;
    description: string;
    contentType: 'summary' | 'action_items' | 'decisions' | 'transcript_excerpt' | 'custom';
  };
}
```

---

### 2. Update AI System Prompt

**File:** `apps/api/src/services/meetingQAService.ts`

Add to the existing `QA_SYSTEM_PROMPT`:

```typescript
const QA_SYSTEM_PROMPT = `You are an AI assistant helping users understand and get information from their meeting recordings.

[...existing prompt...]

## File Generation Guidelines

You can offer to generate downloadable files when appropriate. Include a file offer when:

OFFER a file when:
- User explicitly asks to "create", "generate", "export", "make", "prepare", or "download" a document
- User asks for something "to share", "to send", or "for my manager/team"
- Your response contains a structured list (action items, decisions, key points) with 3+ items
- User asks for a "summary", "report", "checklist", or "notes"
- Response would be useful as a standalone document

DO NOT offer a file when:
- Simple factual question ("Who said X?", "When was Y mentioned?")
- Clarification or explanation requests
- Yes/no questions
- Short conversational responses
- User is asking follow-up questions in a back-and-forth

When offering a file, naturally mention it at the end of your response like:
"Would you like this as a downloadable document?" or
"I can generate this as a PDF if you'd like to share it."

For structured output, respond with your answer AND include metadata for the file offer in the following JSON format at the very end of your response, on its own line:

:::FILE_OFFER:::{"shouldOffer":true,"formats":["pdf","docx"],"suggestedTitle":"Meeting Action Items","description":"7 action items with assignees and due dates","contentType":"action_items"}:::END_FILE_OFFER:::

Only include this metadata line when offering a file. The formats should match the content:
- Lists/checklists: ["pdf", "md"]  
- Formal summaries: ["pdf", "docx"]
- Data/tables: ["csv", "pdf"]
- General content: ["pdf", "docx", "md"]
`;
```

---

### 3. Parse File Offer from AI Response

**File:** `apps/api/src/services/meetingQAService.ts`

```typescript
interface ParsedResponse {
  answer: string;
  fileOffer?: QAResponse['fileOffer'];
}

function parseAIResponse(rawResponse: string): ParsedResponse {
  const fileOfferMatch = rawResponse.match(
    /:::FILE_OFFER:::(\{.*?\}):::END_FILE_OFFER:::/s
  );
  
  if (!fileOfferMatch) {
    return { answer: rawResponse.trim() };
  }
  
  // Extract and remove the metadata from visible response
  const answer = rawResponse
    .replace(/:::FILE_OFFER:::.*?:::END_FILE_OFFER:::/s, '')
    .trim();
  
  try {
    const fileOffer = JSON.parse(fileOfferMatch[1]);
    return { answer, fileOffer };
  } catch (e) {
    logger.warn({ raw: fileOfferMatch[1] }, 'Failed to parse file offer metadata');
    return { answer };
  }
}

// Update the ask() method to use this:
async ask(meetingId: string, question: string, conversationId?: string): Promise<QAResponse> {
  // ... existing code to call AI ...
  
  const rawResponse = aiMessage.content;
  const { answer, fileOffer } = parseAIResponse(rawResponse);
  
  return {
    answer,
    sources,
    tokensUsed,
    modelUsed,
    latencyMs,
    fileOffer, // NEW
  };
}
```

---

### 4. Create File Generation Endpoint

**File:** `apps/api/src/routes/documents.ts`

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { documentGeneratorService } from '../services/documentGeneratorService';

export const documentsRouter = Router();

const generateDocumentSchema = z.object({
  content: z.string().min(1).max(50000),
  format: z.enum(['pdf', 'docx', 'md', 'csv']),
  title: z.string().min(1).max(200),
  meetingId: z.string().uuid().optional(),
  contentType: z.enum(['summary', 'action_items', 'decisions', 'transcript_excerpt', 'custom']).optional(),
});

// POST /api/v1/documents/generate
documentsRouter.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const { userId, organizationId } = req.auth!;
    
    const parsed = generateDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error });
    }
    
    const { content, format, title, meetingId, contentType } = parsed.data;
    
    // Generate the document
    const result = await documentGeneratorService.generate({
      content,
      format,
      title,
      meetingId,
      contentType,
      userId,
      organizationId,
    });
    
    res.json({
      success: true,
      data: {
        downloadUrl: result.downloadUrl,
        fileName: result.fileName,
        fileSize: result.fileSize,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});
```

---

### 5. Create Document Generator Service

**File:** `apps/api/src/services/documentGeneratorService.ts`

```typescript
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { storageService } from './storageService';
import { prisma } from '@zigznote/database';

interface GenerateOptions {
  content: string;
  format: 'pdf' | 'docx' | 'md' | 'csv';
  title: string;
  meetingId?: string;
  contentType?: string;
  userId: string;
  organizationId: string;
}

interface GenerateResult {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  expiresAt: Date;
}

class DocumentGeneratorService {
  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const { content, format, title, meetingId, userId } = options;
    
    // Sanitize title for filename
    const safeTitle = title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);
    
    const timestamp = Date.now();
    const fileName = `${safeTitle}_${timestamp}.${format}`;
    
    let buffer: Buffer;
    let mimeType: string;
    
    switch (format) {
      case 'pdf':
        buffer = await this.generatePDF(content, title);
        mimeType = 'application/pdf';
        break;
      case 'docx':
        buffer = await this.generateDOCX(content, title);
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case 'md':
        buffer = this.generateMarkdown(content, title);
        mimeType = 'text/markdown';
        break;
      case 'csv':
        buffer = this.generateCSV(content);
        mimeType = 'text/csv';
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    // Upload to storage
    const storagePath = `generated-docs/${userId}/${fileName}`;
    await storageService.uploadFile(storagePath, buffer, mimeType);
    
    // Generate signed URL (expires in 1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const downloadUrl = await storageService.getSignedUrl(storagePath, expiresAt);
    
    // Log generation for analytics (optional)
    if (meetingId) {
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          metadata: {
            // Append to existing metadata
            lastDocumentGenerated: {
              format,
              title,
              generatedAt: new Date().toISOString(),
            },
          },
        },
      });
    }
    
    return {
      downloadUrl,
      fileName,
      fileSize: buffer.length,
      expiresAt,
    };
  }
  
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
        } else if (line.startsWith('- ') || line.startsWith('• ')) {
          doc.text(`  •  ${line.slice(2)}`);
        } else if (line.match(/^\d+\./)) {
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
  
  private async generateDOCX(content: string, title: string): Promise<Buffer> {
    const children: any[] = [];
    
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
      } else if (line.trim() !== '') {
        children.push(new Paragraph({ text: line }));
      }
    }
    
    const doc = new Document({
      sections: [{ children }],
    });
    
    return Packer.toBuffer(doc);
  }
  
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
  
  private generateCSV(content: string): Buffer {
    // Parse content assuming it's a list format
    // Each line becomes a row, handle common patterns
    const lines = content.split('\n').filter(l => l.trim());
    
    let csv = '';
    
    // Detect if it's action items format
    if (content.includes('Due:') || content.includes('Assignee:')) {
      csv = 'Item,Assignee,Due Date,Status\n';
      for (const line of lines) {
        if (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./)) {
          const text = line.replace(/^[-•\d.]\s*/, '');
          const assigneeMatch = text.match(/\(([^)]+)\)/);
          const dueMatch = text.match(/Due[:\s]+([^,\n]+)/i);
          
          const item = text.replace(/\([^)]+\)/, '').replace(/Due[:\s]+[^,\n]+/i, '').trim();
          const assignee = assigneeMatch?.[1] || '';
          const due = dueMatch?.[1]?.trim() || '';
          
          csv += `"${item}","${assignee}","${due}","Pending"\n`;
        }
      }
    } else {
      // Generic list to CSV
      csv = 'Item\n';
      for (const line of lines) {
        const cleanLine = line.replace(/^[-•\d.]\s*/, '').trim();
        if (cleanLine) {
          csv += `"${cleanLine}"\n`;
        }
      }
    }
    
    return Buffer.from(csv, 'utf-8');
  }
}

export const documentGeneratorService = new DocumentGeneratorService();
```

---

### 6. Update Frontend Chat Component

**File:** `apps/web/components/meetings/MeetingChat.tsx`

Add to the Message interface:
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{...}>;
  createdAt: string;
  
  // NEW
  fileOffer?: {
    shouldOffer: true;
    formats: ('pdf' | 'docx' | 'md' | 'csv')[];
    suggestedTitle: string;
    description: string;
    contentType: string;
  };
}
```

Add file generation mutation:
```typescript
const generateDocMutation = useMutation({
  mutationFn: async ({ 
    content, 
    format, 
    title 
  }: { 
    content: string; 
    format: string; 
    title: string;
  }) => {
    const response = await fetch('/api/v1/documents/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        format,
        title,
        meetingId,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to generate document');
    return response.json();
  },
  onSuccess: (data) => {
    // Trigger download
    const link = document.createElement('a');
    link.href = data.data.downloadUrl;
    link.download = data.data.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
});
```

Add FileOfferCard component:
```typescript
function FileOfferCard({ 
  message,
  onGenerate,
  isGenerating,
}: { 
  message: Message;
  onGenerate: (format: string) => void;
  isGenerating: boolean;
}) {
  if (!message.fileOffer?.shouldOffer) return null;
  
  const { formats, description } = message.fileOffer;
  
  const formatLabels: Record<string, { icon: string; label: string }> = {
    pdf: { icon: '📄', label: 'PDF' },
    docx: { icon: '📝', label: 'Word' },
    md: { icon: '📋', label: 'Markdown' },
    csv: { icon: '📊', label: 'CSV' },
  };
  
  return (
    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
        📎 {description}
      </p>
      <div className="flex flex-wrap gap-2">
        {formats.map((format) => (
          <button
            key={format}
            onClick={() => onGenerate(format)}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm 
                       bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 
                       rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {isGenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <span>{formatLabels[format]?.icon || '📄'}</span>
            )}
            <span>Download {formatLabels[format]?.label || format.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

Update message rendering in the main component:
```tsx
{/* In the messages map */}
{message.role === 'assistant' && (
  <>
    {/* Existing message content rendering */}
    <div className="prose prose-sm dark:prose-invert">
      {message.content}
    </div>
    
    {/* Existing sources rendering */}
    {message.sources && ...}
    
    {/* NEW: File offer card */}
    <FileOfferCard
      message={message}
      onGenerate={(format) => {
        generateDocMutation.mutate({
          content: message.content,
          format,
          title: message.fileOffer?.suggestedTitle || 'Meeting Document',
        });
      }}
      isGenerating={generateDocMutation.isPending}
    />
  </>
)}
```

---

### 7. Register New Route

**File:** `apps/api/src/app.ts`

```typescript
import { documentsRouter } from './routes/documents';

// Add with other routes
app.use('/api/v1/documents', documentsRouter);
```

---

## Testing

### Test Cases

```typescript
describe('AI File Offer', () => {
  it('should offer file when user explicitly requests', async () => {
    const response = await askQuestion(meetingId, 'Create a PDF summary for my team');
    expect(response.fileOffer).toBeDefined();
    expect(response.fileOffer.formats).toContain('pdf');
  });
  
  it('should offer file for action items list', async () => {
    const response = await askQuestion(meetingId, 'What are all the action items?');
    expect(response.fileOffer?.contentType).toBe('action_items');
  });
  
  it('should NOT offer file for simple questions', async () => {
    const response = await askQuestion(meetingId, 'Who mentioned the budget?');
    expect(response.fileOffer).toBeUndefined();
  });
  
  it('should NOT offer file for yes/no questions', async () => {
    const response = await askQuestion(meetingId, 'Did they discuss pricing?');
    expect(response.fileOffer).toBeUndefined();
  });
});

describe('Document Generation', () => {
  it('should generate PDF successfully', async () => {
    const response = await fetch('/api/v1/documents/generate', {
      method: 'POST',
      body: JSON.stringify({
        content: '# Summary\n\n- Item 1\n- Item 2',
        format: 'pdf',
        title: 'Test Summary',
      }),
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.downloadUrl).toBeDefined();
    expect(data.data.fileName).toContain('.pdf');
  });
  
  it('should generate DOCX successfully');
  it('should generate Markdown successfully');
  it('should generate CSV from action items');
  it('should handle empty content gracefully');
  it('should sanitize filename properly');
});
```

---

## Files Summary

### New Files
- `apps/api/src/routes/documents.ts`
- `apps/api/src/services/documentGeneratorService.ts`

### Modified Files
- `apps/api/src/services/meetingQAService.ts` (add prompt, parse file offer)
- `apps/api/src/app.ts` (register route)
- `apps/web/components/meetings/MeetingChat.tsx` (add FileOfferCard)

---

## Rollout Plan

1. Deploy backend changes (new endpoint + updated AI prompt)
2. Deploy frontend changes (FileOfferCard component)
3. Monitor AI behavior - tune prompt if offers too often/rarely
4. Gather user feedback

---

## Success Metrics

- Users successfully download files from chat
- No increase in chat errors
- AI offers files in ~20-30% of responses (appropriate rate)
- File generation success rate > 99%
