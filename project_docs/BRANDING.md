# 🎨 zigznote Brand Identity Guide

This document defines the complete brand identity for **zigznote**. Claude Code will use these specifications to create a cohesive, polished, and psychologically engaging UI.

---

## 1. App Name & Identity

### App Name
```
Name: zigznote
```

### Tagline Options (Choose one or let Claude Code pick contextually)
```
Primary: "Your meetings, simplified"
Alternative 1: "From conversation to action"
Alternative 2: "Never miss what matters"
Alternative 3: "Smart notes for busy teams"
```

### Brand Story
zigznote transforms chaotic meetings into clear, actionable insights. The name suggests the "zig-zag" journey of conversations distilled into organized notes — capturing every turn of discussion and straightening it into clarity.

---

## 2. Brand Personality

### Core Attributes
```
✓ Modern — Clean, current, forward-thinking design
✓ Polished — High attention to detail, premium feel
✓ Trustworthy — Reliable, secure, professional
✓ Approachable — Friendly without being casual
✓ Efficient — Respects user's time, clear purpose
```

### Brand Voice
```
Style: Professional yet friendly

DO:
- "Your meeting notes are ready" ✓
- "We've captured 5 action items" ✓
- "Great meeting! Here's what we found" ✓

DON'T:
- "Yo! Your notes dropped" ✗
- "Meeting processed successfully" ✗ (too robotic)
- "Awesome sauce! Check these notes" ✗ (too casual)
```

---

## 3. Color Palette

### Primary Colors (Based on reference image green)
```css
/* Primary Green - Main brand color */
--color-primary-50:  #ECFDF5;   /* Lightest - backgrounds */
--color-primary-100: #D1FAE5;   /* Light - hover states */
--color-primary-200: #A7F3D0;   /* Light - borders, tags */
--color-primary-300: #6EE7B7;   /* Medium light - secondary elements */
--color-primary-400: #34D399;   /* Medium - icons, accents */
--color-primary-500: #10B981;   /* BASE PRIMARY - buttons, links */
--color-primary-600: #059669;   /* Dark - hover on primary */
--color-primary-700: #047857;   /* Darker - active states */
--color-primary-800: #065F46;   /* Very dark - text on light */
--color-primary-900: #064E3B;   /* Darkest - high contrast */
```

### Secondary Colors (Complementary)
```css
/* Teal - For variety and depth */
--color-secondary-400: #2DD4BF;
--color-secondary-500: #14B8A6;
--color-secondary-600: #0D9488;

/* Emerald - For premium accents */
--color-accent-400: #4ADE80;
--color-accent-500: #22C55E;
--color-accent-600: #16A34A;
```

### Neutral Colors
```css
/* Slate - For text and UI elements */
--color-neutral-50:  #F8FAFC;   /* Page background */
--color-neutral-100: #F1F5F9;   /* Card backgrounds, inputs */
--color-neutral-200: #E2E8F0;   /* Borders, dividers */
--color-neutral-300: #CBD5E1;   /* Disabled states */
--color-neutral-400: #94A3B8;   /* Placeholder text */
--color-neutral-500: #64748B;   /* Secondary text */
--color-neutral-600: #475569;   /* Body text */
--color-neutral-700: #334155;   /* Headings */
--color-neutral-800: #1E293B;   /* Primary text */
--color-neutral-900: #0F172A;   /* High emphasis text */
```

### Semantic Colors
```css
/* Status colors */
--color-success: #10B981;       /* Same as primary - consistency */
--color-warning: #F59E0B;       /* Amber */
--color-error:   #EF4444;       /* Red */
--color-info:    #3B82F6;       /* Blue */

/* Meeting status specific */
--color-scheduled: #64748B;     /* Slate - upcoming */
--color-recording: #EF4444;     /* Red - live indicator */
--color-processing: #F59E0B;    /* Amber - in progress */
--color-completed: #10B981;     /* Green - done */
```

### Gradient (For backgrounds and premium elements)
```css
/* Primary gradient - hero sections, premium cards */
--gradient-primary: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 50%, #6EE7B7 100%);

/* Subtle gradient - card backgrounds */
--gradient-subtle: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);

/* Mesh gradient - onboarding, empty states */
--gradient-mesh: radial-gradient(at 40% 20%, #D1FAE5 0px, transparent 50%),
                 radial-gradient(at 80% 0%, #A7F3D0 0px, transparent 50%),
                 radial-gradient(at 0% 50%, #ECFDF5 0px, transparent 50%);
```

---

## 4. Typography

### Font Stack
```css
/* Headings - Modern geometric sans */
--font-heading: 'Plus Jakarta Sans', system-ui, sans-serif;

/* Body - Highly readable */
--font-body: 'Inter', system-ui, sans-serif;

/* Mono - For transcripts, timestamps */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Font Sizes (Fluid scale)
```css
--text-xs:   0.75rem;    /* 12px - Labels, captions */
--text-sm:   0.875rem;   /* 14px - Secondary text */
--text-base: 1rem;       /* 16px - Body text */
--text-lg:   1.125rem;   /* 18px - Large body */
--text-xl:   1.25rem;    /* 20px - Card titles */
--text-2xl:  1.5rem;     /* 24px - Section headings */
--text-3xl:  1.875rem;   /* 30px - Page titles */
--text-4xl:  2.25rem;    /* 36px - Hero text */
--text-5xl:  3rem;       /* 48px - Dashboard stats */
```

### Font Weights
```css
--font-normal:   400;    /* Body text */
--font-medium:   500;    /* Emphasis, buttons */
--font-semibold: 600;    /* Subheadings */
--font-bold:     700;    /* Headings, stats */
```

---

## 5. Visual Style

### Border Radius
```css
/* Rounded but professional - matches reference image */
--radius-sm:   6px;      /* Small elements - tags, badges */
--radius-md:   8px;      /* Buttons, inputs */
--radius-lg:   12px;     /* Cards, modals */
--radius-xl:   16px;     /* Large cards, images */
--radius-2xl:  24px;     /* Hero sections, feature cards */
--radius-full: 9999px;   /* Pills, avatars */
```

### Shadows (Soft, layered - from reference)
```css
/* Subtle elevation system */
--shadow-xs:  0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-sm:  0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
--shadow-md:  0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg:  0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl:  0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);

/* Colored shadow for primary elements */
--shadow-primary: 0 4px 14px 0 rgb(16 185 129 / 0.25);
--shadow-primary-lg: 0 10px 40px 0 rgb(16 185 129 / 0.3);
```

### Spacing Scale
```css
/* Comfortable density - not too cramped, not too loose */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### Icons
```
Style: Outlined (Lucide React)
Stroke Width: 1.5px (slightly lighter than default for elegance)
Size Default: 20px
Size Small: 16px
Size Large: 24px
```

---

## 6. Component Specifications

### Buttons
```css
/* Primary Button */
.btn-primary {
  background: var(--color-primary-500);
  color: white;
  font-weight: 500;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-primary);
  transition: all 0.2s ease;
}
.btn-primary:hover {
  background: var(--color-primary-600);
  transform: translateY(-1px);
  box-shadow: var(--shadow-primary-lg);
}

/* Secondary Button */
.btn-secondary {
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  border: 1px solid var(--color-primary-200);
}

/* Ghost Button */
.btn-ghost {
  background: transparent;
  color: var(--color-neutral-600);
}
.btn-ghost:hover {
  background: var(--color-neutral-100);
}
```

### Cards (Matching reference image style)
```css
.card {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-neutral-100);
  padding: var(--space-6);
  transition: all 0.2s ease;
}
.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
.card-highlighted {
  border-left: 4px solid var(--color-primary-500);
}
```

### Inputs
```css
.input {
  background: var(--color-neutral-50);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: var(--text-base);
  transition: all 0.2s ease;
}
.input:focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
  outline: none;
}
```

### Tags/Badges
```css
.tag {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
  font-size: var(--text-xs);
  font-weight: 500;
  padding: 4px 10px;
  border-radius: var(--radius-full);
}
.tag-neutral {
  background: var(--color-neutral-100);
  color: var(--color-neutral-600);
}
```

### Progress Indicators (For retention)
```css
.progress-bar {
  background: var(--color-neutral-200);
  border-radius: var(--radius-full);
  height: 8px;
  overflow: hidden;
}
.progress-fill {
  background: linear-gradient(90deg, var(--color-primary-400), var(--color-primary-500));
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.5s ease;
}
```

---

## 7. Dark Mode

```
Mode: Both light and dark with system preference detection
```

### Dark Mode Colors
```css
.dark {
  --color-background:    #0F172A;   /* Slate 900 */
  --color-surface:       #1E293B;   /* Slate 800 */
  --color-surface-hover: #334155;   /* Slate 700 */
  --color-border:        #334155;   /* Slate 700 */
  
  --color-text-primary:   #F8FAFC;  /* Slate 50 */
  --color-text-secondary: #94A3B8;  /* Slate 400 */
  --color-text-muted:     #64748B;  /* Slate 500 */
  
  /* Primary stays vibrant */
  --color-primary-500: #34D399;     /* Slightly lighter for dark mode */
}
```

---

## 8. Motion & Animation

### Animation Preferences
```
Style: Moderate - Smooth transitions with delightful micro-interactions
Purpose: Enhance usability and create moments of delight
```

### Timing Functions
```css
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);     /* Smooth */
--ease-in:      cubic-bezier(0.4, 0, 1, 1);       /* Accelerate */
--ease-out:     cubic-bezier(0, 0, 0.2, 1);       /* Decelerate */
--ease-bounce:  cubic-bezier(0.68, -0.55, 0.265, 1.55); /* Playful */
```

### Durations
```css
--duration-fast:   150ms;   /* Hover states, toggles */
--duration-normal: 200ms;   /* Most transitions */
--duration-slow:   300ms;   /* Page transitions, modals */
--duration-slower: 500ms;   /* Complex animations */
```

### Key Animations
```css
/* Fade in up - for cards, list items */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scale in - for modals, popovers */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Pulse - for live recording indicator */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Shimmer - for loading skeletons */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Check mark draw - for completing action items */
@keyframes checkDraw {
  to { stroke-dashoffset: 0; }
}

/* Confetti burst - for achievements (subtle) */
@keyframes confetti {
  0% { transform: scale(0) rotate(0deg); opacity: 1; }
  100% { transform: scale(1) rotate(180deg); opacity: 0; }
}
```

### Interactive Animations
```
✓ Button press: Scale down to 0.98 on click
✓ Card hover: Lift up 2px with shadow increase
✓ Toggle switch: Smooth slide with bounce ease
✓ Checkbox: Check mark draws in
✓ Success toast: Slides in from top with bounce
✓ Loading: Skeleton shimmer effect
✓ Page transition: Fade with subtle slide
✓ List items: Staggered fade-in on load
✓ Numbers: Count up animation for stats
✓ Progress: Smooth fill animation
```

---

## 9. Psychological Retention Patterns

### Progress & Achievement
```
✓ Meeting streak counter - "5 meetings captured this week 🔥"
✓ Progress bar showing weekly goal completion
✓ Milestone celebrations (10th meeting, 100th action item)
✓ "You've saved X hours this month" metric
```

### Loss Aversion
```
✓ "Don't lose your streak!" reminder notification
✓ Calendar gaps highlighted - "2 meetings without notes"
✓ Incomplete action items counter in sidebar
```

### Variable Rewards
```
✓ AI insights that vary per meeting - "Interesting: You asked 40% more questions today"
✓ Weekly summary emails with surprising stats
✓ Occasional "tip of the day" in dashboard
```

### Social Proof
```
✓ Team activity feed - "Sarah just completed 3 action items"
✓ "Most active team member this week" (optional)
✓ Shared meeting notes indicator
```

### Commitment & Consistency
```
✓ Onboarding asks for meeting goals
✓ "You said you wanted to improve follow-ups" personalized prompts
✓ Weekly reflection prompts
```

### Micro-Interactions for Delight
```
✓ Satisfying "pop" when completing action items
✓ Smooth animations when notes appear
✓ Celebratory moment when all action items complete
✓ Typing indicator when AI is generating summary
```

### Visual Implementation
```css
/* Streak badge */
.streak-badge {
  background: linear-gradient(135deg, #FCD34D, #F59E0B);
  color: white;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  animation: pulse 2s infinite;
}

/* Achievement toast */
.achievement-toast {
  background: linear-gradient(135deg, var(--color-primary-500), var(--color-secondary-500));
  color: white;
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-xl);
}

/* Stat counter with animation */
.stat-number {
  font-size: var(--text-5xl);
  font-weight: 700;
  color: var(--color-primary-600);
  /* Animate counting up */
}
```

---

## 10. Logo Specification

### Logo Requirements for Claude Code
```
Generate a logo for "zigznote" with the following characteristics:

Concept:
- The "zig" represents the chaotic nature of conversations
- The "note" represents the organized output
- Visual should suggest transformation from chaos to clarity

Style:
- Modern, minimal, geometric
- Works at small sizes (favicon) and large (hero)
- Single color version must work

Visual Ideas (choose one approach):
1. Abstract "Z" that flows into a note/document shape
2. Sound wave that transforms into organized lines
3. Two "Z" shapes interlocking like a conversation
4. Stylized notepad with a zigzag binding

Colors:
- Primary: #10B981 (primary green)
- Can use gradient from #34D399 to #10B981
- White version for dark backgrounds

Technical Requirements:
- SVG format
- Minimum size: 32x32px (favicon)
- Square aspect ratio for icon mark
- Horizontal lockup for full logo (icon + wordmark)

Wordmark Typography:
- Font: Plus Jakarta Sans Bold
- "zig" in primary green
- "note" in slate-700 (#334155)
- All lowercase for modern feel
```

### Logo Placement
```
/apps/web/public/
├── logo.svg              # Full horizontal logo (icon + wordmark)
├── logo-dark.svg         # White version for dark backgrounds
├── icon.svg              # Square icon mark only
├── favicon.ico           # 32x32 favicon
├── apple-touch-icon.png  # 180x180 for iOS
└── og-image.png          # 1200x630 for social sharing
```

---

## 11. Application-Specific UI Patterns

### Dashboard (First Impression)
```
Layout: Card-based grid (reference image style)
Key Elements:
- Large stat cards with animated numbers
- Meeting activity chart (line or bar)
- Upcoming meetings list
- Quick action buttons

Visual Treatment:
- Subtle gradient background
- Cards with soft shadows
- Progress indicators prominent
- Green accents for positive metrics
```

### Meeting Detail (Most Used)
```
Layout: Three-panel (player | transcript | summary)
Key Elements:
- Floating player that can minimize
- Transcript with speaker colors
- Collapsible summary panel
- Action items with checkboxes

Visual Treatment:
- Clean white background for transcript readability
- Colored speaker labels (auto-assigned from palette)
- Sticky action items header
- Smooth scroll sync with player
```

### Mobile App
```
Navigation: Bottom tab bar (like reference image)
Tabs: Home | Meetings | Record | Search | Settings

Visual Treatment:
- Cards stack vertically
- Large touch targets (min 44px)
- Pull-to-refresh
- Swipe actions on meeting cards
```

---

## 12. Accessibility

```
Standard: WCAG 2.1 AA compliance

Requirements:
✓ Color contrast ratio minimum 4.5:1 for text
✓ Focus indicators visible and clear
✓ All interactions keyboard accessible
✓ Screen reader friendly labels
✓ Reduced motion option respected
✓ Text scalable to 200%
```

---

## 13. Reference & Inspiration

### Design Inspiration
```
1. Reference Image (uploaded) - Card-based layout, soft shadows, clean stats
2. Linear - Minimal, keyboard-first, smooth animations
3. Notion - Clean typography, content-focused
4. Fathom - Meeting-specific, simple, trustworthy
5. Stripe Dashboard - Data visualization, polished feel
```

### What to Capture
```
From Reference Image:
✓ Card-based layout with rounded corners
✓ Soft drop shadows
✓ Clean data visualizations (charts, progress)
✓ Bottom navigation on mobile
✓ Large, bold stat numbers
✓ Consistent icon style
✓ Light, airy feel with plenty of whitespace

From Linear:
✓ Keyboard shortcuts
✓ Quick command palette (Cmd+K)
✓ Smooth page transitions

From Notion:
✓ Clean typography hierarchy
✓ Flexible content blocks

From Fathom:
✓ Meeting-focused simplicity
✓ Quick access to recent meetings
```

---

## ✅ Branding Checklist for Claude Code

Before building UI components, ensure:

- [ ] Tailwind config has all custom colors
- [ ] CSS variables defined for theming
- [ ] Fonts loaded via next/font
- [ ] Dark mode CSS variables set
- [ ] Animation keyframes defined
- [ ] Logo SVG created and placed
- [ ] Favicon generated
- [ ] Base components styled (Button, Card, Input, Badge)
- [ ] Loading skeleton component with shimmer
- [ ] Toast/notification component styled
- [ ] Progress bar component
- [ ] Stat card component with count-up animation

---

## Summary

**zigznote** is a modern, polished meeting notes app for startups and SMBs. The brand is:

| Attribute | Value |
|-----------|-------|
| **Name** | zigznote |
| **Primary Color** | #10B981 (Emerald Green) |
| **Font** | Plus Jakarta Sans + Inter |
| **Style** | Clean, card-based, soft shadows |
| **Border Radius** | 8-12px (rounded but professional) |
| **Dark Mode** | Yes, with system preference |
| **Animations** | Moderate, purposeful, delightful |
| **Retention Focus** | Progress tracking, streaks, celebrations |

This branding creates a trustworthy, efficient tool that startups love using — polished enough for client-facing work, friendly enough for daily use.
