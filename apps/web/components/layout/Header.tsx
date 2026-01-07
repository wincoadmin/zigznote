'use client';

import { useState } from 'react';
import { Search, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserButton } from '@/components/auth/UserButton';
import { NotificationBell } from '@/components/collaboration';

interface HeaderProps {
  title?: string;
  onMenuClick?: () => void;
  showMobileMenu?: boolean;
  className?: string;
}

export function Header({ title, onMenuClick, showMobileMenu, className }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header
      className={cn(
        'flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6',
        className
      )}
    >
      {/* Left side - Mobile menu + Title */}
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
            aria-label={showMobileMenu ? 'Close menu' : 'Open menu'}
          >
            {showMobileMenu ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        )}
        {title && (
          <h1 className="font-heading text-xl font-semibold text-slate-900">
            {title}
          </h1>
        )}
      </div>

      {/* Right side - Search + Notifications */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div
          className={cn(
            'transition-all duration-200',
            searchOpen ? 'w-64' : 'w-auto'
          )}
        >
          {searchOpen ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="Search meetings..."
                className="pl-9"
                autoFocus
                onBlur={() => setSearchOpen(false)}
              />
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Notifications */}
        <NotificationBell />

        {/* User Menu */}
        <UserButton />
      </div>
    </header>
  );
}
