/**
 * Utility functions for database seeding
 */

/**
 * Picks a random element from an array
 */
export function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Generates a random alphanumeric string
 */
export function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates a random company name
 */
export function randomCompanyName(): string {
  const prefixes = ['Acme', 'Global', 'Tech', 'Digital', 'Cloud', 'Smart', 'Next', 'Future'];
  const suffixes = ['Corp', 'Inc', 'Solutions', 'Systems', 'Labs', 'Works', 'Hub', 'IO'];
  return `${randomElement(prefixes)} ${randomElement(suffixes)}`;
}

/**
 * Generates a random person name
 */
export function randomPersonName(): string {
  const firstNames = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
  return `${randomElement(firstNames)} ${randomElement(lastNames)}`;
}

/**
 * Generates a random meeting title
 */
export function randomMeetingTitle(): string {
  const types = ['Sync', 'Review', 'Planning', 'Standup', 'Retro', 'Demo', 'Workshop', 'Discussion'];
  const topics = ['Product', 'Engineering', 'Sales', 'Marketing', 'Design', 'Customer', 'Team', 'Project'];
  return `${randomElement(topics)} ${randomElement(types)}`;
}

/**
 * Sample transcript segments
 */
export const sampleSegments = [
  {
    speaker: 'Speaker 1',
    text: 'Good morning everyone, thanks for joining the product sync.',
    start_ms: 0,
    end_ms: 4000,
    confidence: 0.98,
  },
  {
    speaker: 'Speaker 2',
    text: "Thanks for having us. I wanted to discuss the Q1 roadmap updates.",
    start_ms: 4500,
    end_ms: 9000,
    confidence: 0.97,
  },
  {
    speaker: 'Speaker 1',
    text: "Great, let's start with the new features we're planning.",
    start_ms: 9500,
    end_ms: 13000,
    confidence: 0.99,
  },
  {
    speaker: 'Speaker 3',
    text: "I've prepared a list of the top requested features from customers.",
    start_ms: 13500,
    end_ms: 18000,
    confidence: 0.96,
  },
  {
    speaker: 'Speaker 2',
    text: 'The dashboard redesign is at the top of the list, followed by API improvements.',
    start_ms: 18500,
    end_ms: 24000,
    confidence: 0.98,
  },
];

/**
 * Sample summary content
 */
export const sampleSummaryContent = {
  executive_summary:
    'The team discussed the Q1 roadmap updates, focusing on top customer-requested features including dashboard redesign and API improvements. Key decisions were made about prioritization.',
  topics: [
    { title: 'Q1 Roadmap', summary: 'Team reviewed planned features for Q1 release cycle.' },
    { title: 'Customer Feedback', summary: 'Discussed top requested features including dashboard redesign.' },
    { title: 'API Improvements', summary: 'Agreed to prioritize API enhancements for developer experience.' },
  ],
  decisions: [
    'Dashboard redesign will be the primary focus for Q1',
    'API documentation will be updated alongside new features',
  ],
  questions: [
    'What is the timeline for the dashboard redesign?',
    'Who will lead the API improvements initiative?',
  ],
};

/**
 * Sample action item texts
 */
export const actionTexts = [
  'Review document and provide feedback',
  'Schedule follow-up meeting',
  'Send proposal to client',
  'Update project documentation',
  'Complete code review',
  'Prepare presentation slides',
];
