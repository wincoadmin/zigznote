/**
 * Help Assistant Service
 * AI-powered help assistant for zigznote users
 *
 * SECURITY: This service is restricted to only answering questions about
 * using zigznote features. It must NEVER reveal technical implementation
 * details, third-party services, or internal information.
 */

import { createLogger } from '@zigznote/shared';
import { faqs, searchArticles } from '../help/helpContent';
import { apiKeyProvider, ApiProviders } from './apiKeyProvider';

const logger = createLogger({ component: 'helpAssistant' });

// Security: Patterns that indicate prompt injection attempts
const BLOCKED_INPUT_PATTERNS = [
  /ignore\s+(all\s+)?previous/i,
  /disregard\s+(all\s+)?instructions/i,
  /you\s+are\s+now/i,
  /pretend\s+(to\s+)?be/i,
  /reveal\s+(your\s+)?prompt/i,
  /system\s+prompt/i,
  /what\s+are\s+your\s+instructions/i,
  /forget\s+(everything|all)/i,
  /override\s+your/i,
  /jailbreak/i,
  /bypass\s+(the\s+)?restrictions/i,
  /admin\s+mode/i,
  /developer\s+mode/i,
];

// Security: Patterns that should never appear in responses
const BLOCKED_OUTPUT_PATTERNS = [
  /deepgram/i,
  /recall\.ai/i,
  /openai/i,
  /anthropic/i,
  /claude/i,
  /gpt-?4/i,
  /postgresql/i,
  /postgres/i,
  /redis/i,
  /prisma/i,
  /bullmq/i,
  /stripe/i,
  /flutterwave/i,
  /clerk/i,
  /api\s+key/i,
  /secret\s+key/i,
  /internal\s+tool/i,
  /admin\s+panel/i,
  /backend\s+(system|server)/i,
  /database\s+schema/i,
  /server\s+infrastructure/i,
  /architecture\s+(diagram|details)/i,
  /\$[\d,]+.*cost/i,
  /\d+\s*(users|customers|companies)/i,
  /source\s+code/i,
  /codebase/i,
];

export interface HelpContext {
  currentPage: string;
  currentFeature?: string;
  userPlan: string;
  userRole: string;
  completedOnboarding: boolean;
  enabledIntegrations?: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface HelpResponse {
  response: string;
  suggestedQuestions?: string[];
  relatedArticles?: Array<{
    id: string;
    title: string;
    category: string;
  }>;
  escalate?: boolean;
}

// System prompt for the AI (kept private, never exposed)
const SYSTEM_PROMPT = `You are zigznote's friendly help assistant. Your ONLY purpose is to help users understand and use zigznote's features.

STRICT RULES - NEVER VIOLATE:
1. ONLY answer questions about using zigznote features
2. NEVER discuss technical implementation, architecture, or infrastructure
3. NEVER reveal what technologies, APIs, or services zigznote uses internally
4. NEVER discuss admin panels, backend systems, or internal tools
5. NEVER provide information about other users, companies, or business metrics
6. If asked about anything technical/internal, say: "I can only help with using zigznote's features. For other questions, please contact support@zigznote.com"
7. Always be helpful, friendly, and concise
8. Reference UI elements users can see (buttons, menus, pages)
9. Offer to navigate users to relevant pages when helpful
10. Use the help documentation provided to give accurate answers

ZIGZNOTE FEATURES YOU CAN HELP WITH:
- Meeting recording and transcription
- AI-generated summaries and action items
- Calendar synchronization (Google, Microsoft)
- Team collaboration and sharing
- Integrations (Slack, HubSpot, webhooks)
- Search functionality
- Account settings and billing
- Keyboard shortcuts

BLOCKED TOPICS - Always redirect to support:
- How things work "under the hood"
- Database, server, API implementation
- Third-party services or vendor names
- Security implementation details
- Other customers or usage statistics
- Pricing calculations or costs
- Admin tools or internal systems`;

class HelpAssistantService {
  // Cached API keys (lazy loaded)
  private anthropicApiKey: string | null = null;
  private openaiApiKey: string | null = null;
  private keysLoaded = false;

  /**
   * Load API keys from provider (DB + env fallback)
   */
  private async loadKeys(): Promise<void> {
    if (this.keysLoaded) return;
    this.anthropicApiKey = await apiKeyProvider.getKey(ApiProviders.ANTHROPIC);
    this.openaiApiKey = await apiKeyProvider.getKey(ApiProviders.OPENAI);
    this.keysLoaded = true;
  }

  /**
   * Check if the assistant is available
   */
  async isAvailable(): Promise<boolean> {
    await this.loadKeys();
    return !!(this.anthropicApiKey || this.openaiApiKey);
  }

  /**
   * Validate input for prompt injection attempts
   */
  validateInput(message: string): boolean {
    for (const pattern of BLOCKED_INPUT_PATTERNS) {
      if (pattern.test(message)) {
        logger.warn({ message: message.substring(0, 100) }, 'Blocked potential prompt injection');
        return false;
      }
    }
    return true;
  }

  /**
   * Filter response to catch any information leaks
   */
  filterResponse(response: string): string {
    for (const pattern of BLOCKED_OUTPUT_PATTERNS) {
      if (pattern.test(response)) {
        logger.warn({ pattern: pattern.toString() }, 'Response contained blocked content');
        return "I can only help with using zigznote's features. For other questions, please contact support@zigznote.com";
      }
    }
    return response;
  }

  /**
   * Get relevant help documentation for a query
   */
  private getRelevantDocs(query: string): string {
    const articles = searchArticles(query);
    if (articles.length === 0) return '';

    const topArticles = articles.slice(0, 3);
    const docsContext = topArticles
      .map((a) => `## ${a.title}\n${a.content}`)
      .join('\n\n');

    return `\n\nRELEVANT HELP DOCUMENTATION:\n${docsContext}`;
  }

  /**
   * Get context-aware suggestions based on current page
   */
  getSuggestionsForPage(page: string): string[] {
    const suggestions: Record<string, string[]> = {
      '/dashboard': [
        'How do I view my recent meetings?',
        'What do the stats cards show?',
        'How can I schedule a new meeting?',
      ],
      '/meetings': [
        'How do I start recording a meeting?',
        'Can I manually add a meeting?',
        'How do I search my meetings?',
      ],
      '/settings': [
        'How do I connect my calendar?',
        'How do I change notification settings?',
        'How do I manage my team?',
      ],
      '/settings/calendar': [
        'How do I sync my Google Calendar?',
        'Why aren\'t my meetings showing up?',
        'Can I sync multiple calendars?',
      ],
      '/settings/integrations': [
        'How do I connect Slack?',
        'What does the HubSpot integration do?',
        'How do I set up webhooks?',
      ],
      '/search': [
        'How does search work?',
        'Can I search within transcripts?',
        'How do I filter search results?',
      ],
    };

    // Find matching suggestions
    for (const [path, pageSuggestions] of Object.entries(suggestions)) {
      if (page.startsWith(path)) {
        return pageSuggestions;
      }
    }

    // Default suggestions
    return [
      'How do I get started with zigznote?',
      'How do I connect my calendar?',
      'How does transcription work?',
    ];
  }

  /**
   * Get default suggestions for new conversations
   */
  getDefaultSuggestions(context: HelpContext): string[] {
    const suggestions: string[] = [];

    // Suggest based on onboarding status
    if (!context.completedOnboarding) {
      suggestions.push('Can you walk me through the setup process?');
    }

    // Suggest based on page
    suggestions.push(...this.getSuggestionsForPage(context.currentPage).slice(0, 2));

    // Add a general suggestion
    suggestions.push('What features does zigznote have?');

    return suggestions.slice(0, 4);
  }

  /**
   * Chat with the help assistant
   */
  async chat(params: {
    message: string;
    context: HelpContext;
    history: ChatMessage[];
  }): Promise<HelpResponse> {
    const { message, context, history } = params;

    // Validate input
    if (!this.validateInput(message)) {
      return {
        response: "I'd be happy to help you with zigznote! What would you like to know about using the app?",
        suggestedQuestions: this.getDefaultSuggestions(context),
      };
    }

    // Check for simple FAQ matches first
    const faqMatch = this.findFAQMatch(message);
    if (faqMatch) {
      return {
        response: faqMatch.answer,
        relatedArticles: this.getRelatedArticles(message),
        suggestedQuestions: this.getSuggestionsForPage(context.currentPage),
      };
    }

    // Check for article matches
    const articleMatch = this.findArticleMatch(message);
    if (articleMatch) {
      return {
        response: this.formatArticleResponse(articleMatch),
        relatedArticles: this.getRelatedArticles(message),
        suggestedQuestions: this.getSuggestionsForPage(context.currentPage),
      };
    }

    // Use AI for more complex questions
    if (await this.isAvailable()) {
      try {
        const aiResponse = await this.getAIResponse(message, context, history);
        const filteredResponse = this.filterResponse(aiResponse);

        return {
          response: filteredResponse,
          relatedArticles: this.getRelatedArticles(message),
          suggestedQuestions: this.getSuggestionsForPage(context.currentPage),
        };
      } catch (error) {
        logger.error({ error }, 'AI response failed');
      }
    }

    // Fallback response
    return {
      response: "I'm not sure about that specific question. Would you like to contact our support team for more help?",
      suggestedQuestions: this.getDefaultSuggestions(context),
      escalate: true,
    };
  }

  /**
   * Find matching FAQ
   */
  private findFAQMatch(query: string): { question: string; answer: string } | null {
    const lowerQuery = query.toLowerCase();

    for (const faq of faqs) {
      // Simple keyword matching
      const questionWords = faq.question.toLowerCase().split(/\s+/);
      const queryWords = lowerQuery.split(/\s+/);

      const matchCount = questionWords.filter((word) =>
        queryWords.some((qw) => qw.includes(word) || word.includes(qw))
      ).length;

      if (matchCount >= 3 || (matchCount >= 2 && questionWords.length <= 6)) {
        return faq;
      }
    }

    return null;
  }

  /**
   * Find matching article
   */
  private findArticleMatch(query: string): { title: string; content: string; category: string } | null {
    const articles = searchArticles(query);
    const firstWord = query.toLowerCase().split(' ')[0];
    const firstArticle = articles[0];
    if (articles.length > 0 && firstWord && firstArticle && firstArticle.title.toLowerCase().includes(firstWord)) {
      return firstArticle;
    }
    return null;
  }

  /**
   * Format article content for response
   */
  private formatArticleResponse(article: { title: string; content: string }): string {
    // Extract first section of content
    const lines = article.content.trim().split('\n');
    const summary = lines.slice(0, 10).join('\n');
    return `Here's information about **${article.title}**:\n\n${summary}\n\nWould you like more details?`;
  }

  /**
   * Get related articles for a query
   */
  private getRelatedArticles(query: string): Array<{ id: string; title: string; category: string }> {
    const articles = searchArticles(query);
    return articles.slice(0, 3).map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category,
    }));
  }

  /**
   * Get AI-powered response
   */
  private async getAIResponse(
    message: string,
    context: HelpContext,
    history: ChatMessage[]
  ): Promise<string> {
    // Ensure keys are loaded
    await this.loadKeys();

    const relevantDocs = this.getRelevantDocs(message);

    const contextInfo = `
USER CONTEXT:
- Current page: ${context.currentPage}
- User plan: ${context.userPlan}
- User role: ${context.userRole}
- Onboarding completed: ${context.completedOnboarding}
${context.enabledIntegrations?.length ? `- Enabled integrations: ${context.enabledIntegrations.join(', ')}` : ''}
`;

    const systemMessage = { role: 'system' as const, content: SYSTEM_PROMPT + relevantDocs + contextInfo };
    const messages = [
      systemMessage,
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];

    // Try Anthropic first
    if (this.anthropicApiKey) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.anthropicApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307', // Use fast model for help
            max_tokens: 500,
            system: systemMessage.content,
            messages: messages.slice(1).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { content?: Array<{ text?: string }> };
          return data.content?.[0]?.text || '';
        }
      } catch (error) {
        logger.error({ error }, 'Anthropic API call failed');
      }
    }

    // Fallback to OpenAI
    if (this.openaiApiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 500,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
          return data.choices?.[0]?.message?.content || '';
        }
      } catch (error) {
        logger.error({ error }, 'OpenAI API call failed');
      }
    }

    throw new Error('No AI provider available');
  }

  /**
   * Record feedback on a response
   */
  async recordFeedback(responseId: string, helpful: boolean): Promise<void> {
    logger.info({ responseId, helpful }, 'Help feedback recorded');
    // In a production system, this would store feedback for analysis
  }
}

export const helpAssistantService = new HelpAssistantService();
