/**
 * OpenAPI/Swagger Configuration
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'zigznote API',
      version: '1.0.0',
      description: `
# zigznote API Documentation

AI-powered meeting assistant API for managing meetings, transcriptions, summaries, and more.

## Authentication

All endpoints (except health checks) require authentication:

**Bearer Token (Clerk JWT)**
\`\`\`
Authorization: Bearer <jwt_token>
\`\`\`

**API Key**
\`\`\`
X-API-Key: zn_live_xxx...
\`\`\`

## Rate Limits

| Tier | Limit |
|------|-------|
| Standard | 100 requests/minute |
| Strict | 20 requests/minute |
| Expensive | 10 requests/minute |

## Errors

\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
\`\`\`
      `,
      contact: {
        name: 'zigznote Support',
        email: 'support@zigznote.com',
      },
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Development' },
      { url: 'https://api.zigznote.com', description: 'Production' },
    ],
    tags: [
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Meetings', description: 'Meeting management' },
      { name: 'Transcripts', description: 'Transcript operations' },
      { name: 'Summaries', description: 'AI-generated summaries' },
      { name: 'Search', description: 'Search functionality' },
      { name: 'Chat', description: 'AI chat with meetings' },
      { name: 'Billing', description: 'Subscription and billing' },
      { name: 'Calendar', description: 'Calendar integration' },
      { name: 'Integrations', description: 'Third-party integrations' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            pages: { type: 'integer' },
          },
        },
        Meeting: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            organizationId: { type: 'string', format: 'uuid' },
            platform: {
              type: 'string',
              enum: ['zoom', 'meet', 'teams', 'webex', 'other'],
            },
            meetingUrl: { type: 'string', format: 'uri' },
            status: {
              type: 'string',
              enum: [
                'scheduled',
                'pending',
                'joining',
                'recording',
                'processing',
                'completed',
                'failed',
                'cancelled',
              ],
            },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            duration: { type: 'integer', description: 'Duration in seconds' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Transcript: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            meetingId: { type: 'string', format: 'uuid' },
            content: { type: 'string' },
            segments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  speaker: { type: 'string' },
                  text: { type: 'string' },
                  start: { type: 'number' },
                  end: { type: 'number' },
                },
              },
            },
          },
        },
        Summary: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            meetingId: { type: 'string', format: 'uuid' },
            overview: { type: 'string' },
            keyPoints: { type: 'array', items: { type: 'string' } },
            decisions: { type: 'array', items: { type: 'string' } },
            actionItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  task: { type: 'string' },
                  assignee: { type: 'string' },
                  dueDate: { type: 'string' },
                },
              },
            },
          },
        },
        SearchResult: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['meeting', 'transcript', 'summary', 'action_item'] },
            title: { type: 'string' },
            snippet: { type: 'string' },
            score: { type: 'number' },
            meetingId: { type: 'string', format: 'uuid' },
          },
        },
        ChatMessage: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['user', 'assistant'] },
            content: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            plan: { type: 'string', enum: ['free', 'starter', 'pro', 'enterprise'] },
            status: { type: 'string', enum: ['active', 'cancelled', 'past_due', 'trialing'] },
            currentPeriodEnd: { type: 'string', format: 'date-time' },
            cancelAtPeriodEnd: { type: 'boolean' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }, { apiKey: [] }],
  },
  apis: ['./src/routes/**/*.ts', './src/docs/schemas/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
