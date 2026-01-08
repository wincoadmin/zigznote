'use client';

import { Video, Mic, FileText, CheckSquare, Calendar, Users } from 'lucide-react';
import { features } from '@/lib/landing-content';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Video,
  Mic,
  FileText,
  CheckSquare,
  Calendar,
  Users,
};

export function Features() {
  return (
    <section id="features" className="relative py-20 lg:py-32 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            {features.heading}
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {features.subheading}
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.items.map((feature, index) => {
            const Icon = iconMap[feature.icon];
            return (
              <div
                key={index}
                className="group relative p-6 lg:p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-primary-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/5"
              >
                {/* Highlight badge */}
                {feature.highlight && (
                  <div className="absolute -top-3 left-6">
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20">
                      {feature.highlight}
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center mb-5 group-hover:bg-primary-500/20 transition-colors">
                  {Icon && <Icon className="h-6 w-6 text-primary-500" />}
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
