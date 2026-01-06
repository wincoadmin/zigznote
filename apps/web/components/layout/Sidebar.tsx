'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Home,
  Calendar,
  Video,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/meetings', icon: Video, label: 'Meetings' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/search', icon: Search, label: 'Search' },
  { href: '/settings', icon: Settings, label: 'Settings' },
  { href: '/help', icon: HelpCircle, label: 'Help' },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const user = session?.user;
  const displayName = user?.name || user?.email || 'User';
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  const handleSignOut = () => {
    signOut({ callbackUrl: '/sign-in' });
  };

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all duration-300',
        collapsed ? 'w-14 sm:w-16' : 'w-56 sm:w-64',
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <svg
              width="28"
              height="28"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="6" y="6" width="20" height="3" rx="1" fill="url(#logo-grad)" />
              <rect x="6" y="23" width="20" height="3" rx="1" fill="url(#logo-grad)" />
              <path d="M20 6L9 26" stroke="url(#logo-grad)" strokeWidth="3.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34D399" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
            </svg>
            <span className="font-heading text-lg font-bold">
              <span className="text-primary-500">zig</span>
              <span className="text-slate-700">note</span>
            </span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 sm:space-y-1 px-2 sm:px-3 py-2 sm:py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                collapsed && 'justify-center'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-2 sm:p-3">
        <div
          className={cn(
            'flex items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2',
            collapsed && 'justify-center'
          )}
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={displayName}
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary-100 flex items-center justify-center text-xs sm:text-sm font-medium text-primary-700 shrink-0">
              {initials}
            </div>
          )}
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          )}
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className={cn(
            'flex items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors w-full mt-2',
            'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" strokeWidth={1.5} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
