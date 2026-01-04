# zigznote Code Patterns & Checklists

**Status:** Reference Guide
**Purpose:** Naming conventions, code templates, and verification checklists

> This file provides helpful patterns and templates. It works alongside GOVERNANCE.md.
> When patterns conflict with GOVERNANCE.md, governance wins.

---

## 1. File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| React Components | PascalCase.tsx | `MeetingCard.tsx` |
| React Pages | page.tsx (Next.js) | `app/meetings/page.tsx` |
| Hooks | camelCase with "use" prefix | `useMeetings.ts` |
| Services | kebab-case.service.ts | `meeting.service.ts` |
| Controllers | kebab-case.controller.ts | `meeting.controller.ts` |
| Repositories | kebab-case.repository.ts | `meeting.repository.ts` |
| Middleware | kebab-case.ts | `rate-limit.ts` |
| Utilities | kebab-case.ts | `format-duration.ts` |
| Types | kebab-case.types.ts | `meeting.types.ts` |
| Tests | *.test.ts or *.spec.ts | `meeting.service.test.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_TRANSCRIPT_LENGTH` |

### Directories
- Always kebab-case: `action-items/`, `calendar-sync/`
- Group by feature, not type (prefer `meetings/` over `controllers/`)

---

## 2. File Size Guidance

**Principle: Domain Cohesion > Line Counts**

File size is a **smell, not a rule**. A 1000-line file that handles one domain completely is better than five 200-line files that fragment the same concept.

### The Decision Framework

```
Q: Can I explain this file's purpose in ONE sentence?
   YES → Keep it together (any size)
   NO  → Split by responsibility (not by line count)
```

### File Size Tiers (Guidance, Not Rules)

| Tier | LOC | Guidance |
|------|-----|----------|
| 🟢 **Green** | 0–200 | Typical for most files |
| 🟡 **Yellow** | 200–400 | Fine if single responsibility |
| 🔴 **Red** | 400–600 | Review: one domain? If yes, keep it |
| ⬛ **Black** | >600 | Ask: one sentence description? If yes, keep it |

### Examples

| File | Size | Verdict |
|------|------|---------|
| `meetingRepository.ts` — all meeting data access | 800 LOC | ✅ Keep — one entity |
| `meetings.routes.ts` — all meeting endpoints | 600 LOC | ✅ Keep — one domain |
| `transcriptService.ts` — transcription only | 500 LOC | ✅ Keep — one responsibility |
| `utils.ts` — random helper functions | 300 LOC | 🚨 Split — multiple purposes |
| `apiService.ts` — calls 5 different APIs | 400 LOC | 🚨 Split — multiple services |

### When to Split

- File handles **multiple unrelated domains**
- Different parts change for **different reasons**
- Hard to name because it does **multiple things**
- Tests require mocking **unrelated systems**

### When NOT to Split

- File handles **one entity/domain completely**
- Splitting would require **cross-file imports** to understand one concept
- File can be described: "This handles all X operations"

### Ownership Comment (for files >400 LOC)

Add to top of file:

```typescript
/**
 * @ownership
 * @domain Meeting Data Access
 * @description Handles all database operations for meetings
 * @single-responsibility YES — one entity, complete coverage
 * @last-reviewed 2025-01-15
 */
```

---

## 3. Import Organization

Always organize imports in this order:

```typescript
// 1. Node built-ins
import path from 'path';
import { readFile } from 'fs/promises';

// 2. External packages
import { z } from 'zod';
import { eq } from 'drizzle-orm';

// 3. Internal packages (monorepo)
import { prisma } from '@zigznote/database';
import { AppError } from '@zigznote/shared/errors';

// 4. Internal relative imports
import { meetingService } from '../services/meeting.service';
import { formatDuration } from '../utils/format-duration';

// 5. Type imports (always last)
import type { Meeting, User } from '@zigznote/shared/types';
import type { Request, Response } from 'express';
```

---

## 4. Code Templates

### 4.1 Controller Template (Express)

Controllers handle HTTP, call services, return responses. **No business logic.**

```typescript
// apps/api/src/controllers/meeting.controller.ts
import { Request, Response, NextFunction } from 'express';
import { meetingService } from '../services/meeting.service';
import { createMeetingSchema, getMeetingsSchema } from '../validators/meeting.validator';
import { validateRequest } from '../middleware/validate-request';

export const meetingController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { query } = validateRequest(req, getMeetingsSchema);
      const meetings = await meetingService.getAll(req.user!.id, query);
      
      res.json({ success: true, data: meetings });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const meeting = await meetingService.getById(req.params.id, req.user!.id);
      
      res.json({ success: true, data: meeting });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { body } = validateRequest(req, createMeetingSchema);
      const meeting = await meetingService.create(body, req.user!.id);
      
      res.status(201).json({ success: true, data: meeting });
    } catch (error) {
      next(error);
    }
  },
};
```

### 4.2 Service Template

Services contain business logic, access control, and orchestration.

```typescript
// apps/api/src/services/meeting.service.ts
import { meetingRepository } from '@zigznote/database';
import { NotFoundError, AuthorizationError } from '@zigznote/shared/errors';
import { logger } from '@zigznote/shared/logger';
import type { CreateMeetingInput, MeetingQuery } from '../types/meeting.types';

class MeetingService {
  async getAll(userId: string, query: MeetingQuery) {
    logger.debug('Fetching meetings', { userId, query });
    return meetingRepository.findByUser(userId, query);
  }

  async getById(id: string, userId: string) {
    const meeting = await meetingRepository.findById(id);
    
    if (!meeting) {
      throw new NotFoundError('Meeting', id);
    }
    
    if (!this.canAccess(meeting, userId)) {
      throw new AuthorizationError('You do not have access to this meeting');
    }
    
    return meeting;
  }

  async create(data: CreateMeetingInput, userId: string) {
    logger.info('Creating meeting', { userId, title: data.title });
    
    return meetingRepository.create({
      ...data,
      createdById: userId,
      status: 'scheduled',
    });
  }

  private canAccess(meeting: Meeting, userId: string): boolean {
    return meeting.createdById === userId || 
           meeting.participants.some(p => p.userId === userId);
  }
}

export const meetingService = new MeetingService();
```

### 4.3 Repository Template

Repositories handle data access only. **No business logic.**

```typescript
// packages/database/src/repositories/meeting.repository.ts
import { prisma } from '../client';
import type { Prisma } from '@prisma/client';

class MeetingRepository {
  async findById(id: string) {
    return prisma.meeting.findUnique({
      where: { id },
      include: {
        participants: true,
        transcript: true,
        summary: true,
      },
    });
  }

  async findByUser(userId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return prisma.meeting.findMany({
      where: {
        OR: [
          { createdById: userId },
          { participants: { some: { userId } } },
        ],
        ...(options?.status && { status: options.status }),
      },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
      orderBy: { startTime: 'desc' },
    });
  }

  async create(data: Prisma.MeetingCreateInput) {
    return prisma.meeting.create({ data });
  }

  async update(id: string, data: Prisma.MeetingUpdateInput) {
    return prisma.meeting.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.meeting.delete({ where: { id } });
  }
}

export const meetingRepository = new MeetingRepository();
```

### 4.4 React Component Template

```tsx
// apps/web/components/meetings/MeetingCard.tsx
'use client';

import { memo } from 'react';
import { format } from 'date-fns';
import { Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Meeting } from '@zigznote/shared/types';

interface MeetingCardProps {
  meeting: Meeting;
  onClick?: () => void;
  className?: string;
}

export const MeetingCard = memo(function MeetingCard({
  meeting,
  onClick,
  className,
}: MeetingCardProps) {
  const statusColors = {
    scheduled: 'bg-neutral-100 text-neutral-700',
    recording: 'bg-red-100 text-red-700',
    processing: 'bg-amber-100 text-amber-700',
    completed: 'bg-primary-100 text-primary-700',
  };

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-neutral-800">{meeting.title}</h3>
          <p className="text-sm text-neutral-500 mt-1">
            {format(new Date(meeting.startTime), 'MMM d, yyyy · h:mm a')}
          </p>
        </div>
        <Badge className={statusColors[meeting.status]}>
          {meeting.status}
        </Badge>
      </div>

      <div className="flex items-center gap-4 mt-3 text-sm text-neutral-500">
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {Math.round(meeting.durationSeconds / 60)} min
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-4 w-4" />
          {meeting.participants.length}
        </span>
      </div>
    </Card>
  );
});
```

### 4.5 Custom Hook Template

```typescript
// apps/web/hooks/useMeetings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import type { Meeting, CreateMeetingInput } from '@zigznote/shared/types';

export function useMeetings(options?: { status?: string }) {
  return useQuery({
    queryKey: ['meetings', options],
    queryFn: () => api.get<Meeting[]>('/meetings', { params: options }),
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: ['meetings', id],
    queryFn: () => api.get<Meeting>(`/meetings/${id}`),
    enabled: !!id,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMeetingInput) => 
      api.post<Meeting>('/meetings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Meeting created');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
```

---

## 5. Validation Schema Template

```typescript
// apps/api/src/validators/meeting.validator.ts
import { z } from 'zod';

export const createMeetingSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    platform: z.enum(['zoom', 'meet', 'teams']),
    meetingUrl: z.string().url(),
    scheduledAt: z.string().datetime(),
    calendarEventId: z.string().optional(),
  }),
});

export const getMeetingsSchema = z.object({
  query: z.object({
    status: z.enum(['scheduled', 'recording', 'processing', 'completed']).optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
  }),
});

export const getMeetingByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>['body'];
export type MeetingQuery = z.infer<typeof getMeetingsSchema>['query'];
```

---

## 6. Checklists

### ✅ New File Checklist

```markdown
- [ ] File follows naming convention
- [ ] File is in correct directory
- [ ] File is under 200 LOC (add ownership comment if 200-400)
- [ ] Imports organized correctly
- [ ] No duplicate functionality exists elsewhere
- [ ] File has single clear responsibility
- [ ] TypeScript compiles without errors
- [ ] No `any` types without justification comment
- [ ] Test file created alongside
```

### ✅ Controller Checklist

```markdown
- [ ] Controller only handles HTTP (parse request, call service, send response)
- [ ] No business logic in controller
- [ ] No direct database access
- [ ] Input validation uses Zod schemas
- [ ] All endpoints wrapped in try/catch (or use asyncHandler)
- [ ] Proper HTTP status codes returned
- [ ] Tests added for all endpoints
```

### ✅ Service Checklist

```markdown
- [ ] Service handles all business logic for its domain
- [ ] Access control checks are in service (not controller)
- [ ] Uses repository for data access (not direct DB)
- [ ] Uses shared error classes (NotFoundError, etc.)
- [ ] Logs important operations with trace context
- [ ] No duplicate utility functions created
- [ ] Unit tests added for new functionality
```

### ✅ Repository Checklist

```markdown
- [ ] Repository handles data access only
- [ ] No business logic in repository
- [ ] Uses Prisma client from @zigznote/database
- [ ] Query options are typed
- [ ] Includes appropriate relations in queries
- [ ] Handles not-found by returning null (not throwing)
```

### ✅ React Component Checklist

```markdown
- [ ] Component file is PascalCase.tsx
- [ ] Component is under 200 LOC
- [ ] Single responsibility (one thing done well)
- [ ] Props interface defined and typed
- [ ] Uses cn() for conditional classNames
- [ ] No inline styles (use Tailwind)
- [ ] Accessible (proper labels, ARIA where needed)
- [ ] No console.log statements
- [ ] Memoized if re-renders are expensive
- [ ] Uses error boundary wrapper if fetching data
```

### ✅ API Endpoint Checklist

```markdown
- [ ] Endpoint follows REST conventions
- [ ] Input validated with Zod schema
- [ ] Authentication middleware applied
- [ ] Authorization checked in service
- [ ] Returns consistent response format { success, data } or { success, error }
- [ ] Error responses include code, message, traceId
- [ ] Rate limiting applied if public
- [ ] Documented in API reference
- [ ] Integration test written
```

### ✅ Bug Fix Checklist

```markdown
- [ ] Root cause identified and documented
- [ ] Fix is minimal (addresses only the bug)
- [ ] No unrelated changes included
- [ ] Test added that would have caught the bug
- [ ] All existing tests still pass
- [ ] No new TypeScript errors introduced
- [ ] Commit message describes what was fixed and why
```

### ✅ Refactor Checklist

```markdown
- [ ] Refactor is MECHANICAL ONLY (move code, don't change behavior)
- [ ] Single domain touched (no mixed changes)
- [ ] All existing tests pass (no behavior change)
- [ ] No new functionality added
- [ ] Imports updated in all consuming files
- [ ] Exports remain the same (or all consumers updated)
- [ ] File size reduced OR ownership comment added
```

### ✅ Database Schema Change Checklist

```markdown
- [ ] Migration file created
- [ ] Migration is reversible (or rollback documented)
- [ ] Schema file updated
- [ ] Types regenerated (prisma generate)
- [ ] Data impact assessed (will existing data break?)
- [ ] Seed file updated if needed
- [ ] Migration tested locally
- [ ] All tests pass after migration
```

### ✅ Pre-Commit Checklist

```markdown
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Tests pass: `pnpm test`
- [ ] No console.log statements added
- [ ] No backup files created (*.bak, *.old)
- [ ] No duplicate code introduced
- [ ] Files follow size limits
- [ ] Imports organized correctly
- [ ] Commit message follows convention
```

---

## 7. Scope Classification

Every task should be classified as **exactly one** of:

| Scope | Description | Risk Level |
|-------|-------------|------------|
| **Bug Fix** | Fix existing broken behavior | Low-Medium |
| **Refactor** | Improve code structure without changing behavior | Low |
| **Feature** | Add new functionality | Medium-High |
| **Test** | Add or update tests only | Low |
| **Docs** | Documentation only | Minimal |
| **Chore** | Dependencies, configs, tooling | Low |

If a task spans multiple scopes → **Split it into separate commits.**

---

## 8. Task Completion Report

After completing any task, report using this format:

```markdown
## Task Completed: [Task Name]

### Scope
[Bug Fix | Refactor | Feature | Test | Docs | Chore]

### What Was Done
- [Bullet list of changes]

### Files Changed
- `path/to/file1.ts` - [brief description]
- `path/to/file2.ts` - [brief description]

### Verification
- [x] TypeScript compiles
- [x] Tests pass
- [x] Linting passes
- [x] [Other relevant checklist items]

### Test Coverage
- New code coverage: X%
- Overall coverage impact: [increased/unchanged/decreased]

### Notes
- [Any observations, decisions made, or concerns]
- [Recommendations for follow-up if any]
```

---

## 9. Common Anti-Patterns to Avoid

### ❌ God Files
Files that handle **multiple unrelated domains**. Size doesn't matter if it's one domain — but if a file does "everything," split by responsibility.

### ❌ Business Logic in Controllers
Controllers should only handle HTTP. Move logic to services.

### ❌ Direct DB Access in Services
Services should use repositories. Makes testing easier.

### ❌ Duplicate Utilities
Always check if a utility exists before creating. Search first.

### ❌ Mixed Concerns in Commits
One commit = one concern. Don't mix bug fixes with features.

### ❌ Untyped Catch Blocks
```typescript
// ❌ Bad
catch (error) { console.log(error); }

// ✅ Good
catch (error) {
  logger.error('Operation failed', { error, traceId });
  throw new InternalError('Operation failed', { cause: error });
}
```

### ❌ Magic Numbers/Strings
```typescript
// ❌ Bad
if (status === 'completed') { ... }
if (attempts > 3) { ... }

// ✅ Good
import { MEETING_STATUS, MAX_RETRY_ATTEMPTS } from '@zigznote/shared/constants';
if (status === MEETING_STATUS.COMPLETED) { ... }
if (attempts > MAX_RETRY_ATTEMPTS) { ... }
```

### ❌ Missing Error Context
```typescript
// ❌ Bad
throw new Error('Failed');

// ✅ Good
throw new TranscriptionFailedError(meetingId, 'Deepgram API timeout');
```

---

**Use these patterns and checklists to maintain code quality across the project.**
