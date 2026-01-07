# Phase 12: Team Collaboration Implementation

## Mission
Add enterprise-grade team collaboration features: comments on transcripts, @mentions with notifications, annotations to highlight key moments, granular meeting sharing permissions, real-time updates, and activity tracking. **DO NOT STOP until all features work.**

---

## Rules
1. **Do NOT ask for permission** - just build and continue
2. **Do NOT stop** until all features work
3. **Use existing stack** - PostgreSQL, Redis, AWS SES (no new services)
4. **Test each feature** before moving on

---

## What to Build

| Feature | Priority |
|---------|----------|
| Comments on transcript | 🔴 High |
| @mentions + notifications | 🔴 High |
| Annotations (highlights) | 🔴 High |
| Meeting sharing/permissions | 🔴 High |
| Real-time updates | 🟡 Medium |
| Activity feed | 🟡 Medium |

---

## Step 1: Database Schema

Add these models to `packages/database/prisma/schema.prisma`:

### Comments
```prisma
model Comment {
  id            String    @id @default(uuid())
  content       String    @db.Text
  meetingId     String
  meeting       Meeting   @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  segmentId     String?
  timestamp     Float?
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  parentId      String?
  parent        Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies       Comment[] @relation("CommentReplies")
  isEdited      Boolean   @default(false)
  isResolved    Boolean   @default(false)
  resolvedById  String?
  resolvedAt    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  mentions      CommentMention[]
  reactions     CommentReaction[]
  
  @@index([meetingId])
  @@index([parentId])
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
}

model CommentReaction {
  id          String   @id @default(uuid())
  commentId   String
  comment     Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  emoji       String
  createdAt   DateTime @default(now())
  
  @@unique([commentId, userId, emoji])
}
```

### Annotations
```prisma
model Annotation {
  id            String           @id @default(uuid())
  meetingId     String
  meeting       Meeting          @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  startTime     Float
  endTime       Float
  segmentIds    String[]
  text          String?          @db.Text
  label         AnnotationLabel  @default(HIGHLIGHT)
  color         String           @default("#FEF3C7")
  userId        String
  user          User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  
  @@index([meetingId])
  @@index([label])
}

enum AnnotationLabel {
  HIGHLIGHT
  ACTION_ITEM
  DECISION
  QUESTION
  IMPORTANT
  FOLLOW_UP
  BLOCKER
  IDEA
}
```

### Sharing & Permissions
```prisma
model MeetingShare {
  id            String          @id @default(uuid())
  meetingId     String
  meeting       Meeting         @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  userId        String?
  user          User?           @relation(fields: [userId], references: [id], onDelete: Cascade)
  email         String?
  permission    SharePermission @default(VIEWER)
  shareToken    String?         @unique
  linkEnabled   Boolean         @default(false)
  linkExpires   DateTime?
  sharedById    String
  sharedBy      User            @relation("SharedByUser", fields: [sharedById], references: [id])
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  
  @@unique([meetingId, userId])
  @@unique([meetingId, email])
  @@index([shareToken])
}

enum SharePermission {
  VIEWER
  COMMENTER
  EDITOR
  ADMIN
}
```

### Notifications
```prisma
model Notification {
  id            String           @id @default(uuid())
  userId        String
  user          User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  type          NotificationType
  title         String
  message       String           @db.Text
  meetingId     String?
  commentId     String?
  read          Boolean          @default(false)
  readAt        DateTime?
  emailSent     Boolean          @default(false)
  metadata      Json?
  createdAt     DateTime         @default(now())
  
  @@index([userId, read])
}

enum NotificationType {
  MENTION
  REPLY
  MEETING_SHARED
  COMMENT_ADDED
  ANNOTATION_ADDED
  PERMISSION_CHANGED
}
```

### Activity
```prisma
model Activity {
  id             String         @id @default(uuid())
  userId         String
  user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  action         ActivityAction
  organizationId String
  meetingId      String?
  commentId      String?
  annotationId   String?
  metadata       Json?
  createdAt      DateTime       @default(now())
  
  @@index([organizationId, createdAt])
  @@index([meetingId])
}

enum ActivityAction {
  MEETING_CREATED
  MEETING_SHARED
  COMMENT_ADDED
  COMMENT_REPLIED
  COMMENT_RESOLVED
  ANNOTATION_ADDED
}
```

### Update User model
```prisma
// Add to existing User model
notifyOnMention   Boolean @default(true)
notifyOnReply     Boolean @default(true)
notifyOnShare     Boolean @default(true)
notifyOnComment   Boolean @default(false)

// Add relations
comments          Comment[]
commentMentions   CommentMention[]
annotations       Annotation[]
meetingShares     MeetingShare[]
sharedMeetings    MeetingShare[]   @relation("SharedByUser")
notifications     Notification[]
activities        Activity[]
```

### Update Meeting model
```prisma
// Add relations
comments      Comment[]
annotations   Annotation[]
shares        MeetingShare[]
```

Run migration:
```bash
cd packages/database
pnpm prisma migrate dev --name add_collaboration_models
pnpm prisma generate
```

---

## Step 2: Create API Routes

### Comments API
Create `apps/api/src/routes/comments.ts`:
- GET /comments?meetingId=xxx - List comments for meeting
- POST /comments - Create comment (with mentions)
- PUT /comments/:id - Edit comment
- DELETE /comments/:id - Delete comment
- POST /comments/:id/resolve - Resolve/unresolve thread
- POST /comments/:id/reactions - Toggle reaction

### Annotations API
Create `apps/api/src/routes/annotations.ts`:
- GET /annotations?meetingId=xxx - List annotations
- POST /annotations - Create annotation
- PUT /annotations/:id - Edit annotation
- DELETE /annotations/:id - Delete annotation

### Sharing API
Create `apps/api/src/routes/sharing.ts`:
- GET /sharing/:meetingId - List shares for meeting
- POST /sharing - Share meeting with user/email
- DELETE /sharing/:id - Remove share
- POST /sharing/:meetingId/link - Generate shareable link

### Notifications API
Create `apps/api/src/routes/notifications.ts`:
- GET /notifications - List user's notifications
- POST /notifications/:id/read - Mark as read
- POST /notifications/read-all - Mark all as read
- GET /notifications/unread-count - Get unread count

### Activity API
Create `apps/api/src/routes/activity.ts`:
- GET /activity/team - Team activity feed
- GET /activity/meeting/:meetingId - Meeting activity

---

## Step 3: Create Services

### Real-time Service (`apps/api/src/services/realtimeService.ts`)
- Use Redis pub/sub
- publishEvent(channel, event, data)
- subscribeToChannel(channel, callback)
- Presence tracking for meetings

### Notification Service (`apps/api/src/services/notificationService.ts`)
- createNotification(params)
- Send in-app notification
- Send email notification (AWS SES)
- Check user preferences

### Activity Service (`apps/api/src/services/activityService.ts`)
- logActivity(params)
- getTeamActivity(orgId)
- getMeetingActivity(meetingId)

---

## Step 4: Create Middleware

### Meeting Access Middleware (`apps/api/src/middleware/meetingAccess.ts`)
```typescript
export async function checkMeetingAccess(
  userId: string,
  meetingId: string,
  requiredPermission: 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'ADMIN'
): Promise<boolean> {
  // Check if owner
  // Check if shared with user
  // Compare permission levels
}
```

---

## Step 5: Register Routes

Update `apps/api/src/routes/index.ts`:
```typescript
import commentsRouter from './comments';
import annotationsRouter from './annotations';
import sharingRouter from './sharing';
import notificationsRouter from './notifications';
import activityRouter from './activity';

router.use('/comments', commentsRouter);
router.use('/annotations', annotationsRouter);
router.use('/sharing', sharingRouter);
router.use('/notifications', notificationsRouter);
router.use('/activity', activityRouter);
```

---

## Step 6: Frontend Components

Create these in `apps/web/components/collaboration/`:

### CommentThread.tsx
- Display comment with replies
- Edit/delete own comments
- Reply functionality
- @mention display
- Emoji reactions
- Resolve thread button
- Timestamp linking

### CommentInput.tsx
- Textarea with @mention autocomplete
- Submit on Enter (Shift+Enter for newline)
- Loading state

### MentionInput.tsx
- Autocomplete for @mentions
- Search team members
- Display mention chips

### AnnotationHighlight.tsx
- Colored highlight on transcript
- Label badge
- Click to scroll to annotation

### AnnotationSidebar.tsx
- List all annotations
- Filter by label/author
- Click to jump to transcript position

### ShareDialog.tsx
- Share via email input
- Permission level dropdown
- Copy link button
- List current shares
- Remove share button

### PresenceAvatars.tsx
- Show who's viewing meeting
- Avatar stack with names on hover

### NotificationBell.tsx
- Bell icon with unread count
- Dropdown with recent notifications
- Mark as read
- "View all" link

### ActivityFeed.tsx
- Timeline of team activity
- Filter by meeting/user
- Infinite scroll

---

## Step 7: Integration

### Update Meeting Detail Page
- Add comments panel (sidebar or below transcript)
- Add annotation highlights to transcript
- Add share button in header
- Add presence indicators
- Connect to real-time updates

### Update Dashboard
- Add notifications dropdown to header
- Add activity feed widget

### Update Transcript Component
- Render annotation highlights
- Click segment to add comment at timestamp
- Show comment indicators on segments

---

## Step 8: Email Templates

Create email templates in `apps/api/src/email-templates/`:

### mention.tsx
- "{Name} mentioned you in a comment"
- Meeting title, comment preview
- "View comment" button

### share.tsx  
- "{Name} shared a meeting with you"
- Meeting title, permission level
- "View meeting" button

### reply.tsx
- "{Name} replied to your comment"
- Meeting title, reply preview
- "View reply" button

---

## Step 9: Real-time WebSocket (Optional)

If you want true real-time (not polling), add WebSocket:

```bash
pnpm add socket.io
```

Create `apps/api/src/websocket.ts`:
- Connect to Redis pub/sub
- Broadcast events to connected clients
- Handle room subscriptions (meeting rooms)

Frontend hook `useRealtimeUpdates.ts`:
- Connect to WebSocket
- Subscribe to meeting channel
- Update UI on events

---

## Step 10: Testing

Test each feature:
```bash
# Run API tests
cd apps/api
pnpm test

# Run E2E tests
pnpm exec playwright test e2e/collaboration.spec.ts
```

Manual testing checklist:
- [ ] Create comment on transcript
- [ ] Reply to comment
- [ ] Edit comment
- [ ] Delete comment
- [ ] @mention shows autocomplete
- [ ] @mentioned user gets notification
- [ ] @mentioned user gets email
- [ ] Emoji reaction works
- [ ] Resolve comment thread
- [ ] Create annotation
- [ ] Annotation shows on transcript
- [ ] Filter annotations
- [ ] Share meeting by email
- [ ] Shared user can access
- [ ] Permission levels enforced
- [ ] Generate share link
- [ ] Link expires correctly
- [ ] Notifications dropdown works
- [ ] Mark notification read
- [ ] Activity feed shows actions
- [ ] Real-time updates work

---

## Definition of Done

- [ ] All database models migrated
- [ ] All API routes working
- [ ] Comments with replies and reactions
- [ ] @mentions with notifications
- [ ] Annotations with labels and colors
- [ ] Sharing with permission levels
- [ ] Real-time updates via Redis
- [ ] Email notifications via AWS SES
- [ ] Activity tracking
- [ ] All UI components built
- [ ] Tests passing

---

## Files to Create

### API
- `apps/api/src/routes/comments.ts`
- `apps/api/src/routes/annotations.ts`
- `apps/api/src/routes/sharing.ts`
- `apps/api/src/routes/notifications.ts`
- `apps/api/src/routes/activity.ts`
- `apps/api/src/services/realtimeService.ts`
- `apps/api/src/services/notificationService.ts`
- `apps/api/src/services/activityService.ts`
- `apps/api/src/middleware/meetingAccess.ts`
- `apps/api/src/email-templates/mention.tsx`
- `apps/api/src/email-templates/share.tsx`
- `apps/api/src/email-templates/reply.tsx`

### Frontend
- `apps/web/components/collaboration/CommentThread.tsx`
- `apps/web/components/collaboration/CommentInput.tsx`
- `apps/web/components/collaboration/MentionInput.tsx`
- `apps/web/components/collaboration/AnnotationHighlight.tsx`
- `apps/web/components/collaboration/AnnotationSidebar.tsx`
- `apps/web/components/collaboration/ShareDialog.tsx`
- `apps/web/components/collaboration/PresenceAvatars.tsx`
- `apps/web/components/collaboration/NotificationBell.tsx`
- `apps/web/components/collaboration/ActivityFeed.tsx`
- `apps/web/hooks/useRealtimeUpdates.ts`
- `apps/web/hooks/useNotifications.ts`

---

## Begin Now

1. Add database models
2. Run migration
3. Create API routes
4. Create services
5. Create frontend components
6. Integrate into meeting page
7. Test everything

**DO NOT STOP until team collaboration is fully working.**

Go! 🚀
