'use client';

import { useState, useEffect } from 'react';
import { Search, User, Calendar, ArrowRight } from 'lucide-react';
import { searchSection } from '@/lib/landing-content';

export function SearchSection() {
  const [currentQuery, setCurrentQuery] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  // Typing animation effect
  useEffect(() => {
    const query = searchSection.sampleQueries[currentQuery];

    if (isTyping) {
      if (displayText.length < query.length) {
        const timeout = setTimeout(() => {
          setDisplayText(query.slice(0, displayText.length + 1));
        }, 50);
        return () => clearTimeout(timeout);
      } else {
        // Pause at end of query
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
        return () => clearTimeout(timeout);
      }
    } else {
      // Clear and move to next query
      const timeout = setTimeout(() => {
        setDisplayText('');
        setCurrentQuery((prev) => (prev + 1) % searchSection.sampleQueries.length);
        setIsTyping(true);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [displayText, isTyping, currentQuery]);

  return (
    <section className="relative py-20 lg:py-32 bg-slate-900 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-transparent to-slate-950" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-medium mb-6">
              <Search className="h-4 w-4" />
              Intelligent Search
            </div>

            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              {searchSection.heading}
            </h2>
            <p className="text-lg text-slate-400 mb-8">
              {searchSection.description}
            </p>

            {/* Feature pills */}
            <div className="space-y-4">
              {searchSection.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
                    {index === 0 && <Search className="h-5 w-5 text-primary-500" />}
                    {index === 1 && <User className="h-5 w-5 text-primary-500" />}
                    {index === 2 && <Calendar className="h-5 w-5 text-primary-500" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-sm text-slate-400">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Interactive Search Demo */}
          <div className="relative">
            <div className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 shadow-2xl">
              {/* Search input */}
              <div className="relative mb-6">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900 border border-slate-700">
                  <Search className="h-5 w-5 text-slate-500" />
                  <div className="flex-1 text-slate-300">
                    {displayText}
                    <span className="inline-block w-0.5 h-5 bg-primary-500 animate-pulse ml-0.5 align-middle" />
                  </div>
                </div>
              </div>

              {/* Sample results */}
              <div className="space-y-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                  Results from 3 meetings
                </p>

                <SearchResult
                  meeting="Product Roadmap Review"
                  date="Jan 5, 2025"
                  speaker="Sarah Chen"
                  snippet="...regarding the Q4 roadmap, we should prioritize the mobile app launch and delay the API v2 release..."
                />
                <SearchResult
                  meeting="Weekly Team Sync"
                  date="Jan 3, 2025"
                  speaker="Sarah Chen"
                  snippet="...Sarah mentioned the Q4 roadmap is on track, with 80% of features already in development..."
                />
                <SearchResult
                  meeting="Strategy Planning"
                  date="Dec 28, 2024"
                  speaker="Sarah Chen"
                  snippet="...initial draft of the Q4 roadmap presented, focusing on enterprise features and scalability..."
                />
              </div>

              {/* View all link */}
              <button className="mt-4 w-full flex items-center justify-center gap-2 py-3 text-sm text-primary-400 hover:text-primary-300 transition-colors">
                View all results
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary-500/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary-600/10 rounded-full blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchResult({
  meeting,
  date,
  speaker,
  snippet,
}: {
  meeting: string;
  date: string;
  speaker: string;
  snippet: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-primary-500/30 transition-colors cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-white text-sm">{meeting}</span>
        <span className="text-xs text-slate-500">{date}</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-primary-500/20 flex items-center justify-center">
          <span className="text-xs text-primary-400">{speaker[0]}</span>
        </div>
        <span className="text-xs text-slate-400">{speaker}</span>
      </div>
      <p className="text-sm text-slate-400 line-clamp-2">{snippet}</p>
    </div>
  );
}
