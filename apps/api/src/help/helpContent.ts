/**
 * Help Content for the Help Assistant
 * Curated documentation for user-facing help
 */

export interface HelpArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
}

export interface HelpCategory {
  id: string;
  name: string;
  description: string;
  articles: HelpArticle[];
}

export interface FAQ {
  question: string;
  answer: string;
  category: string;
}

export const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Learn the basics of using zigznote',
    articles: [
      {
        id: 'welcome',
        title: 'Welcome to zigznote',
        description: 'An introduction to your AI meeting assistant',
        content: `
# Welcome to zigznote

zigznote is your AI-powered meeting assistant that helps you capture, understand, and act on your meetings.

## What zigznote does

- **Automatic Recording**: Join your meetings automatically and record them
- **AI Transcription**: Convert speech to text with speaker identification
- **Smart Summaries**: Generate intelligent summaries with key points
- **Action Items**: Extract and track action items from discussions
- **Search**: Find anything across all your meetings instantly

## Getting Started

1. Connect your calendar to automatically detect meetings
2. Configure your meeting preferences
3. Let zigznote join your meetings
4. Review transcripts, summaries, and action items
        `,
        category: 'getting-started',
        tags: ['intro', 'basics', 'overview'],
      },
      {
        id: 'connecting-calendar',
        title: 'Connecting Your Calendar',
        description: 'Set up calendar sync for automatic meeting detection',
        content: `
# Connecting Your Calendar

Connect your Google or Microsoft calendar to automatically detect meetings.

## Supported Calendars

- Google Calendar
- Microsoft Outlook
- Microsoft 365

## How to Connect

1. Go to **Settings** > **Calendar**
2. Click **Connect Calendar**
3. Choose your calendar provider
4. Authorize zigznote to access your calendar
5. Select which calendars to sync

## What Gets Synced

- Meeting titles and times
- Meeting URLs (Zoom, Google Meet, Teams)
- Participant information
- Real-time calendar updates
        `,
        category: 'getting-started',
        tags: ['calendar', 'google', 'outlook', 'sync'],
      },
    ],
  },
  {
    id: 'features',
    name: 'Features',
    description: 'Learn about zigznote capabilities',
    articles: [
      {
        id: 'transcripts',
        title: 'Transcripts & Speaker Recognition',
        description: 'Understanding your meeting transcripts',
        content: `
# Transcripts & Speaker Recognition

## Real-time Transcription

zigznote transcribes your meetings with:

- High accuracy for clear audio
- Speaker diarization (who said what)
- Automatic punctuation
- Multi-language support

## Speaker Recognition

- First meeting: Speakers labeled as "Speaker 1", "Speaker 2", etc.
- Name detection: Automatically detects introductions
- Learning: Names persist across future meetings
- Manual editing: Correct speaker names anytime
        `,
        category: 'features',
        tags: ['transcript', 'speaker', 'recognition'],
      },
      {
        id: 'summaries',
        title: 'AI Summaries',
        description: 'How AI summaries work',
        content: `
# AI Summaries

## What's Included

Every meeting summary contains:

- **Executive Summary**: 3-5 sentence overview
- **Key Topics**: Main discussion points
- **Decisions Made**: Important decisions
- **Action Items**: Tasks with assignees
- **Questions Raised**: Open questions for follow-up

## Sharing Summaries

- Copy to clipboard
- Share via link
- Export to Slack or email
        `,
        category: 'features',
        tags: ['summary', 'ai', 'action items'],
      },
      {
        id: 'search',
        title: 'Search Your Meetings',
        description: 'Finding content across all meetings',
        content: `
# Search Your Meetings

## How to Search

Use the search bar in the navigation to find:

- Meeting titles
- Transcript content
- Summary text
- Action items

## Search Tips

- Use keywords from conversations
- Filter by date range
- Filter by meeting platform
- Click results to jump to the meeting
        `,
        category: 'features',
        tags: ['search', 'find', 'filter'],
      },
    ],
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'Connect zigznote with your tools',
    articles: [
      {
        id: 'slack',
        title: 'Slack Integration',
        description: 'Get meeting updates in Slack',
        content: `
# Slack Integration

## Setup

1. Go to **Settings** > **Integrations**
2. Click **Connect Slack**
3. Choose your workspace
4. Select channels for notifications

## Features

- Meeting summary notifications
- Action item reminders
- Share meeting links to channels
        `,
        category: 'integrations',
        tags: ['slack', 'notifications'],
      },
      {
        id: 'hubspot',
        title: 'HubSpot Integration',
        description: 'Sync meeting notes to HubSpot',
        content: `
# HubSpot Integration

## Setup

1. Go to **Settings** > **Integrations**
2. Click **Connect HubSpot**
3. Authorize the connection
4. Map meeting participants to contacts

## Features

- Automatic meeting logging
- Notes synced to contact records
- Deal association for sales calls
        `,
        category: 'integrations',
        tags: ['hubspot', 'crm', 'sales'],
      },
    ],
  },
  {
    id: 'account',
    name: 'Account & Billing',
    description: 'Manage your account settings',
    articles: [
      {
        id: 'plans',
        title: 'Plans & Pricing',
        description: 'Understanding zigznote plans',
        content: `
# Plans & Pricing

## Free Plan

- 5 meetings per month
- Basic transcription
- 7-day history

## Pro Plan

- Unlimited meetings
- AI summaries
- 90-day history
- Integrations
- Priority support

## Enterprise

- Custom limits
- SSO/SAML
- Admin controls
- Dedicated support

## Changing Plans

Go to **Settings** > **Billing** to upgrade or downgrade.
        `,
        category: 'account',
        tags: ['pricing', 'plans', 'billing'],
      },
    ],
  },
];

export const faqs: FAQ[] = [
  {
    question: 'How does zigznote join my meetings?',
    answer: 'zigznote uses a meeting bot that joins your meetings just like a regular participant. It appears as "zigznote Notetaker" in the meeting and records audio for transcription.',
    category: 'getting-started',
  },
  {
    question: 'Is my meeting data secure?',
    answer: 'Yes! All data is encrypted in transit and at rest. We use enterprise-grade security. Meeting recordings are stored securely and only accessible to your organization.',
    category: 'getting-started',
  },
  {
    question: 'Which meeting platforms are supported?',
    answer: 'zigznote supports Zoom, Google Meet, Microsoft Teams, and Webex. We automatically detect meeting links from your calendar.',
    category: 'getting-started',
  },
  {
    question: 'How accurate is the transcription?',
    answer: 'Our transcription achieves high accuracy for clear audio in English. Accuracy may vary with background noise, accents, or technical terminology. You can always edit transcripts manually.',
    category: 'features',
  },
  {
    question: 'Can I delete a meeting recording?',
    answer: 'Yes, go to the meeting page and click the delete option. This removes the recording, transcript, and all associated data permanently.',
    category: 'features',
  },
  {
    question: 'How do I share a meeting summary?',
    answer: 'Open the meeting, go to the Summary tab, and click Share. You can copy a link, send to Slack, or export as PDF.',
    category: 'features',
  },
  {
    question: "What happens if the bot can't join?",
    answer: "If the bot fails to join (usually due to waiting room or permissions), you'll receive a notification. You can manually upload a recording instead.",
    category: 'getting-started',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: "Yes, you can cancel anytime from Settings > Billing. You'll keep access until the end of your billing period.",
    category: 'account',
  },
  {
    question: 'How do I invite team members?',
    answer: 'Go to Settings > Team and click "Invite Member". Enter their email address and they\'ll receive an invitation to join your organization.',
    category: 'account',
  },
  {
    question: 'Can I search within transcripts?',
    answer: 'Yes! Use the search bar to find specific words or phrases across all your meeting transcripts. Results show matching excerpts with highlighted terms.',
    category: 'features',
  },
];

/**
 * Search articles by query
 */
export function searchArticles(query: string): HelpArticle[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: Array<{ article: HelpArticle; score: number }> = [];

  for (const category of helpCategories) {
    for (const article of category.articles) {
      const matchScore =
        (article.title.toLowerCase().includes(lowerQuery) ? 3 : 0) +
        (article.description.toLowerCase().includes(lowerQuery) ? 2 : 0) +
        (article.tags.some((t) => t.includes(lowerQuery)) ? 1 : 0) +
        (article.content.toLowerCase().includes(lowerQuery) ? 1 : 0);

      if (matchScore > 0) {
        results.push({ article, score: matchScore });
      }
    }
  }

  // Sort by score and return articles
  return results
    .sort((a, b) => b.score - a.score)
    .map((r) => r.article);
}

/**
 * Get article by ID
 */
export function getArticleById(id: string): HelpArticle | null {
  for (const category of helpCategories) {
    const article = category.articles.find((a) => a.id === id);
    if (article) return article;
  }
  return null;
}

/**
 * Get category by ID
 */
export function getCategoryById(id: string): HelpCategory | null {
  return helpCategories.find((c) => c.id === id) || null;
}
