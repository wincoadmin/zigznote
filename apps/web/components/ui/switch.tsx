'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  description?: string;
  size?: 'sm' | 'md';
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, description, id, size = 'md', ...props }, ref) => {
    const switchId = id || `switch-${Math.random().toString(36).slice(2, 11)}`;

    const sizeClasses = {
      sm: {
        track: 'h-5 w-9',
        thumb: 'h-4 w-4 peer-checked:translate-x-4',
      },
      md: {
        track: 'h-6 w-11',
        thumb: 'h-5 w-5 peer-checked:translate-x-5',
      },
    };

    return (
      <div className={cn('flex items-start gap-3', className)}>
        <div className="relative shrink-0">
          <input
            type="checkbox"
            id={switchId}
            ref={ref}
            className="peer sr-only"
            {...props}
          />
          <label
            htmlFor={switchId}
            className={cn(
              'block cursor-pointer rounded-full bg-slate-200 transition-colors duration-200',
              'peer-checked:bg-primary-500',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
              sizeClasses[size].track
            )}
          />
          <div
            className={cn(
              'pointer-events-none absolute left-0.5 top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200',
              sizeClasses[size].thumb
            )}
          />
        </div>
        {(label || description) && (
          <div className="flex-1">
            {label && (
              <label
                htmlFor={switchId}
                className="cursor-pointer text-sm font-medium text-slate-900"
              >
                {label}
              </label>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
