'use client';

import { Quote } from 'lucide-react';
import { testimonials } from '@/lib/landing-content';

export function Testimonials() {
  return (
    <section className="relative py-20 lg:py-32 bg-slate-900">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-transparent to-slate-950" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            {testimonials.heading}
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {testimonials.subheading}
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.items.map((testimonial, index) => (
            <div
              key={index}
              className="relative p-6 lg:p-8 rounded-2xl bg-slate-800/30 border border-slate-800 hover:border-slate-700 transition-all duration-300"
            >
              {/* Quote icon */}
              <div className="absolute top-6 right-6">
                <Quote className="h-8 w-8 text-primary-500/20" />
              </div>

              {/* Quote text */}
              <p className="text-slate-300 leading-relaxed mb-6 relative z-10">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                {/* Avatar placeholder */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold">
                  {testimonial.author.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <p className="font-semibold text-white">
                    {testimonial.author.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {testimonial.author.role}, {testimonial.author.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
