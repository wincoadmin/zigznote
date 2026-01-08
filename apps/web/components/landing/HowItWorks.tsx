'use client';

import { Calendar, Video, Mic, FileText } from 'lucide-react';
import { howItWorks } from '@/lib/landing-content';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Calendar,
  Video,
  Mic,
  FileText,
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-20 lg:py-32 bg-slate-900">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-transparent to-slate-950" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            {howItWorks.heading}
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {howItWorks.subheading}
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection line - desktop */}
          <div className="hidden lg:block absolute top-24 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary-500/50 via-primary-500 to-primary-500/50" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {howItWorks.steps.map((step, index) => {
              const Icon = iconMap[step.icon];
              return (
                <div key={index} className="relative">
                  {/* Mobile connection line */}
                  {index < howItWorks.steps.length - 1 && (
                    <div className="lg:hidden absolute left-8 top-20 w-0.5 h-full bg-gradient-to-b from-primary-500 to-primary-500/20" />
                  )}

                  <div className="relative flex flex-col items-center text-center">
                    {/* Step number circle */}
                    <div className="relative z-10 mb-6">
                      <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-primary-500 flex items-center justify-center">
                        {Icon && <Icon className="h-7 w-7 text-primary-500" />}
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-xs font-bold text-white">
                        {step.number}
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-slate-400 max-w-xs">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
