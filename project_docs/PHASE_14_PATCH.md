# Phase 14 Patch: Organization Settings API & Pricing Link

**Date:** January 7, 2026  
**Priority:** High (fixes broken functionality)  
**Effort:** 30 minutes

---

## Issue 1: Organization Settings API Missing New Fields

### Problem

The UI at `/settings/page.tsx` sends `timezone`, `industry`, `companySize`, `website` to the API, but:
- **GET** doesn't return these fields from the `Organization` model
- **PATCH** only updates `OrganizationSettings` model, not `Organization` model

The new fields exist on `Organization` model (added in Phase 14 schema), but the API ignores them.

### Fix

**File:** `apps/web/app/api/settings/organization/route.ts`

#### GET - Add org fields to response (around line 39-52)

```typescript
// REPLACE this section:
return NextResponse.json({
  success: true,
  data: {
    organizationName: user.organization?.name || '',
    recordingConsentEnabled: settings.recordingConsentEnabled,
    // ... rest
  },
});

// WITH:
return NextResponse.json({
  success: true,
  data: {
    organizationName: user.organization?.name || '',
    // Organization model fields (Phase 14)
    timezone: user.organization?.timezone || 'UTC',
    industry: user.organization?.industry || '',
    companySize: user.organization?.companySize || '',
    website: user.organization?.website || '',
    // OrganizationSettings fields
    recordingConsentEnabled: settings.recordingConsentEnabled,
    consentAnnouncementText: settings.consentAnnouncementText,
    requireExplicitConsent: settings.requireExplicitConsent,
    defaultBotName: settings.defaultBotName,
    joinAnnouncementEnabled: settings.joinAnnouncementEnabled,
    autoJoinMeetings: (settings as any).autoJoinMeetings ?? true,
    autoGenerateSummaries: (settings as any).autoGenerateSummaries ?? true,
    extractActionItems: (settings as any).extractActionItems ?? true,
  },
});
```

#### PATCH - Handle both Organization and OrganizationSettings updates (around line 86-115)

```typescript
// REPLACE the PATCH handler body with:

const body = await request.json();

// Fields for Organization model
const orgFields = ['name', 'timezone', 'industry', 'companySize', 'website'];
const orgUpdateData: Record<string, any> = {};

for (const field of orgFields) {
  if (body[field] !== undefined) {
    orgUpdateData[field] = body[field];
  }
}

// Update Organization if there are org fields
if (Object.keys(orgUpdateData).length > 0) {
  await prisma.organization.update({
    where: { id: user.organizationId },
    data: orgUpdateData,
  });
}

// Fields for OrganizationSettings model
const settingsFields = [
  'recordingConsentEnabled',
  'consentAnnouncementText',
  'requireExplicitConsent',
  'defaultBotName',
  'joinAnnouncementEnabled',
  'autoJoinMeetings',
  'autoGenerateSummaries',
  'extractActionItems',
];

const settingsUpdateData: Record<string, any> = {};
for (const field of settingsFields) {
  if (body[field] !== undefined) {
    settingsUpdateData[field] = body[field];
  }
}

// Upsert OrganizationSettings if there are settings fields
let settings;
if (Object.keys(settingsUpdateData).length > 0) {
  settings = await prisma.organizationSettings.upsert({
    where: { organizationId: user.organizationId },
    create: {
      organizationId: user.organizationId,
      ...settingsUpdateData,
    },
    update: settingsUpdateData,
  });
} else {
  settings = await prisma.organizationSettings.findUnique({
    where: { organizationId: user.organizationId },
  });
}

// Fetch updated org for response
const updatedOrg = await prisma.organization.findUnique({
  where: { id: user.organizationId },
});

return NextResponse.json({
  success: true,
  data: {
    organizationName: updatedOrg?.name || '',
    timezone: updatedOrg?.timezone || 'UTC',
    industry: updatedOrg?.industry || '',
    companySize: updatedOrg?.companySize || '',
    website: updatedOrg?.website || '',
    recordingConsentEnabled: settings?.recordingConsentEnabled ?? true,
    consentAnnouncementText: settings?.consentAnnouncementText,
    requireExplicitConsent: settings?.requireExplicitConsent ?? false,
    defaultBotName: settings?.defaultBotName,
    joinAnnouncementEnabled: settings?.joinAnnouncementEnabled ?? true,
    autoJoinMeetings: (settings as any)?.autoJoinMeetings ?? true,
    autoGenerateSummaries: (settings as any)?.autoGenerateSummaries ?? true,
    extractActionItems: (settings as any)?.extractActionItems ?? true,
  },
});
```

---

## Issue 2: Home Page Missing Pricing Link

### Problem

The home page navigation has no link to `/pricing`.

### Fix

**File:** `apps/web/app/page.tsx`

#### Update navigation section (around line 18-25)

```tsx
// REPLACE:
<div className="flex items-center gap-4">
  <Link href="/sign-in" className="btn-ghost">
    Sign in
  </Link>
  <Link href="/sign-up" className="btn-primary">
    Get started
  </Link>
</div>

// WITH:
<div className="flex items-center gap-4">
  <Link href="/pricing" className="text-slate-600 hover:text-slate-900">
    Pricing
  </Link>
  <Link href="/sign-in" className="btn-ghost">
    Sign in
  </Link>
  <Link href="/sign-up" className="btn-primary">
    Get started
  </Link>
</div>
```

---

## Complete Fixed File: Organization Settings API

For convenience, here is the complete corrected file:

**File:** `apps/web/app/api/settings/organization/route.ts`

```typescript
/**
 * Organization Settings API
 * Handles both Organization model fields and OrganizationSettings model fields
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get or create organization settings
    let settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: user.organizationId },
    });

    if (!settings) {
      settings = await prisma.organizationSettings.create({
        data: { organizationId: user.organizationId },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        // Organization model fields
        organizationName: user.organization?.name || '',
        timezone: user.organization?.timezone || 'UTC',
        industry: user.organization?.industry || '',
        companySize: user.organization?.companySize || '',
        website: user.organization?.website || '',
        // OrganizationSettings model fields
        recordingConsentEnabled: settings.recordingConsentEnabled,
        consentAnnouncementText: settings.consentAnnouncementText,
        requireExplicitConsent: settings.requireExplicitConsent,
        defaultBotName: settings.defaultBotName,
        joinAnnouncementEnabled: settings.joinAnnouncementEnabled,
        autoJoinMeetings: (settings as any).autoJoinMeetings ?? true,
        autoGenerateSummaries: (settings as any).autoGenerateSummaries ?? true,
        extractActionItems: (settings as any).extractActionItems ?? true,
      },
    });
  } catch (error) {
    console.error('Error fetching organization settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch organization settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and check admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to update organization settings' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Fields for Organization model
    const orgFields = ['name', 'timezone', 'industry', 'companySize', 'website'];
    const orgUpdateData: Record<string, any> = {};

    for (const field of orgFields) {
      if (body[field] !== undefined) {
        orgUpdateData[field] = body[field];
      }
    }

    // Update Organization if there are org fields
    if (Object.keys(orgUpdateData).length > 0) {
      await prisma.organization.update({
        where: { id: user.organizationId },
        data: orgUpdateData,
      });
    }

    // Fields for OrganizationSettings model
    const settingsFields = [
      'recordingConsentEnabled',
      'consentAnnouncementText',
      'requireExplicitConsent',
      'defaultBotName',
      'joinAnnouncementEnabled',
      'autoJoinMeetings',
      'autoGenerateSummaries',
      'extractActionItems',
    ];

    const settingsUpdateData: Record<string, any> = {};
    for (const field of settingsFields) {
      if (body[field] !== undefined) {
        settingsUpdateData[field] = body[field];
      }
    }

    // Upsert OrganizationSettings if there are settings fields
    let settings;
    if (Object.keys(settingsUpdateData).length > 0) {
      settings = await prisma.organizationSettings.upsert({
        where: { organizationId: user.organizationId },
        create: {
          organizationId: user.organizationId,
          ...settingsUpdateData,
        },
        update: settingsUpdateData,
      });
    } else {
      settings = await prisma.organizationSettings.findUnique({
        where: { organizationId: user.organizationId },
      });
    }

    // Fetch updated org for response
    const updatedOrg = await prisma.organization.findUnique({
      where: { id: user.organizationId },
    });

    return NextResponse.json({
      success: true,
      data: {
        organizationName: updatedOrg?.name || '',
        timezone: updatedOrg?.timezone || 'UTC',
        industry: updatedOrg?.industry || '',
        companySize: updatedOrg?.companySize || '',
        website: updatedOrg?.website || '',
        recordingConsentEnabled: settings?.recordingConsentEnabled ?? true,
        consentAnnouncementText: settings?.consentAnnouncementText,
        requireExplicitConsent: settings?.requireExplicitConsent ?? false,
        defaultBotName: settings?.defaultBotName,
        joinAnnouncementEnabled: settings?.joinAnnouncementEnabled ?? true,
        autoJoinMeetings: (settings as any)?.autoJoinMeetings ?? true,
        autoGenerateSummaries: (settings as any)?.autoGenerateSummaries ?? true,
        extractActionItems: (settings as any)?.extractActionItems ?? true,
      },
    });
  } catch (error) {
    console.error('Error updating organization settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update organization settings' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and check admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to delete organization' },
        { status: 403 }
      );
    }

    // Delete organization (cascade will delete related data)
    await prisma.organization.delete({
      where: { id: user.organizationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}
```

---

## Claude Code Prompt

```
# Phase 14 Patch: Fix Organization Settings API & Add Pricing Link

## Task 1: Fix Organization Settings API

Replace the entire file `apps/web/app/api/settings/organization/route.ts` with the corrected version from the patch spec at `/project_docs/PHASE_14_PATCH.md`.

Key changes:
- GET now returns timezone, industry, companySize, website from Organization model
- PATCH now updates both Organization model AND OrganizationSettings model

## Task 2: Add Pricing Link to Home Page

In `apps/web/app/page.tsx`, add a Pricing link before "Sign in":

```tsx
<Link href="/pricing" className="text-slate-600 hover:text-slate-900">
  Pricing
</Link>
```

## Verify

1. Run `pnpm build` - should complete without errors
2. Test: Login as admin, go to Settings > Organization
3. Change timezone/industry/companySize/website
4. Click Save - should succeed
5. Refresh page - values should persist
6. Visit home page - Pricing link should be visible

Commit: "Phase 14 Patch: Fix org settings API and add pricing link"
```

---

## Testing Checklist

- [ ] GET `/api/settings/organization` returns timezone, industry, companySize, website
- [ ] PATCH with `{ timezone: "America/New_York" }` updates Organization model
- [ ] PATCH with `{ autoJoinMeetings: false }` updates OrganizationSettings model
- [ ] Values persist after page refresh
- [ ] Home page shows Pricing link
- [ ] Pricing link navigates to `/pricing`
