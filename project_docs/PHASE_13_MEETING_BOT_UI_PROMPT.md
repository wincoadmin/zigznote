# Phase 13: Meeting Bot UI Implementation

## Mission
Connect the existing Recall.ai backend to the frontend. Users must be able to paste meeting links, deploy bots, view real calendar data, and auto-record scheduled meetings. **DO NOT STOP until all features work.**

---

## Rules
1. **Do NOT ask for permission** - just build and continue
2. **Do NOT stop** until all features work
3. **Backend already works** - focus on frontend + minor API additions
4. **Test each feature** before moving on

---

## Current State

**Backend (DONE):**
- ✅ `POST /api/v1/meetings` - Create meeting with URL
- ✅ `POST /api/v1/meetings/:id/bot` - Deploy bot
- ✅ `GET /api/v1/meetings/:id/bot` - Get bot status
- ✅ `DELETE /api/v1/meetings/:id/bot` - Stop bot
- ✅ `recallService.ts` - Full Recall.ai integration
- ✅ Google Calendar OAuth

**Frontend (MISSING):**
- ❌ Paste meeting link UI
- ❌ Send bot button
- ❌ Real calendar data
- ❌ Auto-record toggle

---

## Step 1: Meeting Link Input Component

Create `apps/web/components/meetings/MeetingLinkInput.tsx`:

**Features:**
- Text input for meeting URL
- Auto-detect platform (Zoom, Meet, Teams, Webex)
- Show platform badge when detected
- Optional title input
- "Send Bot Now" button → creates meeting + deploys bot immediately
- "Schedule Bot" button → shows date/time picker, bot joins at scheduled time
- "Save for Later" button → creates meeting only
- Loading states
- Error handling

**URL Detection:**
```typescript
function detectPlatform(url: string): 'zoom' | 'meet' | 'teams' | 'webex' | 'other' {
  const lower = url.toLowerCase();
  if (lower.includes('zoom.us')) return 'zoom';
  if (lower.includes('meet.google.com')) return 'meet';
  if (lower.includes('teams.microsoft.com')) return 'teams';
  if (lower.includes('webex.com')) return 'webex';
  return 'other';
}
```

**API Calls:**
```typescript
// Create meeting
const response = await fetch('/api/meetings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: title || `${platform} Meeting`,
    meetingUrl: url,
    platform: platform,
    startTime: scheduledTime, // Optional - when bot should join
  }),
});

// Deploy bot (immediate or scheduled)
await fetch(`/api/meetings/${meetingId}/bot`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    joinAt: scheduledTime, // If provided, Recall.ai schedules bot to join at this time
  }),
});
```

**Schedule Bot Flow:**
1. User pastes meeting URL
2. Clicks "Schedule Bot"
3. Date/time picker appears
4. User selects when bot should join
5. Bot is deployed with `joinAt` parameter
6. Recall.ai handles the scheduled join automatically

---

## Step 2: Update New Meeting Page

Update `apps/web/app/(dashboard)/meetings/new/page.tsx`:

**Add third tab:**
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList className="mb-6 grid grid-cols-3">
    <TabsTrigger value="link">Join Meeting</TabsTrigger>
    <TabsTrigger value="upload">Upload Audio</TabsTrigger>
    <TabsTrigger value="record">Record Live</TabsTrigger>
  </TabsList>

  <TabsContent value="link">
    <MeetingLinkInput onMeetingCreated={handleComplete} />
  </TabsContent>
  
  {/* existing tabs */}
</Tabs>
```

---

## Step 3: Bot Status Component

Create `apps/web/components/meetings/BotStatus.tsx`:

**Features:**
- Show current bot status (joining, in_call, recording, ended, error)
- Animated indicators for active states
- "Stop" button to stop recording
- Real-time updates via WebSocket

**Status Types:**
```typescript
type BotStatus = 'none' | 'ready' | 'joining' | 'waiting_room' | 'in_call' | 'recording' | 'leaving' | 'ended' | 'error';
```

**WebSocket Integration:**
```typescript
const { lastMessage } = useWebSocket(`meeting:${meetingId}`);

useEffect(() => {
  if (lastMessage?.event === 'bot:status') {
    setStatus(lastMessage.data.status);
  }
}, [lastMessage]);
```

---

## Step 4: Update Meeting Detail Page

Update `apps/web/app/(dashboard)/meetings/[id]/page.tsx`:

**Add bot controls:**
```tsx
{meeting.meetingUrl && (
  <div className="mb-6">
    {meeting.botId ? (
      <BotStatus meetingId={meeting.id} />
    ) : meeting.status === 'scheduled' ? (
      <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
        <Video className="w-5 h-5 text-blue-600" />
        <div className="flex-1">
          <p className="text-sm font-medium">Ready to record</p>
        </div>
        <Button onClick={handleSendBot}>
          <Send className="w-4 h-4 mr-2" />
          Send Bot
        </Button>
      </div>
    ) : null}
  </div>
)}
```

---

## Step 5: Calendar API Endpoints

Add to `apps/api/src/routes/calendar.ts`:

**GET /calendar/status:**
```typescript
router.get('/status', requireAuth, async (req, res) => {
  const connection = await calendarRepository.findByUserId(userId);
  res.json({
    connection: connection ? {
      id: connection.id,
      provider: connection.provider,
      email: connection.email,
      autoRecord: connection.autoRecord || false,
    } : null,
  });
});
```

**GET /calendar/events:**
```typescript
router.get('/events', requireAuth, async (req, res) => {
  const { start, end } = req.query;
  const events = await googleCalendarService.getEvents(connection, start, end);
  
  // Add meeting info if exists
  const enrichedEvents = await Promise.all(
    events.map(async (event) => {
      const meeting = await meetingRepository.findByCalendarEventId(event.id);
      return {
        ...event,
        meetingId: meeting?.id,
        botStatus: meeting?.botId ? await getBotStatus(meeting.botId) : null,
      };
    })
  );
  
  res.json({ events: enrichedEvents });
});
```

**PUT /calendar/auto-record:**
```typescript
router.put('/auto-record', requireAuth, async (req, res) => {
  const { enabled } = req.body;
  await calendarRepository.updateByUserId(userId, { autoRecord: enabled });
  res.json({ success: true });
});
```

---

## Step 6: Database Updates

Add to CalendarConnection model:
```prisma
model CalendarConnection {
  // existing fields...
  autoRecord    Boolean   @default(false) @map("auto_record")
}
```

Add to Meeting model:
```prisma
model Meeting {
  // existing fields...
  calendarEventId String?   @map("calendar_event_id")
  
  @@index([calendarEventId])
}
```

Run migration:
```bash
cd packages/database
pnpm prisma migrate dev --name add_calendar_auto_record
```

---

## Step 7: Real Calendar Page

Replace `apps/web/app/calendar/page.tsx`:

**Features:**
- Show "Connect Calendar" if not connected
- Fetch real events from Google Calendar
- Display events on calendar grid
- Selected day sidebar with meeting details
- "Record" button on each meeting with a URL
- Auto-record toggle
- Sync button
- Real-time bot status on events

**Key Components:**
```tsx
// Connection check
const { data: connection } = useQuery({
  queryKey: ['calendar-connection'],
  queryFn: () => fetch('/api/calendar/status').then(r => r.json()),
});

// Events fetch
const { data: events } = useQuery({
  queryKey: ['calendar-events', year, month],
  queryFn: () => fetch(`/api/calendar/events?start=${start}&end=${end}`).then(r => r.json()),
  enabled: !!connection,
});

// Send bot to event
const sendBot = useMutation({
  mutationFn: async (event) => {
    // Create meeting if needed
    // Deploy bot
  },
});
```

---

## Step 8: Auto-Record Worker

Create `apps/api/src/jobs/autoRecordWorker.ts`:

**Logic:**
1. Run every 5 minutes
2. Find all CalendarConnections with autoRecord=true
3. For each, get events starting in next 10 minutes
4. For events with meeting URLs and no bot yet:
   - Create meeting record
   - Deploy bot (scheduled join)

```typescript
const autoRecordWorker = new Worker('auto-record', async () => {
  const connections = await prisma.calendarConnection.findMany({
    where: { autoRecord: true },
  });

  const now = new Date();
  const lookahead = new Date(now.getTime() + 10 * 60 * 1000);

  for (const connection of connections) {
    const events = await googleCalendarService.getEvents(connection, now, lookahead);
    
    for (const event of events) {
      if (!event.meetingLink) continue;
      
      const existing = await meetingRepository.findByCalendarEventId(event.id);
      if (existing?.botId) continue;
      
      // Create meeting and deploy bot
      const meeting = await createMeeting(event);
      await recallService.createBot({
        meetingId: meeting.id,
        meetingUrl: event.meetingLink,
        joinAt: event.start,
      });
    }
  }
});
```

Register in `apps/api/src/jobs/index.ts`:
```typescript
import { autoRecordWorker, scheduleAutoRecordCheck } from './autoRecordWorker';
export { autoRecordWorker, scheduleAutoRecordCheck };

// In startup
scheduleAutoRecordCheck();
```

---

## Step 9: Export Updates

Update `apps/web/components/meetings/index.ts`:
```typescript
export * from './MeetingLinkInput';
export * from './BotStatus';
```

---

## Step 10: Testing

**Manual tests:**
1. Go to /meetings/new
2. Paste `https://zoom.us/j/123456789` → Should show "Zoom" badge
3. Click "Send Bot Now" → Should create meeting and deploy bot immediately
4. Test "Schedule Bot" → Should show date/time picker
5. Set future date/time and confirm → Bot should be scheduled
6. Go to meeting detail → Should show "Scheduled for [date/time]"
7. Can cancel scheduled bot from meeting detail page
8. Go to /calendar → Should prompt to connect if not connected
9. Connect Google Calendar → Should show real events
10. Click "Record" on an event → Should deploy bot
11. Toggle auto-record → Should persist setting
12. Wait for upcoming meeting → Bot should auto-join

---

## Files to Create/Update

**Create:**
- `apps/web/components/meetings/MeetingLinkInput.tsx`
- `apps/web/components/meetings/BotStatus.tsx`
- `apps/api/src/jobs/autoRecordWorker.ts`

**Update:**
- `apps/web/app/(dashboard)/meetings/new/page.tsx`
- `apps/web/app/(dashboard)/meetings/[id]/page.tsx`
- `apps/web/app/calendar/page.tsx`
- `apps/api/src/routes/calendar.ts`
- `apps/web/components/meetings/index.ts`
- `packages/database/prisma/schema.prisma`

---

## Definition of Done

- [ ] Can paste Zoom/Meet/Teams links
- [ ] Platform auto-detected and displayed
- [ ] "Send Bot Now" works (immediate join)
- [ ] "Schedule Bot" works (date/time picker, bot joins at specified time)
- [ ] Bot status shows in meeting detail (including scheduled status)
- [ ] Can stop/cancel bot from UI
- [ ] Calendar shows real Google Calendar events
- [ ] Can record individual calendar events
- [ ] Auto-record toggle works
- [ ] Auto-record worker deploys bots to upcoming meetings

---

## Begin Now

1. Create MeetingLinkInput component
2. Update new meeting page with third tab
3. Create BotStatus component
4. Update meeting detail page
5. Add calendar API endpoints
6. Update database schema
7. Replace calendar page
8. Create auto-record worker
9. Test everything

**DO NOT STOP until users can paste links and send bots!**

Go! 🚀
