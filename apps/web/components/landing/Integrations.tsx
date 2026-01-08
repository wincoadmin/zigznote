'use client';

import { integrations } from '@/lib/landing-content';

export function Integrations() {
  return (
    <section id="integrations" className="relative py-20 lg:py-32 bg-slate-900">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-transparent to-slate-950" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            {integrations.heading}
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {integrations.subheading}
          </p>
        </div>

        {/* Integration logos */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {integrations.platforms.map((platform, index) => (
            <div
              key={index}
              className="group flex flex-col items-center justify-center p-6 rounded-xl bg-slate-800/30 border border-slate-800 hover:border-primary-500/30 hover:bg-slate-800/50 transition-all duration-300"
            >
              {/* Placeholder icon - using first letter */}
              <div className="w-16 h-16 rounded-xl bg-slate-700/50 flex items-center justify-center mb-3 group-hover:bg-slate-700 transition-colors">
                <span className="text-2xl font-bold text-slate-400 group-hover:text-primary-400 transition-colors">
                  {platform.name[0]}
                </span>
              </div>
              <span className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors">
                {platform.name}
              </span>
            </div>
          ))}
        </div>

        {/* Additional text */}
        <p className="text-center text-slate-500 text-sm mt-8">
          And many more integrations coming soon...
        </p>
      </div>
    </section>
  );
}
