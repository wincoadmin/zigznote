'use client';

import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  content: string;
  title?: string;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: 'sm' | 'md';
}

export function HelpTooltip({
  content,
  title,
  className,
  position = 'top',
  size = 'sm',
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800',
  };

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className={cn(
          'text-slate-400 hover:text-slate-600 transition-colors',
          size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
        )}
      >
        <HelpCircle className="w-full h-full" />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 w-64 p-3 bg-slate-800 text-white text-sm rounded-lg shadow-lg',
            positionClasses[position]
          )}
        >
          {title && (
            <p className="font-medium mb-1">{title}</p>
          )}
          <p className="text-slate-300">{content}</p>

          {/* Arrow */}
          <div
            className={cn(
              'absolute w-0 h-0 border-4 border-transparent',
              arrowClasses[position]
            )}
          />
        </div>
      )}
    </div>
  );
}
