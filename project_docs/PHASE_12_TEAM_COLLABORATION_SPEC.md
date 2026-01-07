# Phase 12: Team Collaboration

## Overview

Add enterprise-grade team collaboration features to zigznote. Enable teams to discuss meetings through comments, highlight key moments with annotations, share meetings with granular permissions, and stay updated with real-time notifications.

**No new paid services required** - uses existing PostgreSQL, Redis, and AWS SES.

---

## Features Summary

| Feature | Description | Value |
|---------|-------------|-------|
| Comments | Discuss specific transcript moments | Team alignment |
| @Mentions | Notify teammates directly | Faster response |
| Annotations | Highlight and categorize key moments | Easy reference |
| Permissions | Control who sees what | Security/privacy |
| Real-time | Live updates without refresh | Collaboration |
| Activity Feed | Track what's happening | Awareness |

---

## 12.1 Database Schema Updates

Add to `packages/database/prisma/schema.prisma`:

```prisma
// ============================================
// COMMENTS SYSTEM
// ============================================

model Comment {
  id            String    @id @default(uuid())
  content       String    @db.Text
  
  // What it's attached to
  meetingId     String
  meeting       Meeting   @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  
  // Transcript reference (optional - can be general meeting comment)
  segmentId     String?   // Links to transcript segment
  timestamp     Float?    // Seconds into meeting
  
  // Author
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Threading
  parentId      String?
  parent        Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies       Comment[] @relation("CommentReplies")
  
  // Status
  isEdited      Boolean   @default(false)
  isResolved    Boolean   @default(false)
  resolvedById  String?
  resolvedBy    User?     @relation("ResolvedComments", fields: [resolvedById], references: [id])
  resolvedAt    DateTime?
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  mentions      CommentMention[]
  reactions     CommentReaction[]
  
  @@index([meetingId])
  @@index([userId])
  @@index([parentId])
  @@index([segmentId])
}

model CommentMention {
  id          String   @id @default(uuid())
  commentId   String
  comment     Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  notified    Boolean  @default(false)
  createdAt   DateTime @default(now())
  
  @@unique([commentId, userId])
  @@index([userId])
}

model CommentReaction {
  id          String   @id @default(uuid())
  commentId   String
  comment     Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  emoji       String   // 👍 ❤️ 🎉 etc.
  createdAt   DateTime @default(now())
  
  @@unique([commentId, userId, emoji])
  @@index([commentId])
}

// ============================================
// ANNOTATIONS SYSTEM
// ============================================

model Annotation {
  id            String           @id @default(uuid())
  
  // What it's attached to
  meetingId     String
  meeting       Meeting          @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  
  // Transcript range
  startTime     Float            // Start timestamp in seconds
  endTime       Float            // End timestamp in seconds
  segmentIds    String[]         // Array of segment IDs covered
  
  // Content
  text          String?          @db.Text  // Optional note
  label         AnnotationLabel  @default(HIGHLIGHT)
  color         String           @default("#FEF3C7") // Yellow default
  
  // Author
  userId        String
  user          User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  
  @@index([meetingId])
  @@index([userId])
  @@index([label])
}

enum AnnotationLabel {
  HIGHLIGHT      // General highlight
  ACTION_ITEM    // Task to do
  DECISION       // Decision made
  QUESTION       // Question raised
  IMPORTANT      // Important point
  FOLLOW_UP      // Needs follow up
  BLOCKER        // Blocker identified
  IDEA           // Idea suggested
}

// ============================================
// MEETING SHARING & PERMISSIONS
// ============================================

model MeetingShare {
  id            String          @id @default(uuid())
  meetingId     String
  meeting       Meeting         @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  
  // Share target (one of these)
  userId        String?         // Share with specific user
  user          User?           @relation(fields: [userId], references: [id], onDelete: Cascade)
  email         String?         // Share with email (for non-users)
  teamId        String?         // Share with entire team
  
  // Permission level
  permission    SharePermission @default(VIEWER)
  
  // Share link settings
  shareToken    String?         @unique  // For link sharing
  linkEnabled   Boolean         @default(false)
  linkExpires   DateTime?
  
  // Who shared
  sharedById    String
  sharedBy      User            @relation("SharedByUser", fields: [sharedById], references: [id])
  
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  
  @@unique([meetingId, userId])
  @@unique([meetingId, email])
  @@index([meetingId])
  @@index([userId])
  @@index([shareToken])
}

enum SharePermission {
  VIEWER        // Can view transcript, summary
  COMMENTER     // Can view + add comments
  EDITOR        // Can edit, add annotations
  ADMIN         // Can edit + manage sharing
}

// ============================================
// NOTIFICATIONS
// ============================================

model Notification {
  id            String           @id @default(uuid())
  userId        String
  user          User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  type          NotificationType
  title         String
  message       String           @db.Text
  
  // Reference to related entity
  meetingId     String?
  commentId     String?
  
  // Status
  read          Boolean          @default(false)
  readAt        DateTime?
  emailSent     Boolean          @default(false)
  
  // Metadata (JSON for flexibility)
  metadata      Json?
  
  createdAt     DateTime         @default(now())
  
  @@index([userId, read])
  @@index([userId, createdAt])
}

enum NotificationType {
  MENTION              // @mentioned in comment
  REPLY                // Reply to your comment
  MEETING_SHARED       // Meeting shared with you
  COMMENT_ADDED        // New comment on your meeting
  ANNOTATION_ADDED     // New annotation on your meeting
  PERMISSION_CHANGED   // Your access level changed
  MEETING_UPDATED      // Meeting you have access to was updated
}

// ============================================
// ACTIVITY LOG (for team feed)
// ============================================

model Activity {
  id            String         @id @default(uuid())
  
  // Who did it
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // What they did
  action        ActivityAction
  
  // Context
  organizationId String
  meetingId      String?
  commentId      String?
  annotationId   String?
  
  // Details
  metadata       Json?
  
  createdAt      DateTime       @default(now())
  
  @@index([organizationId, createdAt])
  @@index([meetingId, createdAt])
  @@index([userId, createdAt])
}

enum ActivityAction {
  MEETING_CREATED
  MEETING_UPDATED
  MEETING_SHARED
  MEETING_VIEWED
  COMMENT_ADDED
  COMMENT_REPLIED
  COMMENT_RESOLVED
  ANNOTATION_ADDED
  ANNOTATION_UPDATED
  MEMBER_JOINED
  PERMISSION_CHANGED
}

// ============================================
// UPDATE EXISTING MODELS
// ============================================

// Add to User model:
model User {
  // ... existing fields ...
  
  // New relations
  comments          Comment[]
  commentMentions   CommentMention[]
  commentReactions  CommentReaction[]
  resolvedComments  Comment[]        @relation("ResolvedComments")
  annotations       Annotation[]
  meetingShares     MeetingShare[]
  sharedMeetings    MeetingShare[]   @relation("SharedByUser")
  notifications     Notification[]
  activities        Activity[]
  
  // Notification preferences
  notifyOnMention   Boolean          @default(true)
  notifyOnReply     Boolean          @default(true)
  notifyOnShare     Boolean          @default(true)
  notifyOnComment   Boolean          @default(false)  // Off by default (can be noisy)
}

// Add to Meeting model:
model Meeting {
  // ... existing fields ...
  
  // New relations
  comments      Comment[]
  annotations   Annotation[]
  shares        MeetingShare[]
}
```

---

## 12.2 Comments API

Create `apps/api/src/routes/comments.ts`:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@zigznote/database';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { checkMeetingAccess } from '../middleware/meetingAccess';
import { publishEvent } from '../services/realtimeService';
import { createNotification, sendMentionEmail } from '../services/notificationService';
import { logActivity } from '../services/activityService';

const router = Router();

// Create comment schema
const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  meetingId: z.string().uuid(),
  segmentId: z.string().optional(),
  timestamp: z.number().optional(),
  parentId: z.string().uuid().optional(),
  mentions: z.array(z.string().uuid()).optional(), // User IDs to mention
});

// GET /comments?meetingId=xxx
router.get('/', requireAuth, async (req, res) => {
  const { meetingId } = req.query;
  
  if (!meetingId) {
    return res.status(400).json({ error: 'meetingId is required' });
  }
  
  // Check access
  const hasAccess = await checkMeetingAccess(req.auth.userId, meetingId as string, 'VIEWER');
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const comments = await prisma.comment.findMany({
    where: {
      meetingId: meetingId as string,
      parentId: null, // Top-level comments only
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
      replies: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
          mentions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
          reactions: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      mentions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      reactions: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  
  res.json({ comments });
});

// POST /comments
router.post('/', requireAuth, validateRequest({ body: createCommentSchema }), async (req, res) => {
  const { content, meetingId, segmentId, timestamp, parentId, mentions } = req.body;
  const userId = req.auth.userId;
  
  // Check access (need at least COMMENTER)
  const hasAccess = await checkMeetingAccess(userId, meetingId, 'COMMENTER');
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Get meeting for notifications
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, title: true, userId: true },
  });
  
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  // Create comment
  const comment = await prisma.comment.create({
    data: {
      content,
      meetingId,
      segmentId,
      timestamp,
      parentId,
      userId,
      mentions: mentions?.length ? {
        create: mentions.map((mentionUserId: string) => ({
          userId: mentionUserId,
        })),
      } : undefined,
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
      mentions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  
  // Send notifications for mentions
  if (mentions?.length) {
    for (const mentionUserId of mentions) {
      await createNotification({
        userId: mentionUserId,
        type: 'MENTION',
        title: 'You were mentioned',
        message: `${comment.user.firstName} mentioned you in a comment on "${meeting.title}"`,
        meetingId,
        commentId: comment.id,
      });
      
      // Send email notification
      await sendMentionEmail(mentionUserId, comment, meeting);
    }
  }
  
  // Notify parent comment author if this is a reply
  if (parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { userId: true },
    });
    
    if (parentComment && parentComment.userId !== userId) {
      await createNotification({
        userId: parentComment.userId,
        type: 'REPLY',
        title: 'New reply to your comment',
        message: `${comment.user.firstName} replied to your comment on "${meeting.title}"`,
        meetingId,
        commentId: comment.id,
      });
    }
  }
  
  // Notify meeting owner
  if (meeting.userId !== userId && !parentId) {
    await createNotification({
      userId: meeting.userId,
      type: 'COMMENT_ADDED',
      title: 'New comment on your meeting',
      message: `${comment.user.firstName} commented on "${meeting.title}"`,
      meetingId,
      commentId: comment.id,
    });
  }
  
  // Log activity
  await logActivity({
    userId,
    action: parentId ? 'COMMENT_REPLIED' : 'COMMENT_ADDED',
    organizationId: req.auth.organizationId,
    meetingId,
    commentId: comment.id,
  });
  
  // Publish real-time event
  await publishEvent(`meeting:${meetingId}`, 'comment:created', comment);
  
  res.status(201).json({ comment });
});

// PUT /comments/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.auth.userId;
  
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { userId: true, meetingId: true },
  });
  
  if (!comment) {
    return res.status(404).json({ error: 'Comment not found' });
  }
  
  if (comment.userId !== userId) {
    return res.status(403).json({ error: 'Can only edit your own comments' });
  }
  
  const updatedComment = await prisma.comment.update({
    where: { id },
    data: {
      content,
      isEdited: true,
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });
  
  // Publish real-time event
  await publishEvent(`meeting:${comment.meetingId}`, 'comment:updated', updatedComment);
  
  res.json({ comment: updatedComment });
});

// DELETE /comments/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.auth.userId;
  
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { userId: true, meetingId: true },
  });
  
  if (!comment) {
    return res.status(404).json({ error: 'Comment not found' });
  }
  
  // Can delete if owner OR meeting owner OR admin
  const meeting = await prisma.meeting.findUnique({
    where: { id: comment.meetingId },
    select: { userId: true },
  });
  
  const canDelete = comment.userId === userId || meeting?.userId === userId;
  
  if (!canDelete) {
    return res.status(403).json({ error: 'Cannot delete this comment' });
  }
  
  await prisma.comment.delete({ where: { id } });
  
  // Publish real-time event
  await publishEvent(`meeting:${comment.meetingId}`, 'comment:deleted', { id });
  
  res.json({ success: true });
});

// POST /comments/:id/resolve
router.post('/:id/resolve', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.auth.userId;
  
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { meetingId: true },
  });
  
  if (!comment) {
    return res.status(404).json({ error: 'Comment not found' });
  }
  
  const hasAccess = await checkMeetingAccess(userId, comment.meetingId, 'EDITOR');
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const updatedComment = await prisma.comment.update({
    where: { id },
    data: {
      isResolved: true,
      resolvedById: userId,
      resolvedAt: new Date(),
    },
  });
  
  await logActivity({
    userId,
    action: 'COMMENT_RESOLVED',
    organizationId: req.auth.organizationId,
    meetingId: comment.meetingId,
    commentId: id,
  });
  
  await publishEvent(`meeting:${comment.meetingId}`, 'comment:resolved', updatedComment);
  
  res.json({ comment: updatedComment });
});

// POST /comments/:id/reactions
router.post('/:id/reactions', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { emoji } = req.body;
  const userId = req.auth.userId;
  
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { meetingId: true },
  });
  
  if (!comment) {
    return res.status(404).json({ error: 'Comment not found' });
  }
  
  // Toggle reaction
  const existing = await prisma.commentReaction.findUnique({
    where: {
      commentId_userId_emoji: { commentId: id, userId, emoji },
    },
  });
  
  if (existing) {
    await prisma.commentReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.commentReaction.create({
      data: { commentId: id, userId, emoji },
    });
  }
  
  const reactions = await prisma.commentReaction.findMany({
    where: { commentId: id },
  });
  
  await publishEvent(`meeting:${comment.meetingId}`, 'comment:reactions', { commentId: id, reactions });
  
  res.json({ reactions });
});

export default router;
```

---

## 12.3 Annotations API

Create `apps/api/src/routes/annotations.ts`:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@zigznote/database';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { checkMeetingAccess } from '../middleware/meetingAccess';
import { publishEvent } from '../services/realtimeService';
import { logActivity } from '../services/activityService';

const router = Router();

const annotationLabels = [
  'HIGHLIGHT', 'ACTION_ITEM', 'DECISION', 'QUESTION',
  'IMPORTANT', 'FOLLOW_UP', 'BLOCKER', 'IDEA',
] as const;

const createAnnotationSchema = z.object({
  meetingId: z.string().uuid(),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  segmentIds: z.array(z.string()).optional(),
  text: z.string().max(1000).optional(),
  label: z.enum(annotationLabels).default('HIGHLIGHT'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// Label colors
const labelColors: Record<string, string> = {
  HIGHLIGHT: '#FEF3C7',   // Yellow
  ACTION_ITEM: '#DBEAFE', // Blue
  DECISION: '#D1FAE5',    // Green
  QUESTION: '#E9D5FF',    // Purple
  IMPORTANT: '#FEE2E2',   // Red
  FOLLOW_UP: '#FFEDD5',   // Orange
  BLOCKER: '#FECACA',     // Light red
  IDEA: '#CFFAFE',        // Cyan
};

// GET /annotations?meetingId=xxx
router.get('/', requireAuth, async (req, res) => {
  const { meetingId, label } = req.query;
  
  if (!meetingId) {
    return res.status(400).json({ error: 'meetingId is required' });
  }
  
  const hasAccess = await checkMeetingAccess(req.auth.userId, meetingId as string, 'VIEWER');
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const annotations = await prisma.annotation.findMany({
    where: {
      meetingId: meetingId as string,
      ...(label ? { label: label as any } : {}),
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
    orderBy: { startTime: 'asc' },
  });
  
  res.json({ annotations, labelColors });
});

// POST /annotations
router.post('/', requireAuth, validateRequest({ body: createAnnotationSchema }), async (req, res) => {
  const { meetingId, startTime, endTime, segmentIds, text, label } = req.body;
  const userId = req.auth.userId;
  
  const hasAccess = await checkMeetingAccess(userId, meetingId, 'EDITOR');
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const color = req.body.color || labelColors[label];
  
  const annotation = await prisma.annotation.create({
    data: {
      meetingId,
      startTime,
      endTime,
      segmentIds: segmentIds || [],
      text,
      label,
      color,
      userId,
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });
  
  await logActivity({
    userId,
    action: 'ANNOTATION_ADDED',
    organizationId: req.auth.organizationId,
    meetingId,
    annotationId: annotation.id,
    metadata: { label },
  });
  
  await publishEvent(`meeting:${meetingId}`, 'annotation:created', annotation);
  
  res.status(201).json({ annotation });
});

// PUT /annotations/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { text, label, color } = req.body;
  const userId = req.auth.userId;
  
  const annotation = await prisma.annotation.findUnique({
    where: { id },
    select: { userId: true, meetingId: true },
  });
  
  if (!annotation) {
    return res.status(404).json({ error: 'Annotation not found' });
  }
  
  // Only author can edit
  if (annotation.userId !== userId) {
    return res.status(403).json({ error: 'Can only edit your own annotations' });
  }
  
  const updatedAnnotation = await prisma.annotation.update({
    where: { id },
    data: {
      text,
      label,
      color: color || (label ? labelColors[label] : undefined),
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });
  
  await logActivity({
    userId,
    action: 'ANNOTATION_UPDATED',
    organizationId: req.auth.organizationId,
    meetingId: annotation.meetingId,
    annotationId: id,
  });
  
  await publishEvent(`meeting:${annotation.meetingId}`, 'annotation:updated', updatedAnnotation);
  
  res.json({ annotation: updatedAnnotation });
});

// DELETE /annotations/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.auth.userId;
  
  const annotation = await prisma.annotation.findUnique({
    where: { id },
    select: { userId: true, meetingId: true },
  });
  
  if (!annotation) {
    return res.status(404).json({ error: 'Annotation not found' });
  }
  
  // Only author or meeting owner can delete
  const meeting = await prisma.meeting.findUnique({
    where: { id: annotation.meetingId },
    select: { userId: true },
  });
  
  if (annotation.userId !== userId && meeting?.userId !== userId) {
    return res.status(403).json({ error: 'Cannot delete this annotation' });
  }
  
  await prisma.annotation.delete({ where: { id } });
  
  await publishEvent(`meeting:${annotation.meetingId}`, 'annotation:deleted', { id });
  
  res.json({ success: true });
});

export default router;
```

---

## 12.4 Meeting Sharing API

Create `apps/api/src/routes/sharing.ts`:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@zigznote/database';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { createNotification } from '../services/notificationService';
import { sendShareEmail } from '../services/emailService';
import { logActivity } from '../services/activityService';
import crypto from 'crypto';

const router = Router();

const shareSchema = z.object({
  meetingId: z.string().uuid(),
  email: z.string().email().optional(),
  userId: z.string().uuid().optional(),
  permission: z.enum(['VIEWER', 'COMMENTER', 'EDITOR', 'ADMIN']).default('VIEWER'),
}).refine(data => data.email || data.userId, {
  message: 'Either email or userId is required',
});

// GET /sharing/:meetingId
router.get('/:meetingId', requireAuth, async (req, res) => {
  const { meetingId } = req.params;
  const userId = req.auth.userId;
  
  // Must be meeting owner or admin
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { userId: true },
  });
  
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  const hasAdminAccess = meeting.userId === userId ||
    await checkMeetingAccess(userId, meetingId, 'ADMIN');
  
  if (!hasAdminAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const shares = await prisma.meetingShare.findMany({
    where: { meetingId },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      },
      sharedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  res.json({ shares });
});

// POST /sharing
router.post('/', requireAuth, validateRequest({ body: shareSchema }), async (req, res) => {
  const { meetingId, email, userId: shareWithUserId, permission } = req.body;
  const userId = req.auth.userId;
  
  // Must be meeting owner or admin
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, title: true, userId: true },
  });
  
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  const hasAdminAccess = meeting.userId === userId ||
    await checkMeetingAccess(userId, meetingId, 'ADMIN');
  
  if (!hasAdminAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Find or identify target user
  let targetUserId = shareWithUserId;
  let targetEmail = email;
  
  if (email && !shareWithUserId) {
    const targetUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (targetUser) {
      targetUserId = targetUser.id;
    }
  }
  
  // Check if already shared
  const existing = await prisma.meetingShare.findFirst({
    where: {
      meetingId,
      OR: [
        { userId: targetUserId },
        { email: targetEmail?.toLowerCase() },
      ],
    },
  });
  
  if (existing) {
    // Update permission
    const updated = await prisma.meetingShare.update({
      where: { id: existing.id },
      data: { permission },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });
    
    return res.json({ share: updated, message: 'Permission updated' });
  }
  
  // Create share
  const share = await prisma.meetingShare.create({
    data: {
      meetingId,
      userId: targetUserId,
      email: targetUserId ? null : targetEmail?.toLowerCase(),
      permission,
      sharedById: userId,
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      },
      sharedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
  
  // Get sharer info
  const sharer = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });
  
  // Notify target user
  if (targetUserId) {
    await createNotification({
      userId: targetUserId,
      type: 'MEETING_SHARED',
      title: 'Meeting shared with you',
      message: `${sharer?.firstName} shared "${meeting.title}" with you`,
      meetingId,
    });
  }
  
  // Send email
  await sendShareEmail(
    targetUserId ? share.user?.email : targetEmail,
    `${sharer?.firstName} ${sharer?.lastName}`,
    meeting.title,
    meetingId,
    permission
  );
  
  await logActivity({
    userId,
    action: 'MEETING_SHARED',
    organizationId: req.auth.organizationId,
    meetingId,
    metadata: { sharedWith: targetUserId || targetEmail, permission },
  });
  
  res.status(201).json({ share });
});

// DELETE /sharing/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.auth.userId;
  
  const share = await prisma.meetingShare.findUnique({
    where: { id },
    include: { meeting: { select: { userId: true } } },
  });
  
  if (!share) {
    return res.status(404).json({ error: 'Share not found' });
  }
  
  // Must be meeting owner or the share owner
  if (share.meeting.userId !== userId && share.sharedById !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  await prisma.meetingShare.delete({ where: { id } });
  
  res.json({ success: true });
});

// POST /sharing/:meetingId/link - Generate shareable link
router.post('/:meetingId/link', requireAuth, async (req, res) => {
  const { meetingId } = req.params;
  const { permission, expiresIn } = req.body; // expiresIn in hours
  const userId = req.auth.userId;
  
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { userId: true },
  });
  
  if (!meeting || meeting.userId !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const shareToken = crypto.randomBytes(32).toString('hex');
  const linkExpires = expiresIn ? new Date(Date.now() + expiresIn * 60 * 60 * 1000) : null;
  
  // Create or update link share
  const share = await prisma.meetingShare.upsert({
    where: {
      meetingId_shareToken: { meetingId, shareToken },
    },
    create: {
      meetingId,
      shareToken,
      linkEnabled: true,
      linkExpires,
      permission: permission || 'VIEWER',
      sharedById: userId,
    },
    update: {
      shareToken,
      linkEnabled: true,
      linkExpires,
      permission: permission || 'VIEWER',
    },
  });
  
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/meetings/${meetingId}?token=${shareToken}`;
  
  res.json({ shareUrl, expiresAt: linkExpires });
});

export default router;

// Helper function
async function checkMeetingAccess(
  userId: string,
  meetingId: string,
  requiredPermission: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
): Promise<boolean> {
  const permissionLevels = { VIEWER: 1, COMMENTER: 2, EDITOR: 3, ADMIN: 4 };
  
  // Check if owner
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { userId: true, organizationId: true },
  });
  
  if (!meeting) return false;
  if (meeting.userId === userId) return true;
  
  // Check share
  const share = await prisma.meetingShare.findFirst({
    where: {
      meetingId,
      userId,
    },
  });
  
  if (share) {
    return permissionLevels[share.permission] >= permissionLevels[requiredPermission];
  }
  
  return false;
}
```

---

## 12.5 Real-Time Service

Create `apps/api/src/services/realtimeService.ts`:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Channel subscriptions
const subscriptions = new Map<string, Set<(data: any) => void>>();

// Initialize subscriber
subscriber.on('message', (channel, message) => {
  const callbacks = subscriptions.get(channel);
  if (callbacks) {
    const data = JSON.parse(message);
    callbacks.forEach(callback => callback(data));
  }
});

// Publish event to a channel
export async function publishEvent(channel: string, event: string, data: any): Promise<void> {
  await redis.publish(channel, JSON.stringify({ event, data, timestamp: Date.now() }));
}

// Subscribe to a channel
export function subscribeToChannel(channel: string, callback: (data: any) => void): () => void {
  if (!subscriptions.has(channel)) {
    subscriptions.set(channel, new Set());
    subscriber.subscribe(channel);
  }
  
  subscriptions.get(channel)!.add(callback);
  
  // Return unsubscribe function
  return () => {
    const callbacks = subscriptions.get(channel);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        subscriptions.delete(channel);
        subscriber.unsubscribe(channel);
      }
    }
  };
}

// Presence tracking
export async function setUserPresence(meetingId: string, userId: string, userData: any): Promise<void> {
  const key = `presence:meeting:${meetingId}`;
  await redis.hset(key, userId, JSON.stringify({ ...userData, lastSeen: Date.now() }));
  await redis.expire(key, 300); // 5 minutes TTL
  
  await publishEvent(`meeting:${meetingId}`, 'presence:updated', {
    userId,
    ...userData,
    status: 'online',
  });
}

export async function removeUserPresence(meetingId: string, userId: string): Promise<void> {
  const key = `presence:meeting:${meetingId}`;
  await redis.hdel(key, userId);
  
  await publishEvent(`meeting:${meetingId}`, 'presence:updated', {
    userId,
    status: 'offline',
  });
}

export async function getMeetingPresence(meetingId: string): Promise<any[]> {
  const key = `presence:meeting:${meetingId}`;
  const presence = await redis.hgetall(key);
  
  return Object.entries(presence).map(([userId, data]) => ({
    userId,
    ...JSON.parse(data),
  }));
}
```

---

## 12.6 Notification Service

Create `apps/api/src/services/notificationService.ts`:

```typescript
import { prisma } from '@zigznote/database';
import { sendEmail } from './emailService';
import { publishEvent } from './realtimeService';

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  meetingId?: string;
  commentId?: string;
  metadata?: any;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const { userId, type, title, message, meetingId, commentId, metadata } = params;
  
  // Get user preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      notifyOnMention: true,
      notifyOnReply: true,
      notifyOnShare: true,
      notifyOnComment: true,
      email: true,
      firstName: true,
    },
  });
  
  if (!user) return;
  
  // Check if user wants this notification
  const shouldNotify =
    (type === 'MENTION' && user.notifyOnMention) ||
    (type === 'REPLY' && user.notifyOnReply) ||
    (type === 'MEETING_SHARED' && user.notifyOnShare) ||
    (type === 'COMMENT_ADDED' && user.notifyOnComment) ||
    !['MENTION', 'REPLY', 'MEETING_SHARED', 'COMMENT_ADDED'].includes(type);
  
  if (!shouldNotify) return;
  
  // Create notification
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: type as any,
      title,
      message,
      meetingId,
      commentId,
      metadata,
    },
  });
  
  // Send real-time notification
  await publishEvent(`user:${userId}`, 'notification:created', notification);
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true, readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

// Email notification for mentions
export async function sendMentionEmail(
  userId: string,
  comment: any,
  meeting: any
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, notifyOnMention: true },
  });
  
  if (!user || !user.notifyOnMention) return;
  
  const { MentionEmail } = await import('../email-templates');
  
  await sendEmail({
    to: user.email,
    subject: `${comment.user.firstName} mentioned you in a comment`,
    react: MentionEmail({
      userName: user.firstName,
      mentionedBy: `${comment.user.firstName} ${comment.user.lastName}`,
      meetingTitle: meeting.title,
      commentText: comment.content.substring(0, 200),
      meetingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/meetings/${meeting.id}`,
    }),
  });
}
```

---

## 12.7 Activity Service

Create `apps/api/src/services/activityService.ts`:

```typescript
import { prisma } from '@zigznote/database';

interface LogActivityParams {
  userId: string;
  action: string;
  organizationId: string;
  meetingId?: string;
  commentId?: string;
  annotationId?: string;
  metadata?: any;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  await prisma.activity.create({
    data: {
      userId: params.userId,
      action: params.action as any,
      organizationId: params.organizationId,
      meetingId: params.meetingId,
      commentId: params.commentId,
      annotationId: params.annotationId,
      metadata: params.metadata,
    },
  });
}

export async function getTeamActivity(
  organizationId: string,
  limit = 50,
  cursor?: string
): Promise<any[]> {
  return prisma.activity.findMany({
    where: {
      organizationId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getMeetingActivity(
  meetingId: string,
  limit = 50
): Promise<any[]> {
  return prisma.activity.findMany({
    where: { meetingId },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
```

---

## 12.8 Frontend Components

### Comment Component

Create `apps/web/components/collaboration/CommentThread.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Reply, Check, Edit, Trash } from 'lucide-react';
import { MentionInput } from './MentionInput';

interface Comment {
  id: string;
  content: string;
  timestamp?: number;
  isEdited: boolean;
  isResolved: boolean;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  replies: Comment[];
  mentions: { user: { id: string; firstName: string; lastName: string } }[];
  reactions: { emoji: string; userId: string }[];
}

interface CommentThreadProps {
  comment: Comment;
  currentUserId: string;
  onReply: (commentId: string, content: string, mentions: string[]) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onResolve: (commentId: string) => void;
  onReact: (commentId: string, emoji: string) => void;
  onTimestampClick?: (timestamp: number) => void;
}

export function CommentThread({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onReact,
  onTimestampClick,
}: CommentThreadProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [editContent, setEditContent] = useState(comment.content);
  const [mentions, setMentions] = useState<string[]>([]);

  const isOwner = comment.user.id === currentUserId;
  const initials = `${comment.user.firstName[0]}${comment.user.lastName[0]}`;

  const handleReply = () => {
    if (replyContent.trim()) {
      onReply(comment.id, replyContent, mentions);
      setReplyContent('');
      setMentions([]);
      setIsReplying(false);
    }
  };

  const handleEdit = () => {
    if (editContent.trim()) {
      onEdit(comment.id, editContent);
      setIsEditing(false);
    }
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`p-4 rounded-lg ${comment.isResolved ? 'bg-gray-50 opacity-75' : 'bg-white border'}`}>
      {/* Comment header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={comment.user.avatarUrl} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {comment.user.firstName} {comment.user.lastName}
              </span>
              {comment.timestamp && (
                <button
                  onClick={() => onTimestampClick?.(comment.timestamp!)}
                  className="text-xs text-emerald-600 hover:underline"
                >
                  at {formatTimestamp(comment.timestamp)}
                </button>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              {comment.isEdited && ' (edited)'}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwner && (
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" /> Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onResolve(comment.id)}>
              <Check className="h-4 w-4 mr-2" /> {comment.isResolved ? 'Unresolve' : 'Resolve'}
            </DropdownMenuItem>
            {isOwner && (
              <DropdownMenuItem onClick={() => onDelete(comment.id)} className="text-red-600">
                <Trash className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Comment content */}
      <div className="mt-2 ml-11">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEdit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
        )}

        {/* Reactions */}
        <div className="flex gap-1 mt-2">
          {['👍', '❤️', '🎉', '🤔'].map((emoji) => {
            const reactionCount = comment.reactions.filter(r => r.emoji === emoji).length;
            const hasReacted = comment.reactions.some(r => r.emoji === emoji && r.userId === currentUserId);
            
            if (reactionCount === 0 && !hasReacted) return null;
            
            return (
              <button
                key={emoji}
                onClick={() => onReact(comment.id, emoji)}
                className={`px-2 py-1 rounded-full text-xs ${
                  hasReacted ? 'bg-emerald-100 border-emerald-300' : 'bg-gray-100'
                } border hover:bg-gray-200`}
              >
                {emoji} {reactionCount > 0 && reactionCount}
              </button>
            );
          })}
          <button
            onClick={() => onReact(comment.id, '👍')}
            className="px-2 py-1 rounded-full text-xs bg-gray-100 hover:bg-gray-200 border"
          >
            +
          </button>
        </div>

        {/* Reply button */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-gray-500"
          onClick={() => setIsReplying(!isReplying)}
        >
          <Reply className="h-4 w-4 mr-1" /> Reply
        </Button>

        {/* Reply input */}
        {isReplying && (
          <div className="mt-2 space-y-2">
            <MentionInput
              value={replyContent}
              onChange={setReplyContent}
              onMentionsChange={setMentions}
              placeholder="Write a reply..."
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleReply}>Reply</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsReplying(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Replies */}
        {comment.replies.length > 0 && (
          <div className="mt-4 space-y-4 border-l-2 border-gray-200 pl-4">
            {comment.replies.map((reply) => (
              <CommentThread
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onResolve={onResolve}
                onReact={onReact}
                onTimestampClick={onTimestampClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### More components to create:

- `MentionInput.tsx` - Textarea with @mention autocomplete
- `AnnotationHighlight.tsx` - Highlight on transcript
- `AnnotationSidebar.tsx` - List of annotations with filters
- `ShareDialog.tsx` - Share meeting modal
- `PresenceIndicator.tsx` - Who's viewing this meeting
- `NotificationDropdown.tsx` - Notification bell dropdown
- `ActivityFeed.tsx` - Team activity timeline

---

## 12.9 Testing Checklist

- [ ] Create comment on transcript
- [ ] Reply to comment
- [ ] Edit own comment
- [ ] Delete own comment
- [ ] @mention teammate
- [ ] Receive notification for mention
- [ ] Receive email for mention
- [ ] Add emoji reaction
- [ ] Resolve comment thread
- [ ] Create annotation
- [ ] Filter annotations by label
- [ ] Edit annotation
- [ ] Delete annotation
- [ ] Share meeting with user by email
- [ ] Share meeting with permission levels
- [ ] Generate shareable link
- [ ] Access shared meeting as viewer
- [ ] Access shared meeting as editor
- [ ] Real-time comment updates
- [ ] Presence indicators work
- [ ] Activity feed shows recent actions
- [ ] Notification preferences work

---

## Definition of Done

1. All database models created and migrated
2. All API routes working
3. Real-time updates working via Redis pub/sub
4. Notifications sent (in-app + email)
5. All UI components built
6. Permission system working correctly
7. Activity tracking for all actions
8. Tests passing

---

## Estimated Time

| Task | Hours |
|------|-------|
| Database schema + migration | 2 |
| Comments API | 4 |
| Annotations API | 3 |
| Sharing API | 4 |
| Real-time service | 3 |
| Notification service | 3 |
| Frontend components | 8 |
| Testing | 3 |
| **Total** | **~30 hours** |

---

## No New Paid Services ✅

| Service | Usage | Cost |
|---------|-------|------|
| PostgreSQL | Store all data | $0 (existing) |
| Redis | Real-time pub/sub | $0 (Phase 11.5) |
| AWS SES | Email notifications | $0 (Phase 11.5) |
