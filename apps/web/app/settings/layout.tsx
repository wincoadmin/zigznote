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
  { name: 'Profile', href: '/settings/profile', icon: User, adminOnly: false, section: 'personal' },
  { name: 'Security', href: '/settings/security', icon: Shield, adminOnly: false, section: 'personal' },
  { name: 'Notifications', href: '/settings/notifications', icon: Bell, adminOnly: false, section: 'personal' },

  // Organization section - admin only (except Integrations)
  { name: 'Organization', href: '/settings', icon: Building2, adminOnly: true, exact: true, section: 'organization' },
  { name: 'Team Members', href: '/settings/team', icon: Users, adminOnly: true, section: 'organization' },
  { name: 'Integrations', href: '/settings/integrations', icon: Puzzle, adminOnly: false, section: 'organization' },
  { name: 'API Keys', href: '/settings/api-keys', icon: Key, adminOnly: true, section: 'organization' },
  { name: 'Webhooks', href: '/settings/webhooks', icon: Webhook, adminOnly: true, section: 'organization' },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isAdmin = (session?.user as any)?.role === 'admin';

  // Filter nav items based on role
  const visibleNav = settingsNav.filter(item => !item.adminOnly || isAdmin);

  const personalItems = visibleNav.filter(item => item.section === 'personal');
  const organizationItems = visibleNav.filter(item => item.section === 'organization');

  const renderNavItem = (item: typeof settingsNav[0]) => {
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
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
                &larr; Back to Dashboard
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
                {personalItems.map(renderNavItem)}
              </ul>
            </div>

            {/* Organization Section - Show if there are items */}
            {organizationItems.length > 0 && (
              <div className="mb-6">
                <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {isAdmin ? 'Organization' : 'Connections'}
                </h3>
                <ul className="space-y-1">
                  {organizationItems.map(renderNavItem)}
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
