/**
 * Custom insight extraction prompts
 * @version 1.0.0
 */

import type { InsightTemplate } from '../types';

/**
 * Built-in insight templates
 */
export const BUILT_IN_TEMPLATES: InsightTemplate[] = [
  {
    id: 'sales_signals',
    name: 'Sales Signals',
    description: 'Extract buying signals, objections, and next steps from sales calls',
    prompt: `Analyze this sales meeting and extract:
1. Buying signals (positive indicators of interest)
2. Objections or concerns raised
3. Competitor mentions
4. Budget/timeline discussions
5. Next steps and commitments

Output as JSON:
{
  "buyingSignals": ["string"],
  "objections": [{"concern": "string", "addressed": boolean}],
  "competitorMentions": ["string"],
  "budgetTimeline": {"budget": "string or null", "timeline": "string or null"},
  "nextSteps": ["string"],
  "dealScore": 1-10
}`,
    outputSchema: 'json',
  },
  {
    id: 'interview_notes',
    name: 'Interview Notes',
    description: 'Extract key points from candidate interviews',
    prompt: `Analyze this interview and extract:
1. Key skills and experience discussed
2. Candidate strengths mentioned
3. Areas of concern or gaps
4. Cultural fit indicators
5. Questions candidate asked

Output as JSON:
{
  "skillsDiscussed": ["string"],
  "strengths": ["string"],
  "concerns": ["string"],
  "culturalFitNotes": "string",
  "candidateQuestions": ["string"],
  "recommendation": "strong yes | yes | maybe | no | strong no"
}`,
    outputSchema: 'json',
  },
  {
    id: 'project_status',
    name: 'Project Status',
    description: 'Extract project status, blockers, and updates',
    prompt: `Analyze this project meeting and extract:
1. Current project status
2. Completed items since last update
3. In-progress work
4. Blockers and risks
5. Upcoming milestones

Output as JSON:
{
  "overallStatus": "on track | at risk | delayed | ahead",
  "completed": ["string"],
  "inProgress": ["string"],
  "blockers": [{"issue": "string", "owner": "string or null", "severity": "high | medium | low"}],
  "risks": ["string"],
  "nextMilestone": {"name": "string", "date": "string or null"}
}`,
    outputSchema: 'json',
  },
  {
    id: 'customer_feedback',
    name: 'Customer Feedback',
    description: 'Extract feature requests and feedback from customer calls',
    prompt: `Analyze this customer meeting and extract:
1. Feature requests or enhancement ideas
2. Pain points mentioned
3. Positive feedback
4. Competitor comparisons
5. Success metrics discussed

Output as JSON:
{
  "featureRequests": [{"request": "string", "priority": "high | medium | low", "reason": "string"}],
  "painPoints": ["string"],
  "positiveFeedback": ["string"],
  "competitorMentions": ["string"],
  "successMetrics": ["string"],
  "customerSentiment": "promoter | passive | detractor"
}`,
    outputSchema: 'json',
  },
  {
    id: 'meeting_effectiveness',
    name: 'Meeting Effectiveness',
    description: 'Analyze meeting efficiency and participation',
    prompt: `Analyze this meeting for effectiveness:
1. Was there a clear agenda?
2. Were objectives achieved?
3. How was participation distributed?
4. Were there clear outcomes?
5. Could this have been an email?

Output as JSON:
{
  "hadClearAgenda": boolean,
  "objectivesAchieved": "yes | partial | no | unclear",
  "participationBalance": "balanced | moderately balanced | dominated by few",
  "clearOutcomes": boolean,
  "couldBeEmail": boolean,
  "effectivenessScore": 1-10,
  "suggestions": ["string"]
}`,
    outputSchema: 'json',
  },
];

/**
 * Build prompt for custom insight extraction
 */
export function buildInsightPrompt(template: InsightTemplate, transcript: string): string {
  let prompt = `${template.description}\n\n`;
  prompt += '--- TRANSCRIPT ---\n';
  prompt += transcript;
  prompt += '\n--- END TRANSCRIPT ---\n\n';
  prompt += template.prompt;
  prompt += '\n\nRespond with ONLY the requested output format, no additional text.';

  return prompt;
}

/**
 * Get built-in template by ID
 */
export function getBuiltInTemplate(id: string): InsightTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

/**
 * Validate custom template
 */
export function validateTemplate(template: Partial<InsightTemplate>): string[] {
  const errors: string[] = [];

  if (!template.id || template.id.length < 1) {
    errors.push('Template ID is required');
  }

  if (!template.name || template.name.length < 1) {
    errors.push('Template name is required');
  }

  if (!template.prompt || template.prompt.length < 10) {
    errors.push('Template prompt must be at least 10 characters');
  }

  if (template.outputSchema && !['text', 'list', 'table', 'json'].includes(template.outputSchema)) {
    errors.push('Output schema must be one of: text, list, table, json');
  }

  return errors;
}
