'use client';

import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pricingTeaser } from '@/lib/landing-content';

export function PricingTeaser() {
  return (
    <section className="relative py-20 lg:py-32 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            {pricingTeaser.heading}
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {pricingTeaser.subheading}
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12">
          {pricingTeaser.tiers.map((tier, index) => (
            <div
              key={index}
              className={`relative p-6 lg:p-8 rounded-2xl border transition-all duration-300 ${
                tier.highlighted
                  ? 'bg-gradient-to-b from-primary-500/10 to-slate-900 border-primary-500/50 shadow-lg shadow-primary-500/10'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Badge */}
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 text-xs font-semibold rounded-full bg-primary-500 text-white">
                    {tier.badge}
                  </span>
                </div>
              )}

              {/* Tier name */}
              <h3 className="text-xl font-semibold text-white mb-2">
                {tier.name}
              </h3>
              <p className="text-slate-400 text-sm mb-6">{tier.description}</p>

              {/* Features list */}
              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                asChild
                className={`w-full ${
                  tier.highlighted
                    ? ''
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
                variant={tier.highlighted ? 'primary' : 'outline'}
              >
                <Link href={tier.cta.href}>
                  {tier.cta.text}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>

        {/* View all plans CTA */}
        <div className="text-center">
          <Link
            href={pricingTeaser.viewAllCta.href}
            className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 font-medium transition-colors"
          >
            {pricingTeaser.viewAllCta.text}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
