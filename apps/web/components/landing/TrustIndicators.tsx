'use client';

import { useEffect, useState, useRef } from 'react';
import { trustIndicators } from '@/lib/landing-content';

export function TrustIndicators() {
  return (
    <section className="relative py-16 lg:py-24 bg-slate-950 border-y border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {trustIndicators.stats.map((stat, index) => (
            <StatCard key={index} value={stat.value} label={stat.label} />
          ))}
        </div>

        {/* Company logos */}
        <div className="text-center">
          <p className="text-sm text-slate-500 mb-8">{trustIndicators.heading}</p>
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
            {trustIndicators.companies.map((company, index) => (
              <div
                key={index}
                className="text-slate-600 hover:text-slate-400 transition-colors"
              >
                {/* Placeholder logo - text version */}
                <div className="h-8 flex items-center">
                  <span className="text-lg font-semibold tracking-tight opacity-50 hover:opacity-80 transition-opacity">
                    {company.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  const [displayValue, setDisplayValue] = useState('0');
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          animateValue();
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

  const animateValue = () => {
    const numericValue = parseInt(value.replace(/[^0-9]/g, ''));
    const suffix = value.replace(/[0-9]/g, '');
    const duration = 2000;
    const steps = 60;
    const increment = numericValue / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), numericValue);
      setDisplayValue(current.toLocaleString() + suffix);

      if (step >= steps) {
        clearInterval(timer);
        setDisplayValue(value);
      }
    }, duration / steps);
  };

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600 mb-2">
        {displayValue || value}
      </div>
      <div className="text-slate-400 text-sm">{label}</div>
    </div>
  );
}
