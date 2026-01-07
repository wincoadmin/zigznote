# Phase 14: Team Management & Settings Reorganization
## Corrected Specification Based on Full Codebase Review

**Date:** January 7, 2026  
**Status:** Ready for Implementation  
**Priority:** High

---

## Executive Summary

This specification corrects and reorganizes Phase 14 based on a comprehensive review of the current zigznote codebase. It addresses three critical issues:

1. **Role-based access control violations** - Settings UI shows admin pages to all users
2. **Billing placement error** - Billing/pricing is inside admin settings instead of public site
3. **Missing features** - Direct user creation, organization settings fields

---

## Part 1: Current State Analysis

### 1.1 What Exists (Working)

| Feature | Location | Status |
|---------|----------|--------|
| Invitation system | `/api/members/invite` | ✅ Working with admin check |
| Member list | `/api/members` | ✅ Working (all users can see) |
| Role update | `/api/members/[id]` PATCH | ✅ Working with admin check |
| Remove member | `/api/members/[id]` DELETE | ✅ Working with admin check |
| Cancel invitation | `/api/members/invitations/[id]` | ✅ Working with admin check |
| Resend invitation | `/api/members/resend-invite/[id]` | ✅ Working with admin check |
| Org name update | `/api/settings/organization/name` | ✅ Working with admin check |
| Org settings update | `/api/settings/organization` | ✅ Working with admin check |

### 1.2 What's Broken (Must Fix)

| Issue | Location | Problem |
|-------|----------|---------|
| Settings nav shows all items | `/apps/web/app/settings/layout.tsx` | No role filtering - members see admin pages |
| Billing in settings | `/apps/web/app/settings/billing/` | Should be public pricing page |
| Webhooks visible to members | `/apps/web/app/settings/webhooks/` | UI shows to all, should be admin-only |
| API Keys visible to members | `/apps/web/app/settings/api-keys/` | UI shows to all, should be admin-only |
| Team page visible to members | `/apps/web/app/settings/team/` | Members shouldn't access this |

### 1.3 What's Missing (Must Add)

| Feature | Description |
|---------|-------------|
| Direct user creation | Admin creates user with temp password (not just invite) |
| Organization logo | Upload/manage org logo |
| Organization metadata | Timezone, industry, company size, website |
| Role-based settings nav | Hide admin items from members |
| Public pricing page | Move billing/pricing to home site |

### 1.4 Integrations Already Implemented

The following integrations exist and are working:
- ✅ Slack (`/apps/api/src/integrations/slack/`)
- ✅ HubSpot (`/apps/api/src/integrations/hubspot/`)
- ✅ Salesforce (`/apps/api/src/integrations/salesforce/`)
- ✅ Google Calendar (via `/apps/api/src/services/googleCalendarService.ts`)
- ✅ Zoom (`/apps/api/src/integrations/zoom/`)
- ✅ Microsoft Teams (`/apps/api/src/integrations/microsoft/`)

---

## Part 2: Required Changes

### 2.1 Database Schema Updates

**File:** `packages/database/prisma/schema.prisma`

Add fields to Organization model:

```prisma
model Organization {
  // ... existing fields ...
  
  // NEW: Organization branding and metadata
  logo          String?   // S3 URL for org logo
  timezone      String    @default("UTC")
  industry      String?   // e.g., "Technology", "Healthcare", "Finance"
  companySize   String?   @map("company_size") // "1-10", "11-50", "51-200", "201-500", "500+"
  website       String?   // Company website URL
  
  // ... existing relations ...
}
```

**Migration required:** Yes

---

### 2.2 Settings Layout - Role-Based Navigation

**File:** `apps/web/app/settings/layout.tsx`

**Current Problem:** Shows all 9 navigation items to all users regardless of role.

**Required Fix:** Implement role-based filtering.

```tsx
'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  User,
  Shield,
  Building2,
  Users,
  Bell,
  Key,
  Puzzle,
  Webhook,
} from 'lucide-react';

interface SettingsLayoutProps {
  children: ReactNode;
}

// Navigation configuration with role requirements
const settingsNav = [
  // Personal section - all users
  { name: 'Profile', href: '/settings/profile', icon: User, adminOnly: false },
  { name: 'Security', href: '/settings/security', icon: Shield, adminOnly: false },
  { name: 'Notifications', href: '/settings/notifications', icon: Bell, adminOnly: false },
  
  // Organization section - admin only
  { name: 'Organization', href: '/settings', icon: Building2, adminOnly: true, exact: true },
  { name: 'Team Members', href: '/settings/team', icon: Users, adminOnly: true },
  { name: 'Integrations', href: '/settings/integrations', icon: Puzzle, adminOnly: false },
  { name: 'API Keys', href: '/settings/api-keys', icon: Key, adminOnly: true },
  { name: 'Webhooks', href: '/settings/webhooks', icon: Webhook, adminOnly: true },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const isAdmin = (session?.user as any)?.role === 'admin';

  // Filter nav items based on role
  const visibleNav = settingsNav.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <nav className="w-56 flex-shrink-0">
            {/* Personal Section */}
            <div className="mb-6">
              <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Personal
              </h3>
              <ul className="space-y-1">
                {visibleNav.filter(item => 
                  ['Profile', 'Security', 'Notifications'].includes(item.name)
                ).map((item) => {
                  const Icon = item.icon;
                  const isActive = item.exact 
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + '/');

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Organization Section - Only show header if admin */}
            {isAdmin && (
              <div className="mb-6">
                <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Organization
                </h3>
                <ul className="space-y-1">
                  {visibleNav.filter(item => 
                    ['Organization', 'Team Members', 'Integrations', 'API Keys', 'Webhooks'].includes(item.name)
                  ).map((item) => {
                    const Icon = item.icon;
                    const isActive = item.exact 
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(item.href + '/');

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Integrations for non-admin */}
            {!isAdmin && (
              <div className="mb-6">
                <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Connections
                </h3>
                <ul className="space-y-1">
                  <li>
                    <Link
                      href="/settings/integrations"
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                        pathname === '/settings/integrations'
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      )}
                    >
                      <Puzzle className="h-4 w-4" />
                      Integrations
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
```

---

### 2.3 Remove Billing from Settings

**Action:** Delete the billing settings page and redirect to public pricing.

**Files to Delete:**
- `apps/web/app/settings/billing/page.tsx`

**Files to Create:**

**File:** `apps/web/app/(marketing)/pricing/page.tsx`

```tsx
import Link from 'next/link';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    description: 'For individuals getting started',
    features: [
      '5 meetings per month',
      'Basic transcription',
      'AI summaries',
      'Email support',
    ],
    cta: 'Get Started',
    href: '/sign-up',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For growing teams',
    features: [
      'Unlimited meetings',
      'Advanced transcription',
      'Custom AI prompts',
      'Slack & HubSpot integrations',
      'Priority support',
      'API access',
    ],
    cta: 'Start Free Trial',
    href: '/sign-up?plan=pro',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: '/month',
    description: 'For large organizations',
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'SSO / SAML',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    href: '/contact',
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary-500" />
              <span className="font-heading text-xl font-bold">
                <span className="text-primary-500">zig</span>
                <span className="text-slate-700">note</span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/sign-in" className="text-slate-600 hover:text-slate-900">
                Sign in
              </Link>
              <Link href="/sign-up" className="btn-primary">
                Get started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Pricing Section */}
      <div className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="mt-4 text-xl text-slate-600">
              Choose the plan that works for your team
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'bg-primary-600 text-white shadow-xl scale-105'
                    : 'bg-white border border-slate-200 shadow-sm'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-amber-400 text-amber-900 text-sm font-medium px-4 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className={`text-xl font-bold ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>
                  {plan.name}
                </h3>
                <p className={`mt-2 text-sm ${plan.highlighted ? 'text-primary-100' : 'text-slate-500'}`}>
                  {plan.description}
                </p>

                <div className="mt-6">
                  <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className={plan.highlighted ? 'text-primary-100' : 'text-slate-500'}>
                      {plan.period}
                    </span>
                  )}
                </div>

                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className={`h-5 w-5 flex-shrink-0 ${
                        plan.highlighted ? 'text-primary-200' : 'text-primary-500'
                      }`} />
                      <span className={`text-sm ${plan.highlighted ? 'text-primary-50' : 'text-slate-600'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`mt-8 block w-full py-3 px-4 text-center rounded-lg font-medium transition-colors ${
                    plan.highlighted
                      ? 'bg-white text-primary-600 hover:bg-primary-50'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} zigznote. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
```

**Update home page navigation to include Pricing link:**

In `apps/web/app/page.tsx`, add:
```tsx
<Link href="/pricing" className="text-slate-600 hover:text-slate-900 mr-4">
  Pricing
</Link>
```

---

### 2.4 Admin-Only Route Protection

**File:** `apps/web/app/settings/team/page.tsx` (and other admin pages)

Add client-side protection at the top of each admin-only page:

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function TeamMembersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const isAdmin = (session?.user as any)?.role === 'admin';

  useEffect(() => {
    if (status === 'authenticated' && !isAdmin) {
      router.replace('/settings/profile');
    }
  }, [status, isAdmin, router]);

  // Show loading while checking auth
  if (status === 'loading' || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  // ... rest of component
}
```

Apply this pattern to:
- `/settings/team/page.tsx`
- `/settings/api-keys/page.tsx`
- `/settings/webhooks/page.tsx`
- `/settings/page.tsx` (General/Organization settings)

---

### 2.5 Direct User Creation

**File:** `apps/web/app/api/members/create/route.ts` (NEW)

```typescript
/**
 * Direct User Creation API Route
 * Admin creates user with temporary password
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@zigznote/database';
import { hashPassword } from '@/lib/password';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only admins can create users
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin role required to create users' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { 
      email, 
      firstName, 
      lastName, 
      role = 'member',
      sendWelcomeEmail = true,
      temporaryPassword 
    } = body;

    // Validate required fields
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!firstName || typeof firstName !== 'string') {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate role
    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "admin" or "member"' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    // Generate or use provided temporary password
    const password = temporaryPassword || crypto.randomBytes(12).toString('base64').slice(0, 16);
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName || ''}`.trim(),
        password: hashedPassword,
        role,
        organizationId: user.organizationId,
        emailVerified: new Date(), // Admin-created users are pre-verified
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // TODO: Send welcome email with credentials if sendWelcomeEmail is true
    // await sendWelcomeEmail({
    //   to: email,
    //   firstName,
    //   organizationName: user.organization?.name,
    //   temporaryPassword: password,
    //   loginUrl: `${process.env.NEXTAUTH_URL}/sign-in`,
    // });

    return NextResponse.json({
      success: true,
      data: {
        ...newUser,
        temporaryPassword: password, // Return so admin can share with user
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
```

---

### 2.6 Enhanced Team Members Page with Create User

Update `/apps/web/app/settings/team/page.tsx` to include both invite and create options:

Add a new modal for direct user creation:

```tsx
// Add to existing TeamMembersPage component

const [showCreateModal, setShowCreateModal] = useState(false);
const [createForm, setCreateForm] = useState({
  firstName: '',
  lastName: '',
  email: '',
  role: 'member' as 'member' | 'admin',
  generatePassword: true,
  temporaryPassword: '',
});
const [creating, setCreating] = useState(false);
const [createdUser, setCreatedUser] = useState<{ email: string; temporaryPassword: string } | null>(null);

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  setCreateForm(prev => ({ ...prev, temporaryPassword: password }));
};

const handleCreateUser = async () => {
  if (!createForm.firstName || !createForm.email) {
    addToast({ type: 'error', title: 'Error', description: 'First name and email are required' });
    return;
  }

  setCreating(true);
  try {
    const response = await fetch('/api/members/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: createForm.email,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        role: createForm.role,
        temporaryPassword: createForm.generatePassword ? undefined : createForm.temporaryPassword,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      setCreatedUser({
        email: data.data.email,
        temporaryPassword: data.data.temporaryPassword,
      });
      setShowCreateModal(false);
      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        role: 'member',
        generatePassword: true,
        temporaryPassword: '',
      });
      fetchData();
    } else {
      throw new Error(data.error || 'Failed to create user');
    }
  } catch (error) {
    addToast({
      type: 'error',
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to create user',
    });
  } finally {
    setCreating(false);
  }
};
```

Add button and modal JSX (shown in the existing team page):

```tsx
{/* Add User Options */}
<div className="flex gap-2">
  <Button variant="outline" onClick={() => setShowInviteModal(true)}>
    <Mail className="h-4 w-4 mr-2" />
    Send Invitation
  </Button>
  <Button onClick={() => setShowCreateModal(true)}>
    <UserPlus className="h-4 w-4 mr-2" />
    Create User
  </Button>
</div>

{/* Create User Modal */}
{showCreateModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Create Team Member</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                value={createForm.firstName}
                onChange={(e) => setCreateForm(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={createForm.lastName}
                onChange={(e) => setCreateForm(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                placeholder="Doe"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
              placeholder="john@company.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm(prev => ({ ...prev, role: e.target.value as 'member' | 'admin' }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Temporary Password
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={createForm.temporaryPassword}
                onChange={(e) => setCreateForm(prev => ({ ...prev, temporaryPassword: e.target.value }))}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-md font-mono text-sm"
                placeholder="Auto-generated if empty"
              />
              <Button type="button" variant="outline" onClick={generatePassword}>
                Generate
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              User will be prompted to change password on first login.
            </p>
          </div>
        </div>
      </div>
      <div className="px-6 py-4 bg-slate-50 rounded-b-lg flex justify-end gap-3">
        <Button variant="outline" onClick={() => setShowCreateModal(false)}>
          Cancel
        </Button>
        <Button onClick={handleCreateUser} disabled={creating}>
          {creating ? 'Creating...' : 'Create User'}
        </Button>
      </div>
    </div>
  </div>
)}

{/* Show Created User Credentials */}
{createdUser && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
      <div className="text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">User Created Successfully</h3>
        <p className="text-sm text-slate-500 mt-1">
          Share these credentials with the new user securely.
        </p>
      </div>
      
      <div className="mt-6 p-4 bg-slate-50 rounded-lg space-y-3">
        <div>
          <p className="text-xs text-slate-500">Email</p>
          <p className="font-mono text-sm">{createdUser.email}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Temporary Password</p>
          <p className="font-mono text-sm bg-white px-2 py-1 rounded border">
            {createdUser.temporaryPassword}
          </p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          ⚠️ This password will only be shown once. Make sure to copy it now.
        </p>
      </div>

      <Button 
        className="w-full mt-6" 
        onClick={() => setCreatedUser(null)}
      >
        Done
      </Button>
    </div>
  </div>
)}
```

---

### 2.7 Organization Settings Page Updates

**File:** `apps/web/app/settings/page.tsx`

Add new organization fields (logo, timezone, industry, size, website):

```tsx
// Add to existing settings page

// New state for additional org fields
const [orgDetails, setOrgDetails] = useState({
  timezone: 'UTC',
  industry: '',
  companySize: '',
  website: '',
});

// Add timezone dropdown
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">
    Timezone
  </label>
  <select
    value={orgDetails.timezone}
    onChange={(e) => setOrgDetails(prev => ({ ...prev, timezone: e.target.value }))}
    className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md"
  >
    <option value="UTC">UTC</option>
    <option value="America/New_York">Eastern Time (ET)</option>
    <option value="America/Chicago">Central Time (CT)</option>
    <option value="America/Denver">Mountain Time (MT)</option>
    <option value="America/Los_Angeles">Pacific Time (PT)</option>
    <option value="Europe/London">London (GMT)</option>
    <option value="Europe/Paris">Paris (CET)</option>
    <option value="Asia/Tokyo">Tokyo (JST)</option>
    {/* Add more as needed */}
  </select>
</div>

// Add industry dropdown
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">
    Industry
  </label>
  <select
    value={orgDetails.industry}
    onChange={(e) => setOrgDetails(prev => ({ ...prev, industry: e.target.value }))}
    className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md"
  >
    <option value="">Select industry</option>
    <option value="technology">Technology</option>
    <option value="healthcare">Healthcare</option>
    <option value="finance">Finance & Banking</option>
    <option value="education">Education</option>
    <option value="retail">Retail & E-commerce</option>
    <option value="manufacturing">Manufacturing</option>
    <option value="consulting">Consulting</option>
    <option value="legal">Legal</option>
    <option value="media">Media & Entertainment</option>
    <option value="other">Other</option>
  </select>
</div>

// Add company size dropdown
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">
    Company Size
  </label>
  <select
    value={orgDetails.companySize}
    onChange={(e) => setOrgDetails(prev => ({ ...prev, companySize: e.target.value }))}
    className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md"
  >
    <option value="">Select size</option>
    <option value="1-10">1-10 employees</option>
    <option value="11-50">11-50 employees</option>
    <option value="51-200">51-200 employees</option>
    <option value="201-500">201-500 employees</option>
    <option value="500+">500+ employees</option>
  </select>
</div>

// Add website field
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">
    Website
  </label>
  <input
    type="url"
    value={orgDetails.website}
    onChange={(e) => setOrgDetails(prev => ({ ...prev, website: e.target.value }))}
    className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md"
    placeholder="https://yourcompany.com"
  />
</div>
```

---

## Part 3: Implementation Order

### Phase 14.1: Critical Fixes (Day 1)

1. **Update settings layout** - Add role-based navigation filtering
2. **Add admin-only guards** to Team, API Keys, Webhooks pages
3. **Delete billing from settings** - Remove `/settings/billing/`
4. **Create public pricing page** at `/pricing`

### Phase 14.2: Database & API (Day 2)

1. **Update Prisma schema** - Add org fields (logo, timezone, industry, etc.)
2. **Run migration** - `npx prisma migrate dev`
3. **Create direct user creation API** - `/api/members/create`
4. **Update org settings API** - Support new fields

### Phase 14.3: UI Enhancements (Day 3)

1. **Update Team Members page** - Add Create User button and modal
2. **Update Organization Settings page** - Add new fields
3. **Add logo upload** - Integrate with S3 storage
4. **Test all flows** - Invite, create, role change, remove

---

## Part 4: Files Summary

### Files to CREATE

| File | Purpose |
|------|---------|
| `apps/web/app/(marketing)/pricing/page.tsx` | Public pricing page |
| `apps/web/app/api/members/create/route.ts` | Direct user creation API |
| `apps/web/app/api/organization/logo/route.ts` | Logo upload API |

### Files to MODIFY

| File | Changes |
|------|---------|
| `packages/database/prisma/schema.prisma` | Add org fields |
| `apps/web/app/settings/layout.tsx` | Role-based nav filtering |
| `apps/web/app/settings/page.tsx` | Add org metadata fields |
| `apps/web/app/settings/team/page.tsx` | Add create user modal, admin guard |
| `apps/web/app/settings/api-keys/page.tsx` | Add admin guard |
| `apps/web/app/settings/webhooks/page.tsx` | Add admin guard |
| `apps/web/app/page.tsx` | Add Pricing link to nav |
| `apps/web/app/api/settings/organization/route.ts` | Support new fields |

### Files to DELETE

| File | Reason |
|------|--------|
| `apps/web/app/settings/billing/page.tsx` | Moving to public pricing |

---

## Part 5: Testing Checklist

### Role-Based Access

- [ ] Member cannot see Team Members in nav
- [ ] Member cannot see API Keys in nav
- [ ] Member cannot see Webhooks in nav
- [ ] Member cannot see Organization in nav
- [ ] Member navigating to `/settings/team` redirects to `/settings/profile`
- [ ] Member navigating to `/settings/api-keys` redirects to `/settings/profile`
- [ ] Admin can see all nav items
- [ ] Admin can access all pages

### Team Management

- [ ] Admin can send invitation
- [ ] Admin can create user directly
- [ ] Created user receives temporary password
- [ ] Created user can login with temp password
- [ ] Admin can change member role
- [ ] Admin cannot demote last admin
- [ ] Admin can remove member
- [ ] Admin cannot remove self

### Organization Settings

- [ ] Admin can update org name
- [ ] Admin can set timezone
- [ ] Admin can set industry
- [ ] Admin can set company size
- [ ] Admin can set website
- [ ] Admin can upload logo
- [ ] Admin can remove logo

### Pricing Page

- [ ] `/pricing` is accessible without login
- [ ] All three plans displayed correctly
- [ ] CTA buttons link to correct pages
- [ ] Navigation works correctly

---

## Part 6: Claude Code Implementation Prompt

```bash
claude --dangerously-skip-permissions
```

Then paste:

```
# Phase 14: Team Management & Settings Reorganization

Read the specification at `/project_docs/PHASE_14_CORRECTED_SPEC.md` and implement all changes.

## Priority Order:

1. CRITICAL - Fix settings layout role-based filtering
2. CRITICAL - Add admin guards to protected pages
3. CRITICAL - Delete billing from settings, create public pricing page
4. Update Prisma schema with new org fields
5. Run migration
6. Create direct user creation API
7. Update Team Members page with create user modal
8. Update Organization Settings with new fields
9. Test all flows

## Key Files to Change:
- packages/database/prisma/schema.prisma
- apps/web/app/settings/layout.tsx
- apps/web/app/settings/team/page.tsx
- apps/web/app/settings/api-keys/page.tsx
- apps/web/app/settings/webhooks/page.tsx
- apps/web/app/settings/page.tsx

## Files to Create:
- apps/web/app/(marketing)/pricing/page.tsx
- apps/web/app/api/members/create/route.ts

## Files to Delete:
- apps/web/app/settings/billing/page.tsx

After changes, run:
- npx prisma generate
- npx prisma migrate dev --name add_org_fields
- pnpm build (verify no errors)

Commit message: "Phase 14: Team management & settings reorganization"
```

---

## Appendix: Security Considerations

1. **All admin APIs already have role checks** - Verified in review
2. **UI must also enforce role checks** - Being added
3. **Direct user creation** - Password is hashed, user is pre-verified
4. **Temp passwords** - Should be strong, user prompted to change on first login
5. **Last admin protection** - Already implemented in APIs
