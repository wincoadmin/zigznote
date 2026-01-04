/**
 * Summary generation prompts
 * @version 1.0.0
 */

import type { SummaryPromptContext } from '../types';

/**
 * JSON schema for summary output (included in prompt for LLM guidance)
 */
export const SUMMARY_OUTPUT_SCHEMA = `{
  "executiveSummary": "string (3-5 sentences capturing the essence of the meeting)",
  "topics": [
    {
      "title": "string (topic name)",
      "summary": "string (1-2 sentences)",
      "keyPoints": ["string (key point 1)", "string (key point 2)"]
    }
  ],
  "actionItems": [
    {
      "text": "string (action description)",
      "assignee": "string or null (person responsible)",
      "dueDate": "string or null (ISO date or relative like 'next Monday')",
      "priority": "high | medium | low"
    }
  ],
  "decisions": ["string (decision 1)", "string (decision 2)"],
  "questions": ["string (open question 1)", "string (open question 2)"],
  "sentiment": "positive | neutral | negative | mixed"
}`;

/**
 * Build the main summary prompt
 */
export function buildSummaryPrompt(context: SummaryPromptContext): string {
  const { transcript, meetingTitle, participants, meetingDuration } = context;

  let prompt = 'Analyze the following meeting transcript and provide a structured summary.\n\n';

  // Add meeting metadata if available
  if (meetingTitle) {
    prompt += `Meeting Title: ${meetingTitle}\n`;
  }

  if (participants && participants.length > 0) {
    prompt += `Participants: ${participants.join(', ')}\n`;
  }

  if (meetingDuration) {
    const minutes = Math.round(meetingDuration / 60);
    prompt += `Duration: ${minutes} minutes\n`;
  }

  prompt += '\n--- TRANSCRIPT START ---\n';
  prompt += transcript;
  prompt += '\n--- TRANSCRIPT END ---\n\n';

  prompt += `Provide your analysis as a JSON object matching this schema:\n${SUMMARY_OUTPUT_SCHEMA}\n\n`;
  prompt += 'Important:\n';
  prompt += '- executiveSummary: 3-5 sentences that someone could read to understand what happened\n';
  prompt += '- topics: Group related discussions (minimum 1, typically 2-5 topics)\n';
  prompt += '- actionItems: Extract all action items with assignee if mentioned. Infer priority from urgency language.\n';
  prompt += '- decisions: Only firm decisions, not suggestions or possibilities\n';
  prompt += '- questions: Unresolved questions or items needing follow-up\n';
  prompt += '- sentiment: Overall tone of the meeting\n\n';
  prompt += 'Respond with ONLY the JSON object, no additional text or markdown.';

  return prompt;
}

/**
 * Build prompt for a chunk of a longer transcript
 */
export function buildChunkPrompt(
  chunkText: string,
  chunkIndex: number,
  totalChunks: number,
  context: Omit<SummaryPromptContext, 'transcript'>
): string {
  let prompt = `This is chunk ${chunkIndex + 1} of ${totalChunks} from a meeting transcript.\n\n`;

  if (context.meetingTitle) {
    prompt += `Meeting: ${context.meetingTitle}\n`;
  }

  prompt += '\n--- CHUNK START ---\n';
  prompt += chunkText;
  prompt += '\n--- CHUNK END ---\n\n';

  prompt += 'Extract from this chunk:\n';
  prompt += `{
  "topics": [{"title": "string", "summary": "string", "keyPoints": ["string"]}],
  "actionItems": [{"text": "string", "assignee": "string|null", "dueDate": "string|null", "priority": "high|medium|low"}],
  "decisions": ["string"],
  "questions": ["string"],
  "keyQuotes": ["string (notable quotes from this section)"]
}\n\n`;
  prompt += 'Respond with ONLY the JSON object.';

  return prompt;
}

/**
 * Build prompt to consolidate chunked summaries
 */
export function buildConsolidationPrompt(
  chunkSummaries: unknown[],
  context: Omit<SummaryPromptContext, 'transcript'>
): string {
  let prompt = 'Consolidate the following chunk summaries into a single coherent meeting summary.\n\n';

  if (context.meetingTitle) {
    prompt += `Meeting: ${context.meetingTitle}\n`;
  }

  if (context.participants && context.participants.length > 0) {
    prompt += `Participants: ${context.participants.join(', ')}\n`;
  }

  prompt += '\n--- CHUNK SUMMARIES ---\n';
  prompt += JSON.stringify(chunkSummaries, null, 2);
  prompt += '\n--- END CHUNK SUMMARIES ---\n\n';

  prompt += 'Create a unified summary:\n';
  prompt += '1. Merge and deduplicate topics\n';
  prompt += '2. Combine action items (remove duplicates)\n';
  prompt += '3. Consolidate decisions\n';
  prompt += '4. Merge questions\n';
  prompt += '5. Write a cohesive executive summary covering the entire meeting\n';
  prompt += '6. Determine overall sentiment\n\n';

  prompt += `Output schema:\n${SUMMARY_OUTPUT_SCHEMA}\n\n`;
  prompt += 'Respond with ONLY the JSON object.';

  return prompt;
}

/**
 * Build prompt for action item re-extraction (more thorough)
 */
export function buildActionItemPrompt(transcript: string): string {
  let prompt = 'Extract ALL action items from this meeting transcript.\n\n';
  prompt += 'An action item is any task, commitment, or follow-up mentioned.\n\n';

  prompt += '--- TRANSCRIPT ---\n';
  prompt += transcript;
  prompt += '\n--- END TRANSCRIPT ---\n\n';

  prompt += 'For each action item, identify:\n';
  prompt += '1. The specific action to be taken\n';
  prompt += '2. Who is responsible (if mentioned)\n';
  prompt += '3. Any deadline (explicit or implied)\n';
  prompt += '4. Priority (based on urgency language)\n\n';

  prompt += 'Look for phrases like:\n';
  prompt += '- "I will...", "We need to...", "Someone should..."\n';
  prompt += '- "Action item:", "TODO:", "Follow up on..."\n';
  prompt += '- "By [date]", "Before [event]", "ASAP"\n\n';

  prompt += `Output as JSON array:
[
  {
    "text": "string",
    "assignee": "string or null",
    "dueDate": "string or null",
    "priority": "high | medium | low",
    "context": "string (brief context from transcript)"
  }
]\n\n`;
  prompt += 'Respond with ONLY the JSON array.';

  return prompt;
}

/**
 * Prompt version for tracking
 */
export const PROMPT_VERSION = '1.0.0';
