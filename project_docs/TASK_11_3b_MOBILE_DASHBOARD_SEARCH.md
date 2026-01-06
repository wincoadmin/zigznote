# Task 11.3b: Mobile Responsiveness - Dashboard & Search Components

## Overview
Add Tailwind responsive breakpoints to dashboard and search components for mobile devices.

---

## File 1: StatsCards.tsx

**File:** `apps/web/components/dashboard/StatsCards.tsx`

### Grid layout
```tsx
// FIND
<div className="grid grid-cols-4 gap-4">

// REPLACE WITH
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
```

### Card padding
```tsx
// FIND
<Card key={stat.label} className="p-5">

// REPLACE WITH
<Card key={stat.label} className="p-3 sm:p-5">
```

### Icon and content row
```tsx
// FIND
<div className="flex items-center gap-3">

// REPLACE WITH
<div className="flex items-center gap-2 sm:gap-3">
```

### Icon container
```tsx
// FIND
<div className="p-2 rounded-lg bg-primary-50">
  <stat.icon className="h-5 w-5 text-primary-600" />

// REPLACE WITH
<div className="p-1.5 sm:p-2 rounded-lg bg-primary-50 shrink-0">
  <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
```

### Value text
```tsx
// FIND
<p className="text-2xl font-bold">{stat.value}</p>

// REPLACE WITH
<p className="text-lg sm:text-2xl font-bold truncate">{stat.value}</p>
```

### Label text
```tsx
// FIND
<p className="text-sm text-slate-500">{stat.label}</p>

// REPLACE WITH
<p className="text-xs sm:text-sm text-slate-500 truncate">{stat.label}</p>
```

### Content container
```tsx
// FIND
<div>
  <p className="text-2xl

// REPLACE WITH
<div className="min-w-0">
  <p className="text-lg sm:text-2xl
```

---

## File 2: RecentMeetings.tsx

**File:** `apps/web/components/dashboard/RecentMeetings.tsx`

### Card container
```tsx
// FIND
<Card className="p-6">

// REPLACE WITH
<Card className="p-3 sm:p-6">
```

### Heading
```tsx
// FIND
<h2 className="text-lg font-semibold mb-4">Recent Meetings</h2>

// REPLACE WITH
<h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Recent Meetings</h2>
```

### List spacing
```tsx
// FIND
<div className="space-y-4">

// REPLACE WITH
<div className="space-y-2 sm:space-y-4">
```

### Meeting item row
```tsx
// FIND
<div className="flex items-center gap-4 p-3

// REPLACE WITH
<div className="flex items-center gap-2 sm:gap-4 p-2 sm:p-3
```

### Meeting icon
```tsx
// FIND
<div className="p-2 rounded-lg bg-slate-100">
  <Video className="h-5 w-5

// REPLACE WITH
<div className="p-1.5 sm:p-2 rounded-lg bg-slate-100 shrink-0">
  <Video className="h-4 w-4 sm:h-5 sm:w-5
```

### Meeting title
```tsx
// FIND
<h3 className="font-medium

// REPLACE WITH
<h3 className="font-medium text-sm sm:text-base truncate
```

### Meeting time
```tsx
// FIND
<p className="text-sm text-slate-500">

// REPLACE WITH
<p className="text-xs sm:text-sm text-slate-500">
```

### Content container
```tsx
// FIND
<div className="flex-1">

// REPLACE WITH
<div className="flex-1 min-w-0">
```

---

## File 3: UpcomingMeetings.tsx

**File:** `apps/web/components/dashboard/UpcomingMeetings.tsx`

### Card container
```tsx
// FIND
<Card className="p-6">

// REPLACE WITH
<Card className="p-3 sm:p-6">
```

### Header row
```tsx
// FIND
<div className="flex items-center justify-between mb-4">
  <h2 className="text-lg font-semibold">Upcoming Meetings</h2>

// REPLACE WITH
<div className="flex items-center justify-between mb-3 sm:mb-4">
  <h2 className="text-base sm:text-lg font-semibold">Upcoming</h2>
```

### List spacing
```tsx
// FIND
<div className="space-y-3">

// REPLACE WITH
<div className="space-y-2 sm:space-y-3">
```

### Meeting item
```tsx
// FIND
<div key={meeting.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50">

// REPLACE WITH
<div key={meeting.id} className="flex items-center gap-2 sm:gap-4 p-2 sm:p-3 rounded-lg hover:bg-slate-50">
```

### Date box
```tsx
// FIND
<div className="text-center w-14">
  <p className="text-2xl font-bold">{meeting.day}</p>
  <p className="text-xs text-slate-500">{meeting.month}</p>

// REPLACE WITH
<div className="text-center w-10 sm:w-14 shrink-0">
  <p className="text-lg sm:text-2xl font-bold">{meeting.day}</p>
  <p className="text-[10px] sm:text-xs text-slate-500">{meeting.month}</p>
```

### Meeting title
```tsx
// FIND
<h3 className="font-medium">{meeting.title}</h3>

// REPLACE WITH
<h3 className="font-medium text-sm sm:text-base truncate">{meeting.title}</h3>
```

### Meeting time
```tsx
// FIND
<p className="text-sm text-slate-500">{meeting.time}</p>

// REPLACE WITH
<p className="text-xs sm:text-sm text-slate-500">{meeting.time}</p>
```

### Content container
```tsx
// FIND
<div className="flex-1">

// REPLACE WITH
<div className="flex-1 min-w-0">
```

---

## File 4: QuickActions.tsx

**File:** `apps/web/components/dashboard/QuickActions.tsx`

### Grid layout
```tsx
// FIND
<div className="grid grid-cols-3 gap-4">

// REPLACE WITH
<div className="grid grid-cols-3 gap-2 sm:gap-4">
```

### Action button
```tsx
// FIND
<Button
  key={action.label}
  variant="outline"
  className="flex flex-col items-center gap-2 h-24 p-4"
>
  <action.icon className="h-6 w-6" />
  <span className="text-sm">{action.label}</span>

// REPLACE WITH
<Button
  key={action.label}
  variant="outline"
  className="flex flex-col items-center gap-1 sm:gap-2 h-16 sm:h-24 p-2 sm:p-4"
>
  <action.icon className="h-4 w-4 sm:h-6 sm:w-6" />
  <span className="text-xs sm:text-sm text-center leading-tight">{action.label}</span>
```

---

## File 5: TimeSavedWidget.tsx

**File:** `apps/web/components/dashboard/TimeSavedWidget.tsx`

### Container
```tsx
// FIND
<Card className="p-6">

// REPLACE WITH
<Card className="p-3 sm:p-6">
```

### Heading
```tsx
// FIND
<h2 className="text-lg font-semibold

// REPLACE WITH
<h2 className="text-base sm:text-lg font-semibold
```

### Big number
```tsx
// FIND
<p className="text-4xl font-bold

// REPLACE WITH
<p className="text-2xl sm:text-4xl font-bold
```

### Label text
```tsx
// FIND
<p className="text-sm text-slate-500">

// REPLACE WITH
<p className="text-xs sm:text-sm text-slate-500">
```

---

## File 6: MeetingTrendsChart.tsx

**File:** `apps/web/components/dashboard/MeetingTrendsChart.tsx`

### Container
```tsx
// FIND
<Card className="p-6">

// REPLACE WITH
<Card className="p-3 sm:p-6">
```

### Heading
```tsx
// FIND
<h2 className="text-lg font-semibold mb-4">

// REPLACE WITH
<h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
```

### Chart height
```tsx
// FIND
<div className="h-64">

// REPLACE WITH
<div className="h-48 sm:h-64">
```

---

## File 7: ProductivityScore.tsx

**File:** `apps/web/components/dashboard/ProductivityScore.tsx`

### Container
```tsx
// FIND
<Card className="p-6">

// REPLACE WITH
<Card className="p-3 sm:p-6">
```

### Score display
```tsx
// FIND
<div className="text-5xl font-bold

// REPLACE WITH
<div className="text-3xl sm:text-5xl font-bold
```

### Label
```tsx
// FIND
<p className="text-sm text-slate-500">

// REPLACE WITH
<p className="text-xs sm:text-sm text-slate-500">
```

---

## File 8: AchievementsCard.tsx

**File:** `apps/web/components/dashboard/AchievementsCard.tsx`

### Container
```tsx
// FIND
<Card className="p-6">

// REPLACE WITH
<Card className="p-3 sm:p-6">
```

### Heading
```tsx
// FIND
<h2 className="text-lg font-semibold mb-4">

// REPLACE WITH
<h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
```

### Achievement items
```tsx
// FIND
<div className="flex items-center gap-3 p-3

// REPLACE WITH
<div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3
```

### Badge icon
```tsx
// FIND
className="h-8 w-8

// REPLACE WITH
className="h-6 w-6 sm:h-8 sm:w-8
```

### Achievement text
```tsx
// FIND
<span className="font-medium">

// REPLACE WITH
<span className="font-medium text-sm sm:text-base">
```

---

## File 9: SearchBar.tsx

**File:** `apps/web/components/search/SearchBar.tsx`

### Container
```tsx
// FIND
<div className="relative">

// Keep as is, but update inner elements:
```

### Search icon
```tsx
// FIND
<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />

// REPLACE WITH
<Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
```

### Input field
```tsx
// FIND
<Input
  className="pl-12 pr-4 h-12 text-lg"
  placeholder="Search meetings, transcripts, action items..."

// REPLACE WITH
<Input
  className="pl-10 sm:pl-12 pr-3 sm:pr-4 h-10 sm:h-12 text-sm sm:text-lg"
  placeholder="Search meetings..."
```

### Clear button (if exists)
```tsx
// FIND
<Button className="absolute right-2

// REPLACE WITH
<Button className="absolute right-1 sm:right-2 h-6 w-6 sm:h-8 sm:w-8
```

---

## File 10: SearchResults.tsx

**File:** `apps/web/components/search/SearchResults.tsx`

### Results container
```tsx
// FIND
<div className="space-y-4">

// REPLACE WITH
<div className="space-y-2 sm:space-y-4">
```

### Result card
```tsx
// FIND
<Card key={result.id} className="p-4 hover:shadow-md transition-shadow">

// REPLACE WITH
<Card key={result.id} className="p-3 sm:p-4 hover:shadow-md transition-shadow">
```

### Result content row
```tsx
// FIND
<div className="flex items-start gap-4">

// REPLACE WITH
<div className="flex items-start gap-2 sm:gap-4">
```

### Icon container
```tsx
// FIND
<div className="p-2 rounded-lg bg-slate-100">
  <result.icon className="h-5 w-5" />

// REPLACE WITH
<div className="p-1.5 sm:p-2 rounded-lg bg-slate-100 shrink-0">
  <result.icon className="h-4 w-4 sm:h-5 sm:w-5" />
```

### Result title
```tsx
// FIND
<h3 className="font-medium">{result.title}</h3>

// REPLACE WITH
<h3 className="font-medium text-sm sm:text-base truncate">{result.title}</h3>
```

### Result snippet
```tsx
// FIND
<p className="text-sm text-slate-500 mt-1">{result.snippet}</p>

// REPLACE WITH
<p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 line-clamp-2">{result.snippet}</p>
```

### Metadata row
```tsx
// FIND
<div className="flex items-center gap-4 mt-2 text-xs text-slate-400">

// REPLACE WITH
<div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-slate-400">
```

### Content container
```tsx
// FIND
<div className="flex-1">

// REPLACE WITH
<div className="flex-1 min-w-0">
```

---

## File 11: CrossMeetingSearch.tsx

**File:** `apps/web/components/chat/CrossMeetingSearch.tsx`

### Container
```tsx
// FIND
<div className="space-y-4">

// REPLACE WITH
<div className="space-y-3 sm:space-y-4">
```

### Search input area
```tsx
// FIND
<div className="flex gap-2">

// REPLACE WITH
<div className="flex flex-col sm:flex-row gap-2">
```

### Input
```tsx
// FIND
<Input className="flex-1" placeholder="Search across all meetings..."

// REPLACE WITH
<Input className="flex-1 text-sm" placeholder="Search all meetings..."
```

### Search button
```tsx
// FIND
<Button>
  <Search className="h-4 w-4 mr-2" />
  Search

// REPLACE WITH
<Button className="w-full sm:w-auto">
  <Search className="h-4 w-4 mr-2" />
  <span className="sm:inline">Search</span>
```

### Results
```tsx
// Apply same patterns as SearchResults.tsx above
```

---

## Verification Checklist

Test on Chrome DevTools with iPhone SE (375px):

- [ ] StatsCards: 2x2 grid on mobile, stats readable
- [ ] RecentMeetings: Cards stack, text truncates properly
- [ ] UpcomingMeetings: Date boxes smaller, text fits
- [ ] QuickActions: Buttons smaller but tappable (44px min)
- [ ] TimeSavedWidget: Numbers fit on screen
- [ ] MeetingTrendsChart: Chart visible, not cut off
- [ ] ProductivityScore: Score readable
- [ ] AchievementsCard: Badges visible
- [ ] SearchBar: Input usable, placeholder shorter
- [ ] SearchResults: Results readable, no horizontal scroll
- [ ] CrossMeetingSearch: Form stacks on mobile
