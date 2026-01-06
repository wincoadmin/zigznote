# Task 11.3a: Mobile Responsiveness - Chat & Meeting Components

## Overview
Add Tailwind responsive breakpoints to chat and meeting components so they work properly on mobile devices (375px - 768px).

**Pattern to follow:**
- Default styles = mobile (smaller)
- `sm:` breakpoint (640px+) = tablet/desktop (larger)

---

## File 1: ChatInterface.tsx

**File:** `apps/web/components/chat/ChatInterface.tsx`

Find and replace these patterns:

### Container padding
```tsx
// FIND
className={cn('flex flex-col h-full', className)}

// REPLACE WITH
className={cn('flex flex-col h-full', className)}
// Then find the messages container inside and update:

// FIND (messages area)
<div className="flex-1 overflow-y-auto p-4

// REPLACE WITH
<div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6
```

### Message bubbles
```tsx
// FIND
<div className="flex items-start gap-3">

// REPLACE WITH
<div className="flex items-start gap-2 sm:gap-3">
```

### Avatar size
```tsx
// FIND
className="w-8 h-8 rounded-full

// REPLACE WITH
className="w-6 h-6 sm:w-8 sm:h-8 rounded-full shrink-0
```

### Message text
```tsx
// FIND
<p className="text-slate-700

// REPLACE WITH
<p className="text-sm sm:text-base text-slate-700
```

### Citations section
```tsx
// FIND
<div className="mt-2 p-3 bg-slate-50 rounded-lg">

// REPLACE WITH
<div className="mt-2 p-2 sm:p-3 bg-slate-50 rounded-lg text-xs sm:text-sm">
```

### Suggested questions
```tsx
// FIND
<div className="flex flex-wrap gap-2">

// REPLACE WITH
<div className="flex flex-wrap gap-1.5 sm:gap-2">

// FIND (question buttons)
className="text-sm px-3 py-1.5

// REPLACE WITH
className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5
```

---

## File 2: ChatInput.tsx

**File:** `apps/web/components/chat/ChatInput.tsx`

### Input container
```tsx
// FIND
<div className="border-t border-slate-200 p-4">

// REPLACE WITH
<div className="border-t border-slate-200 p-2 sm:p-4">
```

### Textarea
```tsx
// FIND
className="flex-1 resize-none border rounded-lg p-3"

// REPLACE WITH
className="flex-1 resize-none border rounded-lg p-2 sm:p-3 text-sm sm:text-base"

// FIND
rows={3}

// REPLACE WITH
rows={2}
// And add className to parent to handle sm:
```

### Action buttons row
```tsx
// FIND
<div className="flex items-center gap-2 mt-2">

// REPLACE WITH
<div className="flex items-center gap-1.5 sm:gap-2 mt-2">
```

### Icon buttons
```tsx
// FIND
<Button size="icon">
  <Paperclip className="h-5 w-5" />

// REPLACE WITH
<Button size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
  <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />

// Same for Mic icon and Send icon
```

### Send button
```tsx
// FIND
<Button>
  <Send className="h-5 w-5" />

// REPLACE WITH
<Button className="h-8 sm:h-10 px-3 sm:px-4">
  <Send className="h-4 w-4 sm:h-5 sm:w-5" />
```

---

## File 3: AttachmentChip.tsx

**File:** `apps/web/components/chat/AttachmentChip.tsx`

```tsx
// FIND
<div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">

// REPLACE WITH
<div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-100 rounded-lg">

// FIND
<span className="text-sm truncate max-w-[200px]">

// REPLACE WITH
<span className="text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px]">

// FIND (file icon)
className="h-4 w-4

// REPLACE WITH
className="h-3 w-3 sm:h-4 sm:w-4

// FIND (remove button)
className="h-4 w-4

// REPLACE WITH
className="h-3 w-3 sm:h-4 sm:w-4
```

---

## File 4: InlineRecorder.tsx

**File:** `apps/web/components/chat/InlineRecorder.tsx`

```tsx
// FIND
<div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">

// REPLACE WITH
<div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-4 bg-red-50 rounded-lg">

// FIND (recording indicator dot)
<div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />

// REPLACE WITH
<div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse" />

// FIND
<span className="text-sm font-medium">Recording...</span>

// REPLACE WITH
<span className="text-xs sm:text-sm font-medium">Recording...</span>

// FIND (timer)
<span className="text-sm tabular-nums">

// REPLACE WITH
<span className="text-xs sm:text-sm tabular-nums">

// FIND (stop button)
<Button size="sm"

// REPLACE WITH
<Button size="sm" className="h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm"
```

---

## File 5: MeetingCard.tsx

**File:** `apps/web/components/meetings/MeetingCard.tsx`

### Card padding and layout
```tsx
// FIND
<div className="flex items-start gap-4 p-5 pl-6">

// REPLACE WITH
<div className="flex items-start gap-2 sm:gap-4 p-3 sm:p-5 pl-4 sm:pl-6">
```

### Platform icon container
```tsx
// FIND
<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"

// REPLACE WITH
<div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg"

// FIND
<Video className="h-6 w-6" />

// REPLACE WITH
<Video className="h-5 w-5 sm:h-6 sm:w-6" />
```

### Title and badge row
```tsx
// FIND
<div className="flex items-start justify-between gap-2">

// REPLACE WITH
<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2">
```

### Title link
```tsx
// FIND
className="font-medium text-slate-900 hover:text-primary-600 line-clamp-1"

// REPLACE WITH
className="font-medium text-sm sm:text-base text-slate-900 hover:text-primary-600 line-clamp-2 sm:line-clamp-1"
```

### Date/time text
```tsx
// FIND
<p className="mt-1 text-sm text-slate-500">

// REPLACE WITH
<p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500">
```

### Badge
```tsx
// FIND (Badge component)
<Badge className={`${status.bgColor} ${status.textColor} shrink-0`}>

// REPLACE WITH
<Badge className={`${status.bgColor} ${status.textColor} shrink-0 text-xs mt-1 sm:mt-0`}>
```

### Participants section
```tsx
// FIND
<div className="mt-3 flex items-center gap-2">

// REPLACE WITH
<div className="mt-2 sm:mt-3 flex items-center gap-2">
```

---

## File 6: TranscriptViewer.tsx

**File:** `apps/web/components/meetings/TranscriptViewer.tsx`

### Search header
```tsx
// FIND
<div className="sticky top-0 bg-white border-b p-4">

// REPLACE WITH
<div className="sticky top-0 bg-white dark:bg-slate-900 border-b p-2 sm:p-4 z-10">

// FIND
<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4

// REPLACE WITH
<Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400

// FIND
<Input className="pl-10" placeholder="Search transcript..."

// REPLACE WITH
<Input className="pl-8 sm:pl-10 text-sm" placeholder="Search..."
```

### Transcript container
```tsx
// FIND
<div className="p-4 space-y-4">

// REPLACE WITH
<div className="p-2 sm:p-4 space-y-2 sm:space-y-4">
```

### Segment styling
```tsx
// FIND
className={cn(
  'p-3 rounded-lg border-l-4 cursor-pointer transition-colors',

// REPLACE WITH
className={cn(
  'p-2 sm:p-3 rounded-lg border-l-2 sm:border-l-4 cursor-pointer transition-colors',
```

### Speaker row
```tsx
// FIND
<div className="flex items-center justify-between mb-2">

// REPLACE WITH
<div className="flex items-center justify-between mb-1 sm:mb-2">

// FIND
<span className="font-medium text-slate-900">{segment.speaker}</span>

// REPLACE WITH
<span className="font-medium text-xs sm:text-sm text-slate-900 truncate max-w-[60%]">
  {segment.speaker}
</span>

// FIND
<span className="text-xs text-slate-500">{formatTime(segment.startMs)}</span>

// REPLACE WITH
<span className="text-[10px] sm:text-xs text-slate-500 shrink-0">
  {formatTime(segment.startMs)}
</span>
```

### Segment text
```tsx
// FIND
<p className="text-slate-700">{segment.text}</p>

// REPLACE WITH
<p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{segment.text}</p>
```

---

## File 7: SummaryPanel.tsx

**File:** `apps/web/components/meetings/SummaryPanel.tsx`

### Container spacing
```tsx
// FIND
<div className="space-y-6">

// REPLACE WITH
<div className="space-y-4 sm:space-y-6">
```

### Section headings
```tsx
// FIND
<h3 className="text-lg font-semibold mb-3">

// REPLACE WITH
<h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">
```

### Paragraph text
```tsx
// FIND
<p className="text-slate-600">

// REPLACE WITH
<p className="text-sm sm:text-base text-slate-600 leading-relaxed">
```

### List items
```tsx
// FIND
<ul className="space-y-2">

// REPLACE WITH
<ul className="space-y-1.5 sm:space-y-2">

// FIND
<li className="flex items-start gap-2">

// REPLACE WITH
<li className="flex items-start gap-1.5 sm:gap-2 text-sm sm:text-base">
```

---

## File 8: ActionItems.tsx

**File:** `apps/web/components/meetings/ActionItems.tsx`

### List container
```tsx
// FIND
<div className="space-y-3">

// REPLACE WITH
<div className="space-y-2 sm:space-y-3">
```

### Action item card
```tsx
// FIND
<div key={item.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">

// REPLACE WITH
<div key={item.id} className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-50 rounded-lg">
```

### Checkbox alignment
```tsx
// FIND
<Checkbox checked={item.completed}

// REPLACE WITH
<Checkbox checked={item.completed} className="mt-0.5"
```

### Task text
```tsx
// FIND
<p className="text-slate-900">{item.task}</p>

// REPLACE WITH
<p className="text-sm sm:text-base text-slate-900">{item.task}</p>
```

### Metadata row
```tsx
// FIND
<div className="flex items-center gap-4 mt-2 text-sm text-slate-500">

// REPLACE WITH
<div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-500">
```

### Content container
```tsx
// FIND
<div className="flex-1">

// REPLACE WITH
<div className="flex-1 min-w-0">
```

---

## File 9: MeetingPlayer.tsx

**File:** `apps/web/components/meetings/MeetingPlayer.tsx`

### Player container
```tsx
// FIND
<div className="bg-slate-900 rounded-lg p-4">

// REPLACE WITH
<div className="bg-slate-900 rounded-lg p-2 sm:p-4">
```

### Controls row
```tsx
// FIND
<div className="flex items-center gap-4">

// REPLACE WITH
<div className="flex items-center gap-2 sm:gap-4">
```

### Play button
```tsx
// FIND
<Button size="icon" variant="ghost" className="text-white">
  <Play className="h-6 w-6" />

// REPLACE WITH
<Button size="icon" variant="ghost" className="text-white h-8 w-8 sm:h-10 sm:w-10">
  <Play className="h-4 w-4 sm:h-6 sm:w-6" />
```

### Progress bar
```tsx
// FIND
<div className="h-2 bg-slate-700 rounded-full">

// REPLACE WITH
<div className="h-1.5 sm:h-2 bg-slate-700 rounded-full">
```

### Time display
```tsx
// FIND
<span className="text-white text-sm">{formatTime(currentTime)}</span>

// REPLACE WITH
<span className="text-white text-xs sm:text-sm tabular-nums">{formatTime(currentTime)}</span>
```

### Volume and other controls
```tsx
// FIND (any additional icon buttons)
className="h-5 w-5"

// REPLACE WITH
className="h-4 w-4 sm:h-5 sm:w-5"
```

---

## Verification Checklist

Test on Chrome DevTools with iPhone SE (375px):

- [ ] ChatInterface: Messages readable, no horizontal overflow
- [ ] ChatInput: Input field usable, buttons tappable (44px min)
- [ ] AttachmentChip: Chips don't overflow, text truncates
- [ ] InlineRecorder: Recording UI fits on screen
- [ ] MeetingCard: Cards stack properly, text doesn't overflow
- [ ] TranscriptViewer: Segments readable, search usable
- [ ] SummaryPanel: Sections have proper spacing
- [ ] ActionItems: Checkboxes aligned, text wraps properly
- [ ] MeetingPlayer: Controls tappable, progress bar visible
