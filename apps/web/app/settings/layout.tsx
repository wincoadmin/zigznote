'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SettingsLayoutProps {
  children: ReactNode;
}

const settingsNav = [
  { name: 'Profile', href: '/settings/profile' },
  { name: 'Security', href: '/settings/security' },
  { name: 'General', href: '/settings' },
  { name: 'Notifications', href: '/settings/notifications' },
  { name: 'API Keys', href: '/settings/api-keys' },
  { name: 'Integrations', href: '/settings/integrations' },
  { name: 'Webhooks', href: '/settings/webhooks' },
  { name: 'Billing', href: '/settings/billing' },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

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
          <nav className="w-48 flex-shrink-0">
            <ul className="space-y-1">
              {settingsNav.map((item) => {
                const isActive =
                  item.href === '/settings'
                    ? pathname === '/settings'
                    : pathname === item.href || pathname.startsWith(item.href + '/');

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      )}
                    >
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
