/**
 * Landing Page Content
 * All content is centralized here for easy updates and future CMS migration
 */

import {
  Video,
  Mic,
  FileText,
  CheckSquare,
  Calendar,
  Users,
  Zap,
  Shield,
  Globe,
  Search,
} from 'lucide-react';

// Hero Section
export const heroContent = {
  headline: 'Never Miss a Meeting Detail Again',
  subheadline:
    'AI-powered meeting assistant that joins your calls, transcribes conversations, and lets you search across every meeting. Ask questions, get answers, take action.',
  primaryCta: {
    text: 'Get Started Free',
    href: '/sign-up',
  },
  secondaryCta: {
    text: 'Watch Demo',
    href: '#demo',
  },
  badge: 'Trusted by 500+ teams worldwide',
};

// Search Across Meetings Section
export const searchSection = {
  heading: 'Search Across All Your Meetings',
  subheading: 'Find any moment, from any meeting, instantly',
  description:
    'Stop digging through notes. Our AI-powered search lets you find exactly what was said, who said it, and when—across your entire meeting history.',
  features: [
    {
      title: 'Semantic Search',
      description: 'Search by meaning, not just keywords. Find "budget discussions" even if those exact words weren\'t used.',
    },
    {
      title: 'Speaker Filter',
      description: 'Filter results by who said it. Quickly find everything a specific person mentioned.',
    },
    {
      title: 'Time Range',
      description: 'Search within specific dates or across all time. Your meeting memory, organized.',
    },
  ],
  searchPlaceholder: 'What did Sarah say about the Q4 roadmap?',
  sampleQueries: [
    'What were the action items from last week?',
    'When did we discuss the pricing change?',
    'What did the client say about the deadline?',
  ],
};

// AI Assistant Section
export const aiAssistantSection = {
  heading: 'Ask Your Meetings Anything',
  subheading: 'Your AI assistant that knows every conversation',
  description:
    'Chat with an AI that has context from all your meetings. Ask questions, draft follow-ups, and get insights without rewatching hours of recordings.',
  capabilities: [
    {
      icon: 'MessageSquare',
      title: 'Ask Questions',
      description: 'Get instant answers with cited sources from your meetings.',
      example: '"What were the main concerns raised about the new feature?"',
    },
    {
      icon: 'Mail',
      title: 'Draft Follow-ups',
      description: 'Generate follow-up emails with context auto-filled from the meeting.',
      example: '"Write a follow-up email to the client summarizing next steps"',
    },
    {
      icon: 'ListChecks',
      title: 'Extract Insights',
      description: 'Pull out decisions, commitments, and key takeaways automatically.',
      example: '"List all decisions made in this meeting"',
    },
    {
      icon: 'TrendingUp',
      title: 'Track Trends',
      description: 'See patterns across meetings—topics that keep coming up, sentiment shifts.',
      example: '"How has the team\'s feedback on the redesign evolved?"',
    },
  ],
  chatExample: {
    question: 'What did we decide about the launch date?',
    answer:
      'Based on the product sync on Jan 5th, the team agreed to push the launch to February 15th to allow more time for QA. Sarah mentioned this was approved by leadership.',
    sources: ['Product Sync - Jan 5, 2025', 'Leadership Review - Jan 3, 2025'],
  },
};

// Trust Indicators
export const trustIndicators = {
  heading: 'Trusted by innovative teams worldwide',
  companies: [
    { name: 'TechCorp', logo: '/logos/placeholder-1.svg' },
    { name: 'StartupX', logo: '/logos/placeholder-2.svg' },
    { name: 'ScaleUp', logo: '/logos/placeholder-3.svg' },
    { name: 'GrowthCo', logo: '/logos/placeholder-4.svg' },
    { name: 'InnovateLab', logo: '/logos/placeholder-5.svg' },
    { name: 'FutureTech', logo: '/logos/placeholder-6.svg' },
  ],
  stats: [
    { value: '10,000+', label: 'Meetings Recorded' },
    { value: '50,000+', label: 'Hours Saved' },
    { value: '95%', label: 'Transcription Accuracy' },
  ],
};

// How It Works
export const howItWorks = {
  heading: 'How It Works',
  subheading: 'Get started in minutes, not hours',
  steps: [
    {
      number: 1,
      title: 'Connect Your Calendar',
      description:
        'Link your Google Calendar in one click. We automatically detect your upcoming meetings.',
      icon: 'Calendar',
    },
    {
      number: 2,
      title: 'Bot Joins Automatically',
      description:
        'Our AI assistant joins your Zoom, Meet, or Teams calls on your behalf. No manual setup needed.',
      icon: 'Video',
    },
    {
      number: 3,
      title: 'AI Transcribes Everything',
      description:
        'Real-time transcription with speaker identification. 95%+ accuracy across 100+ languages.',
      icon: 'Mic',
    },
    {
      number: 4,
      title: 'Get Summaries & Action Items',
      description:
        'Instantly receive structured summaries, key decisions, and action items after every call.',
      icon: 'FileText',
    },
  ],
};

// Features
export const features = {
  heading: 'Everything You Need',
  subheading: 'Powerful features to transform how your team handles meetings',
  items: [
    {
      icon: 'Video',
      title: 'Auto-Join Meetings',
      description:
        'Seamlessly joins Zoom, Google Meet, and Microsoft Teams. Works with your existing workflow.',
      highlight: 'Works with Zoom, Meet & Teams',
    },
    {
      icon: 'Mic',
      title: 'Smart Transcription',
      description:
        '95%+ accuracy with automatic speaker identification. Supports 100+ languages and accents.',
      highlight: '95%+ Accuracy',
    },
    {
      icon: 'FileText',
      title: 'AI Summaries',
      description:
        'Get concise summaries highlighting key discussion points, decisions made, and outcomes.',
      highlight: 'Instant Insights',
    },
    {
      icon: 'CheckSquare',
      title: 'Action Items',
      description:
        'Automatically extract and assign action items. Never lose track of follow-ups again.',
      highlight: 'Auto-Extracted Tasks',
    },
    {
      icon: 'Calendar',
      title: 'Calendar Sync',
      description:
        'Deep integration with Google Calendar. Automatic meeting detection and scheduling.',
      highlight: 'One-Click Setup',
    },
    {
      icon: 'Users',
      title: 'Team Collaboration',
      description:
        'Share transcripts, add comments, and search across all your team meetings effortlessly.',
      highlight: 'Built for Teams',
    },
  ],
};

// Integrations
export const integrations = {
  heading: 'Works With Your Favorite Tools',
  subheading: 'Seamless integration with the platforms you already use',
  platforms: [
    { name: 'Zoom', logo: '/integrations/zoom.svg' },
    { name: 'Google Meet', logo: '/integrations/google-meet.svg' },
    { name: 'Microsoft Teams', logo: '/integrations/teams.svg' },
    { name: 'Google Calendar', logo: '/integrations/google-calendar.svg' },
    { name: 'Slack', logo: '/integrations/slack.svg' },
    { name: 'Notion', logo: '/integrations/notion.svg' },
  ],
};

// Pricing Teaser
export const pricingTeaser = {
  heading: 'Simple, Transparent Pricing',
  subheading: 'Start free and scale as you grow. No hidden fees.',
  tiers: [
    {
      name: 'Free',
      description: 'Perfect for trying out zigznote',
      features: [
        '5 meetings per month',
        'Basic transcription',
        'AI summaries',
        '7-day history',
      ],
      cta: {
        text: 'Get Started',
        href: '/sign-up',
      },
      highlighted: false,
    },
    {
      name: 'Pro',
      description: 'For growing teams who need more',
      features: [
        'Unlimited meetings',
        'Premium transcription',
        'Advanced AI insights',
        'Unlimited history',
        'Team collaboration',
        'Priority support',
      ],
      cta: {
        text: 'See Pricing',
        href: '/pricing',
      },
      highlighted: true,
      badge: 'Most Popular',
    },
    {
      name: 'Enterprise',
      description: 'For organizations with advanced needs',
      features: [
        'Everything in Pro',
        'Custom integrations',
        'SSO & SAML',
        'Dedicated support',
        'SLA guarantee',
        'Custom contracts',
      ],
      cta: {
        text: 'Contact Sales',
        href: '/pricing',
      },
      highlighted: false,
    },
  ],
  viewAllCta: {
    text: 'Compare All Plans',
    href: '/pricing',
  },
};

// Testimonials
export const testimonials = {
  heading: 'Loved by Teams Everywhere',
  subheading: 'See what our customers have to say',
  items: [
    {
      quote:
        "zigznote has transformed how our team handles meetings. We save at least 5 hours per week on note-taking alone. The AI summaries are incredibly accurate.",
      author: {
        name: 'Sarah Chen',
        role: 'Head of Product',
        company: 'TechStart Inc.',
        avatar: '/avatars/placeholder-1.jpg',
      },
    },
    {
      quote:
        "The automatic action item extraction is a game-changer. Nothing falls through the cracks anymore. Our team's productivity has noticeably improved.",
      author: {
        name: 'Michael Roberts',
        role: 'Engineering Manager',
        company: 'ScaleUp Labs',
        avatar: '/avatars/placeholder-2.jpg',
      },
    },
    {
      quote:
        "We evaluated several meeting assistants, and zigznote stood out for its accuracy and ease of use. The onboarding took less than 5 minutes.",
      author: {
        name: 'Emily Watson',
        role: 'Operations Director',
        company: 'GrowthCo',
        avatar: '/avatars/placeholder-3.jpg',
      },
    },
  ],
};

// FAQ
export const faqItems = [
  {
    question: 'How does the free tier work?',
    answer:
      'Our free tier includes 5 meetings per month with basic transcription and AI summaries. No credit card required to get started. Perfect for trying out zigznote before committing.',
  },
  {
    question: 'Which meeting platforms do you support?',
    answer:
      'We currently support Zoom, Google Meet, and Microsoft Teams. Our AI bot can join meetings on any of these platforms automatically when connected to your calendar.',
  },
  {
    question: 'How accurate is the transcription?',
    answer:
      'Our transcription achieves 95%+ accuracy across most accents and languages. We support 100+ languages and continuously improve our models based on user feedback.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. We use enterprise-grade encryption for all data at rest and in transit. We are SOC 2 Type II compliant and GDPR ready. Your meeting data is never shared or used for training.',
  },
  {
    question: 'Can I use zigznote with my team?',
    answer:
      'Yes! Our Pro and Enterprise plans include team collaboration features. Share transcripts, add comments, assign action items, and search across all team meetings.',
  },
  {
    question: 'What happens if I exceed my meeting limit?',
    answer:
      "You'll receive a notification when approaching your limit. You can upgrade anytime to unlock unlimited meetings, or wait until your next billing cycle for the limit to reset.",
  },
];

// Footer
export const footerContent = {
  brand: {
    name: 'zigznote',
    tagline: 'Your meetings, simplified.',
  },
  columns: [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '#features' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Integrations', href: '#integrations' },
        { label: 'Security', href: '#' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '#' },
        { label: 'Blog', href: '#' },
        { label: 'Careers', href: '#' },
        { label: 'Contact', href: '#' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Cookie Policy', href: '/cookies' },
      ],
    },
  ],
  social: [
    { name: 'Twitter', href: '#', icon: 'Twitter' },
    { name: 'LinkedIn', href: '#', icon: 'LinkedIn' },
    { name: 'GitHub', href: '#', icon: 'GitHub' },
  ],
  copyright: `© ${new Date().getFullYear()} zigznote. All rights reserved.`,
};
