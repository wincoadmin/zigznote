# Phase 6.6: Transcript Polish

**Goal:** Close the quality gap with competitors like Circleback by adding post-processing to transform raw transcripts into polished, readable text.

**Model:** Default

---

## Pre-Phase Checklist

- [ ] Read PHASE_6_5_COMPLETE.md (or PHASE_6_COMPLETE.md if 6.5 was skipped)
- [ ] Read project_docs/GOVERNANCE.md
- [ ] Verify current tests pass: `pnpm test`

---

## Mandatory Updates (CRITICAL)

After completing this phase, you MUST:
1. Create PHASE_6_6_COMPLETE.md with summary and key decisions
2. **Update project_docs/PHASES.md**:
   - Add Phase 6.6 section between Phase 6.5 (or 6) and Phase 7
   - Add row to Summary Table: `| 6.6 | Transcript Polish | ✅ | 20-30 min |`
   - Update Total Estimated Time
   - Add entry to Change Log
3. Run all tests and record coverage

---

=== EXECUTION RULES ===
1. DO NOT STOP until all tasks are complete and verified
2. If you encounter an error, fix it and continue
3. Run all commands and verify their output
4. Create all files with proper content (no placeholders)
5. Run tests and ensure they pass before completing
6. Follow the engineering principles in GOVERNANCE.md
7. Domain cohesion > line counts (large files OK if single responsibility)

=== TASK LIST (Execute All) ===

**6.6.1 Database Schema Updates**

Add to packages/database/prisma/schema.prisma:

```prisma
// ============================================
// Speaker Recognition
// ============================================

// Learned speaker identities for an organization
model SpeakerAlias {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  
  // Voice identification (from Deepgram diarization)
  speakerLabel   String   @map("speaker_label") // "Speaker 0", "Speaker 1", etc.
  
  // User-provided identity
  displayName    String   @map("display_name")  // "John Smith"
  email          String?                         // Optional: link to known user
  
  // Learning context
  meetingId      String?  @map("meeting_id")    // First meeting where identified
  confidence     Float    @default(1.0)         // How confident we are in this mapping
  
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  meeting        Meeting?     @relation(fields: [meetingId], references: [id], onDelete: SetNull)

  @@unique([organizationId, speakerLabel])
  @@index([organizationId])
  @@map("speaker_aliases")
}

// Custom vocabulary for improved transcription accuracy
model CustomVocabulary {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  
  term           String   // "zigznote", "Acme Corp", "Kubernetes"
  boost          Float    @default(1.5) // How much to boost this term (1.0-2.0)
  category       String?  // "product", "company", "person", "technical"
  
  createdAt      DateTime @default(now()) @map("created_at")

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, term])
  @@index([organizationId])
  @@map("custom_vocabulary")
}
```

Update Organization model to add relations:
```prisma
model Organization {
  // ... existing fields ...
  speakerAliases    SpeakerAlias[]
  customVocabulary  CustomVocabulary[]
}
```

Update Meeting model to add relation:
```prisma
model Meeting {
  // ... existing fields ...
  speakerAliases    SpeakerAlias[]
}
```

Run migration:
```bash
pnpm db:migrate --name add_transcript_polish
```

**6.6.2 Transcript Post-Processor Service**

Create services/transcription/src/postProcessor.ts:

```typescript
/**
 * @ownership
 * @domain Transcript Post-Processing
 * @description Transforms raw transcripts into polished, readable text
 * @single-responsibility YES — all transcript cleanup operations
 */

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface ProcessedSegment extends TranscriptSegment {
  cleanedText: string;
  displaySpeaker: string;
  lowConfidenceRanges: Array<{ start: number; end: number }>;
}

export interface PostProcessorOptions {
  removeFillers?: boolean;
  cleanSentenceBoundaries?: boolean;
  highlightLowConfidence?: boolean;
  confidenceThreshold?: number;
  speakerAliases?: Map<string, string>;
}

const DEFAULT_OPTIONS: Required<PostProcessorOptions> = {
  removeFillers: true,
  cleanSentenceBoundaries: true,
  highlightLowConfidence: true,
  confidenceThreshold: 0.7,
  speakerAliases: new Map(),
};

/**
 * Filler words and phrases to remove
 * Organized by category for maintainability
 */
const FILLER_PATTERNS = {
  // Single word fillers
  singleWord: /\b(um|uh|eh|ah|er|mm|hmm|mhm|erm)\b/gi,
  
  // Common verbal tics
  verbalTics: /\b(like|basically|actually|literally|honestly|obviously|clearly|definitely|absolutely|totally|really|very|just|so|well|now|okay|ok|right|yeah|yep|yup|nope|anyway|anyways)\b(?=\s*,?\s*(?:like|basically|actually|literally|honestly|obviously|I|you|we|they|it|the|a|an|this|that))/gi,
  
  // Phrase fillers
  phrases: /\b(you know|I mean|kind of|sort of|type of|in a sense|at the end of the day|to be honest|to be fair|if you will|as it were|if that makes sense|does that make sense)\b/gi,
  
  // Repeated words (stammering)
  repetition: /\b(\w+)\s+\1\b/gi,
  
  // False starts (incomplete thoughts followed by restart)
  falseStarts: /\b(I|we|they|it|the|so|but|and)\s*[-–—]\s*/gi,
};

/**
 * Clean up extra whitespace and punctuation
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ')           // Multiple spaces to single
    .replace(/\s+([.,!?])/g, '$1')  // Remove space before punctuation
    .replace(/([.,!?])\s*([.,!?])/g, '$1') // Remove duplicate punctuation
    .replace(/^\s+|\s+$/g, '')      // Trim
    .replace(/\s*,\s*,/g, ',')      // Remove double commas
    .replace(/,\s*\./g, '.')        // Comma before period
    .trim();
}

/**
 * Remove filler words from text
 */
export function removeFillers(text: string): string {
  let cleaned = text;
  
  // Apply each filler pattern
  for (const pattern of Object.values(FILLER_PATTERNS)) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  
  return normalizeWhitespace(cleaned);
}

/**
 * Fix sentence boundaries
 * - Capitalize after periods
 * - Add periods to sentences that end without punctuation
 * - Fix spacing around punctuation
 */
export function cleanSentenceBoundaries(text: string): string {
  let cleaned = text;
  
  // Capitalize first letter after sentence-ending punctuation
  cleaned = cleaned.replace(/([.!?])\s+([a-z])/g, (_, punct, letter) => 
    `${punct} ${letter.toUpperCase()}`
  );
  
  // Capitalize first letter of text
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  
  // Add period at end if missing punctuation
  if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }
  
  return cleaned;
}

/**
 * Identify low confidence regions for highlighting
 */
export function findLowConfidenceRanges(
  words: Array<{ word: string; confidence: number }>,
  threshold: number
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let currentRange: { start: number; end: number } | null = null;
  let charPosition = 0;
  
  for (const wordObj of words) {
    const wordStart = charPosition;
    const wordEnd = charPosition + wordObj.word.length;
    
    if (wordObj.confidence < threshold) {
      if (currentRange && currentRange.end === wordStart - 1) {
        // Extend current range
        currentRange.end = wordEnd;
      } else {
        // Start new range
        if (currentRange) ranges.push(currentRange);
        currentRange = { start: wordStart, end: wordEnd };
      }
    } else {
      if (currentRange) {
        ranges.push(currentRange);
        currentRange = null;
      }
    }
    
    charPosition = wordEnd + 1; // +1 for space
  }
  
  if (currentRange) ranges.push(currentRange);
  return ranges;
}

/**
 * Apply speaker aliases to get display names
 */
export function resolveSpeaker(
  speakerLabel: string,
  aliases: Map<string, string>
): string {
  return aliases.get(speakerLabel) || speakerLabel;
}

/**
 * Main post-processor class
 */
export class TranscriptPostProcessor {
  private options: Required<PostProcessorOptions>;
  
  constructor(options: PostProcessorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Process a single segment
   */
  processSegment(segment: TranscriptSegment): ProcessedSegment {
    let cleanedText = segment.text;
    
    // Remove fillers
    if (this.options.removeFillers) {
      cleanedText = removeFillers(cleanedText);
    }
    
    // Clean sentence boundaries
    if (this.options.cleanSentenceBoundaries) {
      cleanedText = cleanSentenceBoundaries(cleanedText);
    }
    
    // Find low confidence ranges
    const lowConfidenceRanges = this.options.highlightLowConfidence && segment.words
      ? findLowConfidenceRanges(segment.words, this.options.confidenceThreshold)
      : [];
    
    // Resolve speaker name
    const displaySpeaker = resolveSpeaker(
      segment.speaker,
      this.options.speakerAliases
    );
    
    return {
      ...segment,
      cleanedText,
      displaySpeaker,
      lowConfidenceRanges,
    };
  }
  
  /**
   * Process entire transcript
   */
  processTranscript(segments: TranscriptSegment[]): ProcessedSegment[] {
    return segments.map(segment => this.processSegment(segment));
  }
  
  /**
   * Get full cleaned text from processed segments
   */
  getFullText(processedSegments: ProcessedSegment[]): string {
    return processedSegments
      .map(s => `${s.displaySpeaker}: ${s.cleanedText}`)
      .join('\n\n');
  }
  
  /**
   * Update options (e.g., after loading speaker aliases)
   */
  updateOptions(options: Partial<PostProcessorOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

export const transcriptPostProcessor = new TranscriptPostProcessor();
```

**6.6.3 Speaker Alias Repository**

Create packages/database/src/repositories/speakerAliasRepository.ts:

```typescript
/**
 * @ownership
 * @domain Speaker Alias Data Access
 * @description Database operations for speaker identity management
 * @single-responsibility YES — all SpeakerAlias operations
 */

import type { SpeakerAlias } from '@prisma/client';
import { prisma } from '../client';

export interface CreateSpeakerAliasInput {
  organizationId: string;
  speakerLabel: string;
  displayName: string;
  email?: string;
  meetingId?: string;
  confidence?: number;
}

export class SpeakerAliasRepository {
  async create(data: CreateSpeakerAliasInput): Promise<SpeakerAlias> {
    return prisma.speakerAlias.create({ data });
  }

  async upsert(data: CreateSpeakerAliasInput): Promise<SpeakerAlias> {
    return prisma.speakerAlias.upsert({
      where: {
        organizationId_speakerLabel: {
          organizationId: data.organizationId,
          speakerLabel: data.speakerLabel,
        },
      },
      update: {
        displayName: data.displayName,
        email: data.email,
        confidence: data.confidence,
      },
      create: data,
    });
  }

  async findByOrganization(organizationId: string): Promise<SpeakerAlias[]> {
    return prisma.speakerAlias.findMany({
      where: { organizationId },
      orderBy: { displayName: 'asc' },
    });
  }

  async findByOrganizationAsMap(organizationId: string): Promise<Map<string, string>> {
    const aliases = await this.findByOrganization(organizationId);
    return new Map(aliases.map(a => [a.speakerLabel, a.displayName]));
  }

  async delete(organizationId: string, speakerLabel: string): Promise<void> {
    await prisma.speakerAlias.delete({
      where: {
        organizationId_speakerLabel: {
          organizationId,
          speakerLabel,
        },
      },
    });
  }
}

export const speakerAliasRepository = new SpeakerAliasRepository();
```

**6.6.4 Custom Vocabulary Repository**

Create packages/database/src/repositories/customVocabularyRepository.ts:

```typescript
/**
 * @ownership
 * @domain Custom Vocabulary Data Access
 * @description Database operations for custom transcription vocabulary
 * @single-responsibility YES — all CustomVocabulary operations
 */

import type { CustomVocabulary } from '@prisma/client';
import { prisma } from '../client';

export interface CreateVocabularyInput {
  organizationId: string;
  term: string;
  boost?: number;
  category?: string;
}

export class CustomVocabularyRepository {
  async create(data: CreateVocabularyInput): Promise<CustomVocabulary> {
    return prisma.customVocabulary.create({ data });
  }

  async createMany(organizationId: string, terms: string[]): Promise<number> {
    const result = await prisma.customVocabulary.createMany({
      data: terms.map(term => ({ organizationId, term })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async findByOrganization(organizationId: string): Promise<CustomVocabulary[]> {
    return prisma.customVocabulary.findMany({
      where: { organizationId },
      orderBy: { term: 'asc' },
    });
  }

  async getKeywordsForDeepgram(organizationId: string): Promise<string[]> {
    const vocab = await this.findByOrganization(organizationId);
    // Deepgram format: "term:boost" or just "term"
    return vocab.map(v => v.boost !== 1.5 ? `${v.term}:${v.boost}` : v.term);
  }

  async delete(organizationId: string, term: string): Promise<void> {
    await prisma.customVocabulary.delete({
      where: {
        organizationId_term: { organizationId, term },
      },
    });
  }

  async deleteAll(organizationId: string): Promise<number> {
    const result = await prisma.customVocabulary.deleteMany({
      where: { organizationId },
    });
    return result.count;
  }
}

export const customVocabularyRepository = new CustomVocabularyRepository();
```

Update packages/database/src/repositories/index.ts to export both:
```typescript
export { SpeakerAliasRepository, speakerAliasRepository } from './speakerAliasRepository';
export { CustomVocabularyRepository, customVocabularyRepository } from './customVocabularyRepository';
```

**6.6.5 Update Transcription Processor**

Update services/transcription/src/processor.ts to use post-processing:

Add import at top:
```typescript
import { TranscriptPostProcessor } from './postProcessor';
import { speakerAliasRepository, customVocabularyRepository } from '@zigznote/database';
```

Update the processTranscription function to apply post-processing after transcription:
```typescript
// After getting raw transcript from Deepgram, add:

// Load speaker aliases for this organization
const speakerAliases = await speakerAliasRepository.findByOrganizationAsMap(organizationId);

// Create post-processor with org-specific settings
const postProcessor = new TranscriptPostProcessor({
  removeFillers: true,
  cleanSentenceBoundaries: true,
  highlightLowConfidence: true,
  confidenceThreshold: 0.7,
  speakerAliases,
});

// Process segments
const processedSegments = postProcessor.processTranscript(rawSegments);

// Get cleaned full text
const cleanedFullText = postProcessor.getFullText(processedSegments);
```

**6.6.6 Update Deepgram Service for Custom Vocabulary**

Update services/transcription/src/deepgramService.ts:

Add to the transcribe method options:
```typescript
async transcribe(
  audioUrl: string,
  options: {
    organizationId?: string;
    // ... existing options
  } = {}
): Promise<TranscriptionResult> {
  // Load custom vocabulary if org provided
  let keywords: string[] = [];
  if (options.organizationId) {
    keywords = await customVocabularyRepository.getKeywordsForDeepgram(options.organizationId);
  }

  const response = await this.client.listen.prerecorded.transcribeUrl(
    { url: audioUrl },
    {
      model: 'nova-2',
      smart_format: true,
      diarize: true,
      punctuate: true,
      paragraphs: true,
      keywords: keywords.length > 0 ? keywords : undefined,
      // ... other options
    }
  );
  // ... rest of method
}
```

**6.6.7 API Routes for Speaker Management**

Create apps/api/src/routes/speakers.ts:

```typescript
/**
 * Speaker alias management routes
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { z } from 'zod';
import { speakerAliasRepository } from '@zigznote/database';
import { requireAuth, asyncHandler, validateRequest, type AuthenticatedRequest } from '../middleware';

export const speakersRouter: IRouter = Router();

speakersRouter.use(requireAuth);

const upsertAliasSchema = z.object({
  body: z.object({
    speakerLabel: z.string().min(1),
    displayName: z.string().min(1).max(100),
    email: z.string().email().optional(),
  }),
});

/**
 * GET /api/v1/speakers
 * List all speaker aliases for the organization
 */
speakersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const aliases = await speakerAliasRepository.findByOrganization(
      authReq.auth!.organizationId
    );
    res.json({ success: true, data: aliases });
  })
);

/**
 * PUT /api/v1/speakers
 * Create or update a speaker alias
 */
speakersRouter.put(
  '/',
  validateRequest(upsertAliasSchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const alias = await speakerAliasRepository.upsert({
      organizationId: authReq.auth!.organizationId,
      speakerLabel: req.body.speakerLabel,
      displayName: req.body.displayName,
      email: req.body.email,
    });
    res.json({ success: true, data: alias });
  })
);

/**
 * DELETE /api/v1/speakers/:speakerLabel
 * Remove a speaker alias
 */
speakersRouter.delete(
  '/:speakerLabel',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    await speakerAliasRepository.delete(
      authReq.auth!.organizationId,
      req.params.speakerLabel
    );
    res.json({ success: true, message: 'Speaker alias removed' });
  })
);
```

**6.6.8 API Routes for Vocabulary Management**

Create apps/api/src/routes/vocabulary.ts:

```typescript
/**
 * Custom vocabulary management routes
 */

import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { z } from 'zod';
import { customVocabularyRepository } from '@zigznote/database';
import { requireAuth, asyncHandler, validateRequest, type AuthenticatedRequest } from '../middleware';

export const vocabularyRouter: IRouter = Router();

vocabularyRouter.use(requireAuth);

const addTermSchema = z.object({
  body: z.object({
    term: z.string().min(1).max(100),
    boost: z.number().min(1).max(2).default(1.5),
    category: z.string().max(50).optional(),
  }),
});

const addBulkSchema = z.object({
  body: z.object({
    terms: z.array(z.string().min(1).max(100)).min(1).max(100),
  }),
});

/**
 * GET /api/v1/vocabulary
 * List all custom vocabulary for the organization
 */
vocabularyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const vocab = await customVocabularyRepository.findByOrganization(
      authReq.auth!.organizationId
    );
    res.json({ success: true, data: vocab });
  })
);

/**
 * POST /api/v1/vocabulary
 * Add a custom term
 */
vocabularyRouter.post(
  '/',
  validateRequest(addTermSchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const term = await customVocabularyRepository.create({
      organizationId: authReq.auth!.organizationId,
      term: req.body.term,
      boost: req.body.boost,
      category: req.body.category,
    });
    res.status(201).json({ success: true, data: term });
  })
);

/**
 * POST /api/v1/vocabulary/bulk
 * Add multiple terms at once
 */
vocabularyRouter.post(
  '/bulk',
  validateRequest(addBulkSchema),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const count = await customVocabularyRepository.createMany(
      authReq.auth!.organizationId,
      req.body.terms
    );
    res.status(201).json({ 
      success: true, 
      data: { added: count },
      message: `Added ${count} terms to vocabulary`,
    });
  })
);

/**
 * DELETE /api/v1/vocabulary/:term
 * Remove a custom term
 */
vocabularyRouter.delete(
  '/:term',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    await customVocabularyRepository.delete(
      authReq.auth!.organizationId,
      decodeURIComponent(req.params.term)
    );
    res.json({ success: true, message: 'Term removed' });
  })
);
```

Register both routers in apps/api/src/routes/api.ts:
```typescript
import { speakersRouter } from './speakers';
import { vocabularyRouter } from './vocabulary';

apiRouter.use('/v1/speakers', speakersRouter);
apiRouter.use('/v1/vocabulary', vocabularyRouter);
```

**6.6.9 Post-Processor Tests**

Create services/transcription/tests/postProcessor.test.ts:

```typescript
import {
  removeFillers,
  cleanSentenceBoundaries,
  findLowConfidenceRanges,
  TranscriptPostProcessor,
} from '../src/postProcessor';

describe('removeFillers', () => {
  it('should remove common filler words', () => {
    expect(removeFillers('Um, I think, uh, we should do this'))
      .toBe('I think, we should do this');
  });

  it('should remove verbal tics when followed by common words', () => {
    expect(removeFillers('So basically like I was saying'))
      .toBe('I was saying');
  });

  it('should remove phrase fillers', () => {
    expect(removeFillers('You know, if that makes sense, we could try'))
      .toBe('we could try');
  });

  it('should handle repeated words (stammering)', () => {
    expect(removeFillers('I I think we we should go'))
      .toBe('I think we should go');
  });

  it('should normalize whitespace after removal', () => {
    expect(removeFillers('So,  um,   like,  yeah'))
      .not.toContain('  ');
  });

  it('should preserve meaningful content', () => {
    const meaningful = 'The quarterly results show a 15% increase in revenue.';
    expect(removeFillers(meaningful)).toBe(meaningful);
  });
});

describe('cleanSentenceBoundaries', () => {
  it('should capitalize first letter', () => {
    expect(cleanSentenceBoundaries('hello world'))
      .toBe('Hello world.');
  });

  it('should capitalize after periods', () => {
    expect(cleanSentenceBoundaries('first sentence. second sentence'))
      .toBe('First sentence. Second sentence.');
  });

  it('should add period at end if missing', () => {
    expect(cleanSentenceBoundaries('This is a sentence'))
      .toBe('This is a sentence.');
  });

  it('should not add period if already has punctuation', () => {
    expect(cleanSentenceBoundaries('Is this a question?'))
      .toBe('Is this a question?');
  });
});

describe('findLowConfidenceRanges', () => {
  it('should identify low confidence words', () => {
    const words = [
      { word: 'Hello', confidence: 0.95 },
      { word: 'world', confidence: 0.5 },
      { word: 'today', confidence: 0.9 },
    ];
    const ranges = findLowConfidenceRanges(words, 0.7);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: 6, end: 11 }); // "world"
  });

  it('should merge adjacent low confidence words', () => {
    const words = [
      { word: 'The', confidence: 0.9 },
      { word: 'unclear', confidence: 0.4 },
      { word: 'mumbling', confidence: 0.3 },
      { word: 'here', confidence: 0.95 },
    ];
    const ranges = findLowConfidenceRanges(words, 0.7);
    expect(ranges).toHaveLength(1);
  });

  it('should return empty array for high confidence transcript', () => {
    const words = [
      { word: 'Clear', confidence: 0.99 },
      { word: 'audio', confidence: 0.98 },
    ];
    expect(findLowConfidenceRanges(words, 0.7)).toHaveLength(0);
  });
});

describe('TranscriptPostProcessor', () => {
  it('should process segment with all options', () => {
    const processor = new TranscriptPostProcessor({
      removeFillers: true,
      cleanSentenceBoundaries: true,
      speakerAliases: new Map([['Speaker 0', 'John']]),
    });

    const segment = {
      speaker: 'Speaker 0',
      text: 'um so basically I think we should, you know, proceed',
      startTime: 0,
      endTime: 10,
      confidence: 0.9,
    };

    const processed = processor.processSegment(segment);
    
    expect(processed.displaySpeaker).toBe('John');
    expect(processed.cleanedText).not.toContain('um');
    expect(processed.cleanedText).not.toContain('basically');
    expect(processed.cleanedText).toMatch(/^[A-Z]/); // Capitalized
  });

  it('should process full transcript', () => {
    const processor = new TranscriptPostProcessor();
    const segments = [
      { speaker: 'Speaker 0', text: 'hello', startTime: 0, endTime: 1, confidence: 0.9 },
      { speaker: 'Speaker 1', text: 'hi there', startTime: 1, endTime: 2, confidence: 0.9 },
    ];

    const processed = processor.processTranscript(segments);
    expect(processed).toHaveLength(2);
  });

  it('should generate full text with speaker labels', () => {
    const processor = new TranscriptPostProcessor({
      speakerAliases: new Map([
        ['Speaker 0', 'Alice'],
        ['Speaker 1', 'Bob'],
      ]),
    });

    const segments = [
      { speaker: 'Speaker 0', text: 'hello', startTime: 0, endTime: 1, confidence: 0.9 },
      { speaker: 'Speaker 1', text: 'hi', startTime: 1, endTime: 2, confidence: 0.9 },
    ];

    const processed = processor.processTranscript(segments);
    const fullText = processor.getFullText(processed);

    expect(fullText).toContain('Alice:');
    expect(fullText).toContain('Bob:');
  });
});
```

---

=== VERIFICATION CHECKLIST ===

Before completing, verify:
- [ ] `pnpm db:migrate` runs successfully
- [ ] `pnpm build` succeeds for all packages
- [ ] `pnpm test` passes all tests including new post-processor tests
- [ ] Filler removal works correctly
- [ ] Speaker aliases can be created and retrieved
- [ ] Custom vocabulary can be managed
- [ ] Post-processor integrates with transcription service
- [ ] API routes work for speakers and vocabulary
- [ ] **PHASES.md updated with Phase 6.6 section and summary table row**
- [ ] PHASE_6_6_COMPLETE.md created

---

=== UPDATE PHASES.md ===

Add this section to project_docs/PHASES.md between Phase 6.5 (or 6) and Phase 7:

```markdown
## Phase 6.6: Transcript Polish

**Status:** ✅ Complete
**Estimated Time:** 20-30 minutes

### Planned Deliverables
- Filler word removal (um, uh, like, basically, etc.)
- Speaker name learning and aliases
- Custom vocabulary for improved accuracy
- Sentence boundary cleanup
- Low confidence highlighting
- API routes for speaker/vocabulary management

### Key Features
| Feature | Purpose |
|---------|---------|
| Filler Removal | Clean up verbal tics and hesitations |
| Speaker Aliases | Map "Speaker 0" → "John Smith" |
| Custom Vocabulary | Boost accuracy for company-specific terms |
| Confidence Highlighting | Flag uncertain transcription sections |

### Key Decisions Made
_Fill after completion_

### Actual Changes from Plan
_Fill after completion_

### Handoff File
`PHASE_6_6_COMPLETE.md`
```

Add row to Summary Table:
```
| 6.6 | Transcript Polish | ✅ | 20-30 min |
```

Update Total Estimated Time.

Add to Change Log:
```
| 2026-01-XX | Phase 6.6 | Transcript post-processing for polish (filler removal, speaker aliases, custom vocab) |
```

---

=== GIT COMMIT ===

```bash
git add .
git commit -m "feat: add transcript post-processing for polish

- Filler word removal (um, uh, like, basically, you know, etc.)
- Speaker alias system (map Speaker 0 → John Smith)
- Custom vocabulary for improved Deepgram accuracy
- Sentence boundary cleanup and capitalization
- Low confidence region detection
- API routes for speaker and vocabulary management
- Post-processor integrated with transcription service
- Comprehensive tests for all post-processing functions"
```

---

## Summary

After completing Phase 6.6:

| Feature | Status |
|---------|--------|
| Filler word removal | ✅ |
| Verbal tic cleanup | ✅ |
| Speaker aliases | ✅ |
| Custom vocabulary | ✅ |
| Sentence cleanup | ✅ |
| Confidence highlighting | ✅ |
| API management | ✅ |

This closes the transcript polish gap with competitors like Circleback.

Ready for Phase 6.5 (if not done) or Phase 7: Admin Panel.
