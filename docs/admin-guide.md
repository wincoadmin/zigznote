# zigznote Admin Guide

This guide covers administration tasks for managing the zigznote platform.

## Table of Contents

1. [First-Time Admin Setup](#first-time-admin-setup)
2. [Accessing the Admin Panel](#accessing-the-admin-panel)
3. [User Management](#user-management)
4. [Organization Management](#organization-management)
5. [Billing Administration](#billing-administration)
6. [System API Keys](#system-api-keys)
7. [Feature Flags](#feature-flags)
8. [Monitoring & Analytics](#monitoring--analytics)
9. [Troubleshooting](#troubleshooting)

---

## First-Time Admin Setup

### 1. Generate Admin Credentials

Run the admin initialization script to create the first admin user:

```bash
# Generate a secure admin password
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Set environment variables
export ADMIN_JWT_SECRET="your-secure-jwt-secret"
export ADMIN_INITIAL_EMAIL="admin@yourcompany.com"
export ADMIN_INITIAL_PASSWORD="your-secure-password"
```

### 2. Configure Environment

Add to your `.env` file:

```env
# Admin Panel
ADMIN_JWT_SECRET=your-32-character-secret-key
ADMIN_COOKIE_NAME=zigznote_admin_session
ADMIN_SESSION_EXPIRY=24h
```

### 3. First Login

1. Navigate to `/admin/login`
2. Enter your credentials
3. Complete two-factor authentication setup (if enabled)

---

## Accessing the Admin Panel

The admin panel is available at:
- **Development**: `http://localhost:3001/admin`
- **Production**: `https://api.yourdomain.com/admin`

### Authentication

Admins authenticate separately from regular users:
- Admin sessions use JWT tokens stored in HTTP-only cookies
- Sessions expire after 24 hours (configurable)
- All admin actions are logged to the audit trail

---

## User Management

### Viewing Users

Navigate to **Admin > Users** to see all users across organizations.

Available filters:
- Organization
- Role (admin, member)
- Status (active, deleted)
- Date range

### User Actions

For each user, you can:
- **View Details**: See full user profile and activity
- **Impersonate**: Log in as the user (for support purposes)
- **Suspend**: Temporarily disable access
- **Delete**: Soft-delete the user account

### Bulk Operations

Select multiple users to:
- Export to CSV
- Send notifications
- Change roles

---

## Organization Management

### Viewing Organizations

Navigate to **Admin > Organizations** to manage all organizations.

### Organization Details

Each organization profile shows:
- Basic information (name, plan, created date)
- Member count
- Meeting statistics
- Billing status
- Enabled integrations

### Account Types

Organizations can have different account types:

| Type | Description |
|------|-------------|
| `REGULAR` | Standard paying customer |
| `TRIAL` | Trial period |
| `COMPLIMENTARY` | Free access (admin override) |
| `PARTNER` | Partner account with special terms |
| `INTERNAL` | Internal team account |

### Billing Overrides

To grant complimentary access:

1. Navigate to the organization
2. Click **Override Billing**
3. Select account type
4. Enter a reason (required)
5. Save changes

This action is logged and associated with your admin account.

---

## Billing Administration

### Subscription Management

View and manage subscriptions:
- See current plan and status
- View payment history
- Cancel subscriptions
- Issue refunds

### Manual Adjustments

For manual billing adjustments:
1. Navigate to **Admin > Billing**
2. Select the organization
3. Click **Create Adjustment**
4. Enter amount and reason
5. Confirm the adjustment

### Revenue Reports

Export billing reports:
- Monthly recurring revenue (MRR)
- Churn rate
- Revenue by plan
- Geographic distribution

---

## System API Keys

### Creating API Keys

System API keys provide programmatic access for internal tools:

1. Navigate to **Admin > API Keys**
2. Click **Create New Key**
3. Enter a descriptive name
4. Select permissions/scopes
5. Set expiration (optional)
6. Copy the key (shown only once)

### Key Scopes

Available scopes:
- `admin:read` - Read-only admin access
- `admin:write` - Full admin access
- `users:read` - Read user data
- `organizations:read` - Read org data
- `analytics:read` - Read analytics

### Key Rotation

Rotate keys regularly:
1. Create a new key with the same permissions
2. Update your applications
3. Revoke the old key

---

## Feature Flags

### Managing Features

Feature flags control feature availability:

1. Navigate to **Admin > Feature Flags**
2. Toggle features on/off
3. Set rollout percentages
4. Target specific organizations

### Available Flags

| Flag | Description |
|------|-------------|
| `semantic_search` | AI-powered semantic search |
| `ai_chat` | Meeting Q&A assistant |
| `voice_profiles` | Speaker recognition |
| `custom_vocabulary` | Custom word recognition |

### Gradual Rollout

For new features:
1. Enable for internal accounts first
2. Set rollout to 10%
3. Monitor for issues
4. Gradually increase percentage

---

## Monitoring & Analytics

### Dashboard Metrics

The admin dashboard shows:
- Active users (daily, weekly, monthly)
- Meeting volume
- Transcription minutes used
- API call volume
- Error rates

### Audit Logs

All admin actions are logged:
- User who performed the action
- Timestamp
- Action type
- Affected resources
- IP address

To view logs:
1. Navigate to **Admin > Audit Logs**
2. Filter by date, user, or action type
3. Export for compliance

### Alerts

Configure alerts for:
- Unusual activity patterns
- Error rate spikes
- Billing issues
- Security events

---

## Troubleshooting

### Common Issues

#### Meeting Bot Not Joining

1. Check the meeting URL format
2. Verify the meeting platform is supported
3. Check the bot status in the meeting details
4. Review error logs for the specific meeting

#### Transcription Delays

1. Check queue depth in admin dashboard
2. Verify worker services are running
3. Check for API rate limits
4. Review audio quality metrics

#### User Cannot Login

1. Verify user exists in the system
2. Check organization status
3. Clear user's browser cache
4. Reset password if needed

### Logs Access

Access logs through the admin panel or CLI:

```bash
# View recent API errors
pnpm run logs:api --level=error --limit=100

# View specific user activity
pnpm run logs:user --userId=xxx --limit=50

# View organization events
pnpm run logs:org --orgId=xxx --since="1 hour ago"
```

### Support Escalation

For issues requiring engineering support:
1. Gather relevant logs and error messages
2. Note the affected user/organization IDs
3. Create an incident ticket
4. Tag with appropriate severity

---

## Security Best Practices

### Admin Account Security

- Use strong, unique passwords
- Enable two-factor authentication
- Rotate passwords regularly
- Use individual admin accounts (no sharing)

### Access Control

- Grant minimum required permissions
- Review admin access quarterly
- Remove access for departed employees immediately
- Use audit logs to monitor access

### Data Handling

- Never share customer data externally
- Use impersonation sparingly
- Document all data access
- Follow data retention policies

---

## Support Resources

- **Internal Wiki**: `wiki.yourcompany.com/zigznote`
- **Engineering Slack**: `#zigznote-engineering`
- **On-Call**: `oncall@yourcompany.com`
- **Security Issues**: `security@yourcompany.com`
