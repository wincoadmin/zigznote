'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Video, Search, Settings, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/meetings', icon: Video, label: 'Meetings' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/search', icon: Search, label: 'Search' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

interface MobileNavProps {
  className?: string;
}

export function MobileNav({ className }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 lg:hidden pb-safe',
        className
      )}
    >
      <div className="flex items-center justify-around py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 p-2 min-w-[60px] rounded-lg transition-colors',
                isActive ? 'text-primary-600 bg-primary-50' : 'text-slate-500'
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
