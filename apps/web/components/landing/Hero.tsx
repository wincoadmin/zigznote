'use client';

import Link from 'next/link';
import { Play, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { heroContent } from '@/lib/landing-content';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 pt-20">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-500/10 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-500/5 via-transparent to-transparent" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column - Text content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              {heroContent.badge}
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              {heroContent.headline.split(' ').map((word, i) => (
                <span key={i}>
                  {word === 'Never' || word === 'Detail' ? (
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
                      {word}
                    </span>
                  ) : (
                    word
                  )}{' '}
                </span>
              ))}
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-slate-400 mb-8 max-w-xl mx-auto lg:mx-0">
              {heroContent.subheadline}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button asChild size="lg" className="text-base px-8">
                <Link href={heroContent.primaryCta.href}>
                  {heroContent.primaryCta.text}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-base px-8 border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-white"
              >
                <Link href={heroContent.secondaryCta.href}>
                  <Play className="mr-2 h-5 w-5" />
                  {heroContent.secondaryCta.text}
                </Link>
              </Button>
            </div>
          </div>

          {/* Right column - Product mockup */}
          <div className="relative">
            {/* Video/Demo placeholder */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl shadow-primary-500/10">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 ml-4">
                  <div className="bg-slate-700/50 rounded-md px-3 py-1 text-xs text-slate-400 max-w-xs">
                    app.zigznote.com/meeting
                  </div>
                </div>
              </div>

              {/* App mockup content */}
              <div className="p-6 min-h-[400px]">
                {/* Meeting header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-white font-semibold">Weekly Team Standup</h3>
                    <p className="text-sm text-slate-500">Recording in progress...</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-sm text-red-400">Live</span>
                  </div>
                </div>

                {/* Transcript animation */}
                <div className="space-y-4">
                  <TranscriptLine
                    speaker="Sarah"
                    color="bg-primary-500"
                    text="Let's go over the sprint progress. John, can you start?"
                    delay={0}
                  />
                  <TranscriptLine
                    speaker="John"
                    color="bg-blue-500"
                    text="Sure! I completed the API integration yesterday..."
                    delay={2}
                  />
                  <TranscriptLine
                    speaker="Emily"
                    color="bg-purple-500"
                    text="That's great! I'll sync up with you on the frontend..."
                    delay={4}
                  />
                </div>

                {/* Action items preview */}
                <div className="mt-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-primary-500" />
                    <span className="text-sm font-medium text-primary-400">AI Action Items</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <div className="w-4 h-4 rounded border border-slate-600" />
                      <span>Review API documentation - John</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <div className="w-4 h-4 rounded border border-slate-600" />
                      <span>Schedule design review - Emily</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary-600/20 rounded-full blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

function TranscriptLine({
  speaker,
  color,
  text,
  delay,
}: {
  speaker: string;
  color: string;
  text: string;
  delay: number;
}) {
  return (
    <div
      className="flex gap-3 animate-fade-in"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-medium shrink-0`}>
        {speaker[0]}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-300">{speaker}</p>
        <p className="text-sm text-slate-400">{text}</p>
      </div>
    </div>
  );
}
