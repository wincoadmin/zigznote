# zigznote API Reference

Base URL: `http://localhost:3001/api/v1`

## Authentication

All API endpoints (except health checks) require authentication via Clerk.

```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Health

#### GET /health

Returns server health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T14:30:00Z",
  "version": "0.1.0",
  "uptime": 3600,
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

#### GET /health/live

Liveness probe for Kubernetes.

#### GET /health/ready

Readiness probe for Kubernetes.

---

### Meetings

#### GET /api/v1/meetings

List meetings with pagination.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |
| status | string | - | Filter by status |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Product Sync",
      "platform": "zoom",
      "status": "completed",
      "startTime": "2024-01-15T14:00:00Z",
      "endTime": "2024-01-15T15:00:00Z",
      "durationSeconds": 3600,
      "createdAt": "2024-01-15T13:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

#### GET /api/v1/meetings/:id

Get a single meeting by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Product Sync",
    "platform": "zoom",
    "meetingUrl": "https://zoom.us/j/123456789",
    "status": "completed",
    "startTime": "2024-01-15T14:00:00Z",
    "endTime": "2024-01-15T15:00:00Z",
    "durationSeconds": 3600,
    "participants": [
      {
        "name": "John Doe",
        "email": "john@example.com",
        "speakerLabel": "Speaker 1"
      }
    ],
    "createdAt": "2024-01-15T13:00:00Z"
  }
}
```

#### POST /api/v1/meetings

Create a new meeting.

**Request Body:**
```json
{
  "title": "Weekly Standup",
  "platform": "zoom",
  "meetingUrl": "https://zoom.us/j/123456789",
  "startTime": "2024-01-16T09:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Weekly Standup",
    "status": "scheduled",
    "createdAt": "2024-01-15T13:00:00Z"
  }
}
```

#### DELETE /api/v1/meetings/:id

Delete a meeting.

**Response:** `204 No Content`

---

### Transcripts

#### GET /api/v1/meetings/:id/transcript

Get the transcript for a meeting.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "meetingId": "uuid",
    "segments": [
      {
        "speaker": "Speaker 1",
        "text": "Hello everyone, let's get started.",
        "startMs": 0,
        "endMs": 3500,
        "confidence": 0.95
      }
    ],
    "fullText": "...",
    "wordCount": 1500,
    "language": "en"
  }
}
```

---

### Summaries

#### GET /api/v1/meetings/:id/summary

Get the AI-generated summary for a meeting.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "meetingId": "uuid",
    "content": {
      "executiveSummary": "The team discussed Q1 roadmap...",
      "topics": [
        {
          "title": "Q1 Roadmap",
          "summary": "Key features planned..."
        }
      ],
      "decisions": [
        "Prioritize mobile app development"
      ],
      "questions": [
        "What is the timeline for Phase 2?"
      ]
    },
    "modelUsed": "claude-3-5-sonnet-20241022"
  }
}
```

#### POST /api/v1/meetings/:id/summary/regenerate

Regenerate the summary with optional custom prompt.

**Request Body:**
```json
{
  "customPrompt": "Focus on technical decisions"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Meeting not found"
  },
  "requestId": "uuid"
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| VALIDATION_ERROR | 400 | Invalid request data |
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| TOO_MANY_REQUESTS | 429 | Rate limit exceeded |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| General | 100 requests/minute |
| Auth | 10 requests/minute |
| Upload | 10 requests/minute |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
