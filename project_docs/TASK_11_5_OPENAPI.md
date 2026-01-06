# Task 11.5: OpenAPI Documentation

## Overview
Add OpenAPI/Swagger documentation so API consumers can explore and test endpoints interactively.

---

## Step 1: Install Dependencies

```bash
pnpm --filter @zigznote/api add swagger-jsdoc swagger-ui-express
pnpm --filter @zigznote/api add -D @types/swagger-jsdoc @types/swagger-ui-express
```

---

## Step 2: Create OpenAPI Configuration

**File:** `apps/api/src/docs/openapi.ts`

```typescript
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
            platform: { type: 'string', enum: ['zoom', 'meet', 'teams', 'webex', 'other'] },
            meetingUrl: { type: 'string', format: 'uri' },
            status: { type: 'string', enum: ['scheduled', 'pending', 'joining', 'recording', 'processing', 'completed', 'failed', 'cancelled'] },
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
      },
    },
    security: [{ bearerAuth: [] }, { apiKey: [] }],
  },
  apis: ['./src/routes/**/*.ts', './src/docs/schemas/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
```

---

## Step 3: Add Route Documentation

Add JSDoc comments to routes. Here are examples for key endpoints:

**File:** `apps/api/src/routes/health.ts`

Add at the top of the file, before the route:

```typescript
/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check if the API is running
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
```

**File:** `apps/api/src/routes/meetings.ts`

Add before the GET / route:

```typescript
/**
 * @openapi
 * /api/v1/meetings:
 *   get:
 *     summary: List meetings
 *     description: Get paginated list of meetings for the authenticated user's organization
 *     tags: [Meetings]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, pending, joining, recording, processing, completed, failed, cancelled]
 *     responses:
 *       200:
 *         description: List of meetings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meetings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Meeting'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
```

Add before the POST / route:

```typescript
/**
 * @openapi
 * /api/v1/meetings:
 *   post:
 *     summary: Create a meeting
 *     description: Create a new meeting and optionally start the recording bot
 *     tags: [Meetings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Meeting title
 *               meetingUrl:
 *                 type: string
 *                 format: uri
 *                 description: Meeting URL (Zoom, Meet, Teams)
 *               startBot:
 *                 type: boolean
 *                 default: false
 *                 description: Start recording bot immediately
 *               scheduledStart:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Meeting created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meeting:
 *                   $ref: '#/components/schemas/Meeting'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
```

Add before the GET /:id route:

```typescript
/**
 * @openapi
 * /api/v1/meetings/{id}:
 *   get:
 *     summary: Get meeting details
 *     description: Get detailed information about a specific meeting
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Meeting details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meeting:
 *                   $ref: '#/components/schemas/Meeting'
 *                 transcript:
 *                   $ref: '#/components/schemas/Transcript'
 *                 summary:
 *                   $ref: '#/components/schemas/Summary'
 *       404:
 *         description: Meeting not found
 */
```

---

## Step 4: Mount Swagger UI

**File:** `apps/api/src/app.ts`

Add imports at the top:

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/openapi';
```

Add routes (before other routes, after middleware):

```typescript
// Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'zigznote API Documentation',
}));

// OpenAPI spec as JSON
app.get('/api/docs/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});
```

---

## Step 5: Create Docs Directory

Create the directory for additional schema files:

```bash
mkdir -p apps/api/src/docs/schemas
```

**File:** `apps/api/src/docs/schemas/.gitkeep`

```
# Placeholder for additional OpenAPI schema files
```

---

## Step 6: Add More Route Docs (Optional but Recommended)

Add similar JSDoc comments to these routes:

**Search routes (`apps/api/src/routes/search.ts`):**

```typescript
/**
 * @openapi
 * /api/v1/search:
 *   get:
 *     summary: Search meetings
 *     description: Search across meetings, transcripts, and summaries
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [meeting, transcript, summary, action_item]
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       title:
 *                         type: string
 *                       snippet:
 *                         type: string
 *                       score:
 *                         type: number
 */
```

**Chat routes (`apps/api/src/routes/chat.ts`):**

```typescript
/**
 * @openapi
 * /api/v1/chat:
 *   post:
 *     summary: Chat with AI
 *     description: Send a message to AI about meetings
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               meetingId:
 *                 type: string
 *                 format: uuid
 *               chatId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                 citations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       meetingId:
 *                         type: string
 *                       text:
 *                         type: string
 *                       timestamp:
 *                         type: number
 */
```

---

## Verification Checklist

- [ ] Dependencies installed: `swagger-jsdoc`, `swagger-ui-express`
- [ ] OpenAPI config file created at `apps/api/src/docs/openapi.ts`
- [ ] JSDoc comments added to at least 3-4 routes
- [ ] Swagger UI mounted in app.ts
- [ ] Server starts without errors
- [ ] Visit http://localhost:3001/api/docs - Swagger UI loads
- [ ] Visit http://localhost:3001/api/docs/openapi.json - JSON spec returned
- [ ] Can see documented endpoints in Swagger UI
- [ ] "Try it out" works for unauthenticated endpoints (/health)
