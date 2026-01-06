# Task 11.3c: Mobile Responsiveness - Settings, Audio, Onboarding & Global CSS

## Overview
Add Tailwind responsive breakpoints to settings, audio, onboarding components and global CSS utilities.

---

## File 1: NotificationSettings.tsx

**File:** `apps/web/components/settings/NotificationSettings.tsx`

### Container spacing
```tsx
// FIND
<div className="space-y-6">

// REPLACE WITH
<div className="space-y-4 sm:space-y-6">
```

### Setting row
```tsx
// FIND
<div className="flex items-center justify-between">

// REPLACE WITH
<div className="flex items-start sm:items-center justify-between gap-3">
```

### Label container
```tsx
// FIND
<div>
  <h4 className="font-medium">

// REPLACE WITH
<div className="flex-1 min-w-0">
  <h4 className="font-medium text-sm sm:text-base">
```

### Description text
```tsx
// FIND
<p className="text-sm text-slate-500">

// REPLACE WITH
<p className="text-xs sm:text-sm text-slate-500">
```

### Switch
```tsx
// FIND
<Switch />

// REPLACE WITH
<Switch className="shrink-0" />
```

---

## File 2: ShareDialog.tsx

**File:** `apps/web/components/settings/ShareDialog.tsx`

### Dialog content
```tsx
// FIND
<DialogContent className="max-w-md">

// REPLACE WITH
<DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md mx-4 sm:mx-auto">
```

### Dialog title
```tsx
// FIND
<DialogTitle>Share Meeting</DialogTitle>

// REPLACE WITH
<DialogTitle className="text-base sm:text-lg">Share Meeting</DialogTitle>
```

### Content padding
```tsx
// FIND
<div className="space-y-4 py-4">

// REPLACE WITH
<div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
```

### Email input row
```tsx
// FIND
<div className="flex gap-2">
  <Input placeholder="Enter email" className="flex-1" />
  <Button>Add</Button>

// REPLACE WITH
<div className="flex flex-col sm:flex-row gap-2">
  <Input placeholder="Enter email" className="flex-1 text-sm" />
  <Button className="w-full sm:w-auto">Add</Button>
```

### Shared users list
```tsx
// FIND
<div className="space-y-2">

// REPLACE WITH
<div className="space-y-2 max-h-48 overflow-y-auto">
```

### User row
```tsx
// FIND
<div className="flex items-center justify-between p-2

// REPLACE WITH
<div className="flex items-center justify-between p-2 gap-2
```

### User name
```tsx
// FIND
<span className="font-medium">

// REPLACE WITH
<span className="font-medium text-sm truncate">
```

### Permission select
```tsx
// FIND
<Select>

// REPLACE WITH
<Select className="w-24 sm:w-32 text-sm">
```

---

## File 3: ExportMenu.tsx

**File:** `apps/web/components/settings/ExportMenu.tsx`

### Dropdown content
```tsx
// FIND
<DropdownMenuContent>

// REPLACE WITH
<DropdownMenuContent className="w-48 sm:w-56">
```

### Menu items
```tsx
// FIND
<DropdownMenuItem>
  <FileText className="h-4 w-4 mr-2" />
  Export as PDF

// REPLACE WITH
<DropdownMenuItem className="text-sm">
  <FileText className="h-4 w-4 mr-2 shrink-0" />
  <span className="truncate">Export as PDF</span>
```

---

## File 4: UsageQuotaDisplay.tsx

**File:** `apps/web/components/settings/UsageQuotaDisplay.tsx`

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
<h3 className="text-lg font-semibold

// REPLACE WITH
<h3 className="text-base sm:text-lg font-semibold
```

### Progress labels
```tsx
// FIND
<div className="flex justify-between text-sm">

// REPLACE WITH
<div className="flex justify-between text-xs sm:text-sm">
```

### Usage numbers
```tsx
// FIND
<span className="font-medium">

// REPLACE WITH
<span className="font-medium text-sm sm:text-base">
```

---

## File 5: AudioUploader.tsx

**File:** `apps/web/components/audio/AudioUploader.tsx`

### Drop zone
```tsx
// FIND
<div className="border-2 border-dashed rounded-lg p-8 text-center">

// REPLACE WITH
<div className="border-2 border-dashed rounded-lg p-4 sm:p-8 text-center">
```

### Upload icon
```tsx
// FIND
<Upload className="mx-auto h-12 w-12 text-slate-400" />

// REPLACE WITH
<Upload className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-slate-400" />
```

### Main text
```tsx
// FIND
<p className="mt-4 text-lg font-medium">Drop audio file here</p>

// REPLACE WITH
<p className="mt-2 sm:mt-4 text-base sm:text-lg font-medium">Drop audio file here</p>
```

### Secondary text
```tsx
// FIND
<p className="mt-2 text-sm text-slate-500">or click to browse</p>

// REPLACE WITH
<p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-500">or tap to browse</p>
```

### File types text
```tsx
// FIND
<p className="mt-4 text-xs text-slate-400">MP3, WAV, M4A up to 500MB</p>

// REPLACE WITH
<p className="mt-2 sm:mt-4 text-[10px] sm:text-xs text-slate-400">MP3, WAV, M4A up to 500MB</p>
```

### Progress section (if uploading)
```tsx
// FIND
<div className="mt-4">

// REPLACE WITH
<div className="mt-3 sm:mt-4">
```

---

## File 6: BrowserRecorder.tsx

**File:** `apps/web/components/audio/BrowserRecorder.tsx`

### Container
```tsx
// FIND
<div className="flex flex-col items-center gap-6 p-8">

// REPLACE WITH
<div className="flex flex-col items-center gap-4 sm:gap-6 p-4 sm:p-8">
```

### Recording indicator circle
```tsx
// FIND
<div className="w-32 h-32 rounded-full bg-red-100 flex items-center justify-center">
  <Mic className="h-16 w-16 text-red-600" />

// REPLACE WITH
<div className="w-20 h-20 sm:w-32 sm:h-32 rounded-full bg-red-100 flex items-center justify-center">
  <Mic className="h-10 w-10 sm:h-16 sm:w-16 text-red-600" />
```

### Timer display
```tsx
// FIND
<p className="text-2xl font-bold tabular-nums">{formatTime(duration)}</p>

// REPLACE WITH
<p className="text-xl sm:text-2xl font-bold tabular-nums">{formatTime(duration)}</p>
```

### Status text
```tsx
// FIND
<p className="text-sm text-slate-500 mt-1">Recording...</p>

// REPLACE WITH
<p className="text-xs sm:text-sm text-slate-500 mt-1">Recording...</p>
```

### Button row
```tsx
// FIND
<div className="flex gap-4">
  <Button size="lg" variant="outline">Pause</Button>
  <Button size="lg" variant="destructive">Stop</Button>

// REPLACE WITH
<div className="flex gap-2 sm:gap-4">
  <Button variant="outline" className="h-10 sm:h-12 px-4 sm:px-6">Pause</Button>
  <Button variant="destructive" className="h-10 sm:h-12 px-4 sm:px-6">Stop</Button>
```

### Waveform visualization (if exists)
```tsx
// FIND
<div className="w-full h-16

// REPLACE WITH
<div className="w-full h-12 sm:h-16
```

---

## File 7: OnboardingWizard.tsx

**File:** `apps/web/components/onboarding/OnboardingWizard.tsx`

### Dialog content
```tsx
// FIND
<DialogContent className="max-w-lg">

// REPLACE WITH
<DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg mx-4 sm:mx-auto">
```

### Inner padding
```tsx
// FIND
<div className="p-6">

// REPLACE WITH
<div className="p-3 sm:p-6">
```

### Step indicators container
```tsx
// FIND
<div className="flex justify-between mb-8">

// REPLACE WITH
<div className="flex justify-between mb-4 sm:mb-8">
```

### Step circle
```tsx
// FIND
<div className={cn(
  'w-10 h-10 rounded-full flex items-center justify-center',

// REPLACE WITH
<div className={cn(
  'w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm',
```

### Step connector line
```tsx
// FIND
<div className="flex-1 h-1 mx-2

// REPLACE WITH
<div className="flex-1 h-0.5 sm:h-1 mx-1 sm:mx-2
```

### Step content heading
```tsx
// FIND
<h2 className="text-2xl font-bold mb-2">{currentStep.title}</h2>

// REPLACE WITH
<h2 className="text-lg sm:text-2xl font-bold mb-1 sm:mb-2">{currentStep.title}</h2>
```

### Step description
```tsx
// FIND
<p className="text-slate-600">{currentStep.description}</p>

// REPLACE WITH
<p className="text-sm sm:text-base text-slate-600">{currentStep.description}</p>
```

### Content area
```tsx
// FIND
<div className="text-center mb-8">

// REPLACE WITH
<div className="text-center mb-4 sm:mb-8">
```

### Navigation buttons
```tsx
// FIND
<div className="flex justify-between mt-8">

// REPLACE WITH
<div className="flex justify-between mt-4 sm:mt-8 gap-2">
```

### Buttons
```tsx
// FIND
<Button variant="outline">Back</Button>
<Button>Continue</Button>

// REPLACE WITH
<Button variant="outline" className="flex-1 sm:flex-none">Back</Button>
<Button className="flex-1 sm:flex-none">Continue</Button>
```

---

## File 8: WelcomeModal.tsx

**File:** `apps/web/components/onboarding/WelcomeModal.tsx`

### Dialog content
```tsx
// FIND
<DialogContent className="max-w-md">

// REPLACE WITH
<DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md mx-4 sm:mx-auto">
```

### Content padding
```tsx
// FIND
<div className="text-center py-6">

// REPLACE WITH
<div className="text-center py-4 sm:py-6">
```

### Icon container
```tsx
// FIND
<div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary-100">
  <Sparkles className="w-10 h-10 text-primary-600" />

// REPLACE WITH
<div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 rounded-full bg-primary-100 flex items-center justify-center">
  <Sparkles className="w-7 h-7 sm:w-10 sm:h-10 text-primary-600" />
```

### Title
```tsx
// FIND
<h2 className="text-2xl font-bold mb-2">Welcome to zigznote!</h2>

// REPLACE WITH
<h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Welcome to zigznote!</h2>
```

### Description
```tsx
// FIND
<p className="text-slate-600 mb-6">

// REPLACE WITH
<p className="text-sm sm:text-base text-slate-600 mb-4 sm:mb-6">
```

### CTA button
```tsx
// FIND
<Button size="lg">

// REPLACE WITH
<Button className="w-full sm:w-auto h-10 sm:h-12 px-6 sm:px-8">
```

---

## File 9: OnboardingChecklist.tsx

**File:** `apps/web/components/onboarding/OnboardingChecklist.tsx`

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
<h3 className="text-lg font-semibold mb-4">

// REPLACE WITH
<h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
```

### Checklist items
```tsx
// FIND
<div className="space-y-3">

// REPLACE WITH
<div className="space-y-2 sm:space-y-3">
```

### Item row
```tsx
// FIND
<div className="flex items-center gap-3 p-3

// REPLACE WITH
<div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3
```

### Checkbox icon
```tsx
// FIND
<div className="w-6 h-6

// REPLACE WITH
<div className="w-5 h-5 sm:w-6 sm:h-6 shrink-0
```

### Item text
```tsx
// FIND
<span className="font-medium">

// REPLACE WITH
<span className="font-medium text-sm sm:text-base">
```

---

## File 10: Sidebar.tsx

**File:** `apps/web/components/layout/Sidebar.tsx`

### Sidebar width
```tsx
// FIND
className={cn(
  'flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300',
  collapsed ? 'w-16' : 'w-64',

// REPLACE WITH
className={cn(
  'flex h-screen flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all duration-300',
  collapsed ? 'w-14 sm:w-16' : 'w-56 sm:w-64',
```

### Nav padding
```tsx
// FIND
<nav className="flex-1 px-3 py-4">

// REPLACE WITH
<nav className="flex-1 px-2 sm:px-3 py-3 sm:py-4">
```

### Nav list
```tsx
// FIND
<ul className="space-y-1">

// REPLACE WITH
<ul className="space-y-0.5 sm:space-y-1">
```

### Nav link
```tsx
// FIND
className={cn(
  'flex items-center gap-3 px-3 py-2 rounded-lg',

// REPLACE WITH
className={cn(
  'flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-sm',
```

### Nav icon
```tsx
// FIND
<item.icon className="h-5 w-5

// REPLACE WITH
<item.icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0
```

---

## File 11: MobileNav.tsx

**File:** `apps/web/components/layout/MobileNav.tsx`

### Container
```tsx
// FIND
<nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 lg:hidden">

// REPLACE WITH
<nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 lg:hidden z-40 pb-safe">
```

### Nav items container
```tsx
// FIND
<div className="flex justify-around py-2">

// REPLACE WITH
<div className="flex justify-around py-1.5">
```

### Nav item link
```tsx
// FIND
<Link
  key={item.href}
  href={item.href}
  className="flex flex-col items-center gap-1 p-2"
>
  <item.icon className="h-6 w-6" />
  <span className="text-xs">{item.label}</span>

// REPLACE WITH
<Link
  key={item.href}
  href={item.href}
  className={cn(
    'flex flex-col items-center gap-0.5 p-2 min-w-[60px] rounded-lg transition-colors',
    isActive ? 'text-primary-600 bg-primary-50' : 'text-slate-600'
  )}
>
  <item.icon className="h-5 w-5" />
  <span className="text-[10px] font-medium">{item.label}</span>
```

---

## File 12: Global CSS

**File:** `apps/web/app/globals.css`

Add these utilities after the existing `@tailwind` directives:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  /* Safe area for notched devices (iPhone X+) */
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }
  
  .pt-safe {
    padding-top: env(safe-area-inset-top);
  }
  
  .px-safe {
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }

  /* Touch-friendly tap targets (44px minimum per Apple HIG) */
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }

  /* Hide scrollbar but keep functionality */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  /* Smooth scrolling on iOS */
  .scroll-smooth-ios {
    -webkit-overflow-scrolling: touch;
  }
}

@layer base {
  /* Prevent text size adjustment on orientation change */
  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  /* Responsive base font size */
  html {
    font-size: 14px;
  }
  
  @screen sm {
    html {
      font-size: 16px;
    }
  }

  /* Improve tap highlight on mobile */
  * {
    -webkit-tap-highlight-color: transparent;
  }

  /* Better focus styles for touch */
  @media (hover: none) {
    button:focus,
    a:focus,
    input:focus,
    select:focus,
    textarea:focus {
      outline: 2px solid rgb(99 102 241 / 0.5);
      outline-offset: 2px;
    }
  }
}
```

---

## Verification Checklist

Test on Chrome DevTools with iPhone SE (375px):

**Settings:**
- [ ] NotificationSettings: Toggles aligned, text wraps
- [ ] ShareDialog: Modal fits screen, form stacks
- [ ] ExportMenu: Menu items readable
- [ ] UsageQuotaDisplay: Progress bar visible

**Audio:**
- [ ] AudioUploader: Drop zone fits, text readable
- [ ] BrowserRecorder: Recording UI centered, buttons tappable

**Onboarding:**
- [ ] OnboardingWizard: Step indicators smaller, content fits
- [ ] WelcomeModal: Modal doesn't overflow, CTA tappable
- [ ] OnboardingChecklist: Items have proper spacing

**Layout:**
- [ ] Sidebar: Narrower on mobile, icons still visible
- [ ] MobileNav: Bottom nav has safe area padding, items tappable

**Global:**
- [ ] Safe area padding works on notched devices
- [ ] Base font size smaller on mobile
- [ ] No horizontal scroll on any page
