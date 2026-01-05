/**
 * Help Center Content
 * Static content for help articles, FAQs, and guides
 */

export interface HelpArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  icon?: string;
}

export interface HelpCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
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
    icon: 'Rocket',
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
- **AI Q&A**: Ask questions about any meeting and get instant answers

## Getting Started

1. Connect your calendar to automatically detect meetings
2. Configure your meeting preferences
3. Let zigznote join your meetings
4. Review transcripts, summaries, and action items after each meeting
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

Connect your Google or Microsoft calendar to automatically detect and join meetings.

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
- Calendar updates in real-time
        `,
        category: 'getting-started',
        tags: ['calendar', 'google', 'outlook', 'sync'],
      },
      {
        id: 'first-meeting',
        title: 'Recording Your First Meeting',
        description: 'How to record and process your first meeting',
        content: `
# Recording Your First Meeting

## Automatic Recording

Once your calendar is connected, zigznote will:

1. Detect upcoming meetings with video links
2. Automatically join at the scheduled time
3. Record audio and transcribe in real-time
4. Generate summary when the meeting ends

## Manual Recording

You can also add meetings manually:

1. Go to **Meetings** > **New Meeting**
2. Paste the meeting URL
3. Set the meeting time
4. Click **Schedule Bot**

## After the Meeting

- Transcript available within minutes
- AI summary generated automatically
- Action items extracted and ready to track
        `,
        category: 'getting-started',
        tags: ['recording', 'meeting', 'bot'],
      },
    ],
  },
  {
    id: 'features',
    name: 'Features',
    description: 'Learn about zigznote capabilities',
    icon: 'Sparkles',
    articles: [
      {
        id: 'transcripts',
        title: 'Transcripts & Speaker Recognition',
        description: 'Understanding your meeting transcripts',
        content: `
# Transcripts & Speaker Recognition

## Real-time Transcription

zigznote uses advanced AI to transcribe your meetings in real-time with:

- 95%+ accuracy for clear audio
- Speaker diarization (who said what)
- Automatic punctuation and formatting
- Multi-language support

## Speaker Recognition

zigznote learns to recognize speakers over time:

1. **First Meeting**: Speakers labeled as "Speaker 1", "Speaker 2", etc.
2. **Name Detection**: Automatically detects when people introduce themselves
3. **Learning**: Names persist across future meetings
4. **Manual Editing**: You can correct speaker names anytime

## Searching Transcripts

- Use the search bar to find specific topics
- Filter by speaker, date, or meeting
- Jump to exact moments in the recording
        `,
        category: 'features',
        tags: ['transcript', 'speaker', 'recognition', 'search'],
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
- **Decisions Made**: Important decisions documented
- **Action Items**: Tasks with assignees and due dates
- **Questions Raised**: Open questions for follow-up

## Customization

You can regenerate summaries with different focuses:

- Sales signals (objections, buying intent)
- Interview notes (skills, cultural fit)
- Project updates (status, blockers)
- Customer feedback analysis

## Sharing Summaries

- Copy to clipboard
- Share via link
- Export to Slack, Notion, or email
        `,
        category: 'features',
        tags: ['summary', 'ai', 'action items', 'decisions'],
      },
      {
        id: 'ai-assistant',
        title: 'AI Meeting Assistant',
        description: 'Ask questions about your meetings',
        content: `
# AI Meeting Assistant

## How It Works

The AI Assistant lets you have a conversation about any meeting:

1. Open a completed meeting
2. Click the chat icon in the bottom-right
3. Ask any question about the meeting
4. Get instant, accurate answers

## Example Questions

- "What were the main action items?"
- "What did Sarah say about the timeline?"
- "Summarize the discussion about pricing"
- "Were there any concerns raised?"

## Features

- **Source Citations**: See exactly where answers come from
- **Multi-turn Conversations**: Ask follow-up questions
- **Suggested Questions**: Get started with smart suggestions
        `,
        category: 'features',
        tags: ['ai', 'assistant', 'chat', 'questions'],
      },
    ],
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'Connect zigznote with your tools',
    icon: 'Plug',
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
- Search meetings from Slack

## Customization

Choose what to receive:
- All meetings or selected calendars
- Summary only or full transcript
- Immediate or batched notifications
        `,
        category: 'integrations',
        tags: ['slack', 'notifications', 'sharing'],
      },
      {
        id: 'api',
        title: 'API Access',
        description: 'Build custom integrations',
        content: `
# API Access

## Getting Started

1. Go to **Settings** > **API Keys**
2. Click **Create API Key**
3. Set permissions and expiration
4. Copy your key (shown once)

## API Capabilities

- List and search meetings
- Access transcripts and summaries
- Manage action items
- Create webhooks for real-time updates

## Rate Limits

- Standard: 100 requests/minute
- Pro: 500 requests/minute
- Enterprise: Custom limits

## Documentation

Full API documentation available at /api/docs
        `,
        category: 'integrations',
        tags: ['api', 'developer', 'webhooks', 'automation'],
      },
    ],
  },
  {
    id: 'account',
    name: 'Account & Billing',
    description: 'Manage your account settings',
    icon: 'User',
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

## Pro Plan ($20/month)

- Unlimited meetings
- AI summaries
- 90-day history
- API access
- Priority support

## Enterprise

- Custom limits
- SSO/SAML
- Admin controls
- Dedicated support
- SLA guarantee

## Changing Plans

Go to **Settings** > **Billing** to upgrade or downgrade.
        `,
        category: 'account',
        tags: ['pricing', 'plans', 'billing', 'upgrade'],
      },
    ],
  },
];

export const faqs: FAQ[] = [
  {
    question: 'How does zigznote join my meetings?',
    answer: 'zigznote uses a bot that joins your meetings just like a regular participant. It appears as "zigznote Notetaker" in the meeting and records audio for transcription.',
    category: 'getting-started',
  },
  {
    question: 'Is my meeting data secure?',
    answer: 'Yes! All data is encrypted in transit and at rest. We use enterprise-grade security and are SOC 2 compliant. Meeting recordings are stored securely and only accessible to your organization.',
    category: 'getting-started',
  },
  {
    question: 'Which meeting platforms are supported?',
    answer: 'zigznote supports Zoom, Google Meet, Microsoft Teams, and Webex. We automatically detect meeting links from your calendar.',
    category: 'getting-started',
  },
  {
    question: 'How accurate is the transcription?',
    answer: 'Our AI transcription achieves 95%+ accuracy for clear audio in English. Accuracy may vary with background noise, accents, or technical terminology. You can always edit transcripts manually.',
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
    question: 'What happens if the bot can\'t join?',
    answer: 'If the bot fails to join (usually due to waiting room or permissions), you\'ll receive a notification. You can manually upload a recording instead.',
    category: 'getting-started',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes, you can cancel anytime from Settings > Billing. You\'ll keep access until the end of your billing period.',
    category: 'account',
  },
];

export const quickLinks = [
  { title: 'Getting Started Guide', href: '/help/getting-started/welcome', icon: 'Rocket' },
  { title: 'Connect Calendar', href: '/help/getting-started/connecting-calendar', icon: 'Calendar' },
  { title: 'AI Features', href: '/help/features/ai-assistant', icon: 'Sparkles' },
  { title: 'API Documentation', href: '/api/docs', icon: 'Code' },
  { title: 'Contact Support', href: 'mailto:support@zigznote.com', icon: 'Mail' },
];

export function searchArticles(query: string): HelpArticle[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const results: HelpArticle[] = [];

  for (const category of helpCategories) {
    for (const article of category.articles) {
      const matchScore =
        (article.title.toLowerCase().includes(lowerQuery) ? 3 : 0) +
        (article.description.toLowerCase().includes(lowerQuery) ? 2 : 0) +
        (article.tags.some((t) => t.includes(lowerQuery)) ? 1 : 0) +
        (article.content.toLowerCase().includes(lowerQuery) ? 1 : 0);

      if (matchScore > 0) {
        results.push(article);
      }
    }
  }

  return results;
}

export function getArticleById(id: string): HelpArticle | null {
  for (const category of helpCategories) {
    const article = category.articles.find((a) => a.id === id);
    if (article) return article;
  }
  return null;
}

export function getCategoryById(id: string): HelpCategory | null {
  return helpCategories.find((c) => c.id === id) || null;
}
