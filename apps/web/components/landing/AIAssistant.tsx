'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Mail, ListChecks, TrendingUp, Send, Bot, User, FileText } from 'lucide-react';
import { aiAssistantSection } from '@/lib/landing-content';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Mail,
  ListChecks,
  TrendingUp,
};

export function AIAssistant() {
  const [showAnswer, setShowAnswer] = useState(false);
  const [displayedAnswer, setDisplayedAnswer] = useState('');

  // Typing animation for the answer
  useEffect(() => {
    if (showAnswer && displayedAnswer.length < aiAssistantSection.chatExample.answer.length) {
      const timeout = setTimeout(() => {
        setDisplayedAnswer(
          aiAssistantSection.chatExample.answer.slice(0, displayedAnswer.length + 2)
        );
      }, 20);
      return () => clearTimeout(timeout);
    }
  }, [showAnswer, displayedAnswer]);

  // Auto-trigger the demo
  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowAnswer(true);
    }, 2000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <section className="relative py-20 lg:py-32 bg-slate-950 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-500/5 via-transparent to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-medium mb-6">
            <Bot className="h-4 w-4" />
            AI-Powered
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            {aiAssistantSection.heading}
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {aiAssistantSection.description}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left - Capabilities */}
          <div className="grid sm:grid-cols-2 gap-4">
            {aiAssistantSection.capabilities.map((capability, index) => {
              const Icon = iconMap[capability.icon];
              return (
                <div
                  key={index}
                  className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-primary-500/30 transition-all duration-300 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center mb-4 group-hover:bg-primary-500/20 transition-colors">
                    {Icon && <Icon className="h-5 w-5 text-primary-500" />}
                  </div>
                  <h3 className="font-semibold text-white mb-2">{capability.title}</h3>
                  <p className="text-sm text-slate-400 mb-3">{capability.description}</p>
                  <p className="text-xs text-slate-500 italic">{capability.example}</p>
                </div>
              );
            })}
          </div>

          {/* Right - Chat Demo */}
          <div className="relative">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 bg-slate-800/50">
                <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-white text-sm">zigznote Assistant</p>
                  <p className="text-xs text-slate-500">Searching across 127 meetings</p>
                </div>
              </div>

              {/* Chat messages */}
              <div className="p-5 space-y-4 min-h-[300px]">
                {/* User question */}
                <div className="flex gap-3 justify-end">
                  <div className="max-w-[80%] p-4 rounded-2xl rounded-tr-md bg-primary-500 text-white">
                    <p className="text-sm">{aiAssistantSection.chatExample.question}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-slate-300" />
                  </div>
                </div>

                {/* AI response */}
                {showAnswer && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary-400" />
                    </div>
                    <div className="max-w-[85%]">
                      <div className="p-4 rounded-2xl rounded-tl-md bg-slate-800 text-slate-200">
                        <p className="text-sm leading-relaxed">
                          {displayedAnswer}
                          {displayedAnswer.length < aiAssistantSection.chatExample.answer.length && (
                            <span className="inline-block w-1.5 h-4 bg-primary-500 animate-pulse ml-1 align-middle" />
                          )}
                        </p>

                        {/* Sources */}
                        {displayedAnswer.length >= aiAssistantSection.chatExample.answer.length && (
                          <div className="mt-3 pt-3 border-t border-slate-700">
                            <p className="text-xs text-slate-500 mb-2">Sources:</p>
                            <div className="flex flex-wrap gap-2">
                              {aiAssistantSection.chatExample.sources.map((source, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-700/50 text-xs text-slate-400"
                                >
                                  <FileText className="h-3 w-3" />
                                  {source}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat input */}
              <div className="px-5 py-4 border-t border-slate-800 bg-slate-800/30">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 border border-slate-700">
                  <input
                    type="text"
                    placeholder="Ask about your meetings..."
                    className="flex-1 bg-transparent text-sm text-slate-300 placeholder-slate-500 outline-none"
                    readOnly
                  />
                  <button className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center hover:bg-primary-600 transition-colors">
                    <Send className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Decorative glow */}
            <div className="absolute -inset-4 bg-primary-500/5 rounded-3xl blur-2xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
}
