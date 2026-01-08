'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ArrowRight } from 'lucide-react';
import { Navbar, Footer } from '@/components/landing';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'For individuals getting started',
    features: [
      '10 meetings per month',
      '800 minutes of transcription',
      'AI summaries & action items',
      'Speaker identification',
      '30-day meeting history',
      'Search across meetings',
      'Google Calendar sync',
      'Export to TXT & PDF',
    ],
    cta: 'Get Started Free',
    href: '/sign-up',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/user/month',
    billingNote: 'Billed annually ($18/mo if monthly)',
    description: 'For professionals & small teams',
    features: [
      'Unlimited meetings',
      'Unlimited transcription',
      'Premium accuracy (95%+)',
      '10 languages supported',
      'AI Assistant - ask your meetings anything',
      'Unlimited meeting history',
      'Custom AI summaries',
      'Action items with assignees',
      'Team sharing & comments',
      'Slack & calendar integrations',
      'Export to all formats (SRT, DOCX)',
      'Priority email support',
    ],
    cta: 'Start 14-Day Free Trial',
    href: '/sign-up?plan=pro',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    name: 'Business',
    price: '$24',
    period: '/user/month',
    billingNote: 'Billed annually ($32/mo if monthly)',
    description: 'For growing teams with advanced needs',
    features: [
      'Everything in Pro, plus:',
      'Conversation intelligence',
      'Speaker analytics & talk time',
      'Team performance insights',
      'CRM integrations (HubSpot, Salesforce)',
      'Custom vocabulary & terms',
      'Admin console & controls',
      'API access (10K requests/mo)',
      'Webhook integrations',
      'Dedicated success manager',
      'Phone & chat support',
    ],
    cta: 'Start 14-Day Free Trial',
    href: '/sign-up?plan=business',
    highlighted: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations',
    features: [
      'Everything in Business, plus:',
      'Unlimited API access',
      'SSO / SAML authentication',
      'Custom data retention',
      'Advanced security controls',
      'Custom integrations',
      'Dedicated account team',
      'SLA guarantee (99.9% uptime)',
      'Custom contracts & invoicing',
      'Training & onboarding',
    ],
    cta: 'Contact Sales',
    href: '/contact',
    highlighted: false,
  },
];

const faqs = [
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period. No questions asked.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards (Visa, Mastercard, American Express) and support payments through Stripe. Enterprise customers can also pay via invoice.',
  },
  {
    question: 'Do you offer a free trial?',
    answer:
      'Yes! Pro plans come with a 14-day free trial. No credit card required to start. You can upgrade or cancel anytime during the trial.',
  },
  {
    question: 'What happens when I exceed my meeting limit?',
    answer:
      "You'll receive a notification when approaching your limit. You can upgrade anytime to unlock unlimited meetings, or wait until your next billing cycle for the limit to reset.",
  },
  {
    question: 'Can I switch plans later?',
    answer:
      "Absolutely! You can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to new features. When downgrading, changes take effect at your next billing cycle.",
  },
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary-500/10 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Simple, Transparent{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
              Pricing
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Choose the plan that works for your team. Start free and scale as you grow.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="relative pb-20 lg:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <div
                key={plan.name}
                className={`relative p-6 rounded-2xl border transition-all duration-300 ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-primary-500/20 to-slate-900 border-primary-500/50 shadow-lg shadow-primary-500/10 lg:scale-105 z-10'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 text-xs font-semibold rounded-full bg-primary-500 text-white whitespace-nowrap">
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Plan name */}
                <h3 className="text-xl font-semibold text-white mb-1">
                  {plan.name}
                </h3>
                <p className="text-slate-400 text-sm mb-4">{plan.description}</p>

                {/* Price */}
                <div className="mb-2">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  {plan.period && (
                    <span className="text-slate-400 text-sm">{plan.period}</span>
                  )}
                </div>
                {plan.billingNote && (
                  <p className="text-xs text-slate-500 mb-4">{plan.billingNote}</p>
                )}

                {/* Features list */}
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  asChild
                  className={`w-full ${
                    plan.highlighted
                      ? ''
                      : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                  }`}
                  variant={plan.highlighted ? 'primary' : 'outline'}
                  size="sm"
                >
                  <Link href={plan.href}>
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-20 lg:py-28 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
              Compare Plans
            </h2>
            <p className="text-slate-400">
              See what's included in each plan
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Feature</th>
                  <th className="text-center py-4 px-4 text-white font-semibold">Free</th>
                  <th className="text-center py-4 px-4 text-primary-400 font-semibold">Pro</th>
                  <th className="text-center py-4 px-4 text-white font-semibold">Business</th>
                  <th className="text-center py-4 px-4 text-white font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <ComparisonRow feature="Meetings per month" free="10" pro="Unlimited" business="Unlimited" enterprise="Unlimited" />
                <ComparisonRow feature="Transcription minutes" free="800" pro="Unlimited" business="Unlimited" enterprise="Unlimited" />
                <ComparisonRow feature="Transcription accuracy" free="Standard" pro="Premium (95%+)" business="Premium (95%+)" enterprise="Premium (95%+)" />
                <ComparisonRow feature="Languages supported" free="10" pro="10" business="10" enterprise="10" />
                <ComparisonRow feature="AI summaries" free={true} pro={true} business={true} enterprise={true} />
                <ComparisonRow feature="Action items" free={true} pro="With assignees" business="With assignees" enterprise="With assignees" />
                <ComparisonRow feature="Meeting history" free="30 days" pro="Unlimited" business="Unlimited" enterprise="Unlimited" />
                <ComparisonRow feature="Search across meetings" free={true} pro={true} business={true} enterprise={true} />
                <ComparisonRow feature="AI Assistant" free={false} pro={true} business={true} enterprise={true} />
                <ComparisonRow feature="Team collaboration" free={false} pro={true} business={true} enterprise={true} />
                <ComparisonRow feature="Conversation intelligence" free={false} pro={false} business={true} enterprise={true} />
                <ComparisonRow feature="Speaker analytics" free={false} pro={false} business={true} enterprise={true} />
                <ComparisonRow feature="CRM integrations" free={false} pro={false} business={true} enterprise={true} />
                <ComparisonRow feature="API access" free={false} pro={false} business="10K/mo" enterprise="Unlimited" />
                <ComparisonRow feature="Admin console" free={false} pro={false} business={true} enterprise={true} />
                <ComparisonRow feature="SSO / SAML" free={false} pro={false} business={false} enterprise={true} />
                <ComparisonRow feature="Dedicated support" free={false} pro={false} business={true} enterprise={true} />
                <ComparisonRow feature="SLA guarantee" free={false} pro={false} business={false} enterprise="99.9%" />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 lg:py-28 bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-400">
              Everything you need to know about our pricing
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-800 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left bg-slate-900/50 hover:bg-slate-900 transition-colors"
                >
                  <span className="font-medium text-white pr-4">{faq.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                      openFaq === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFaq === index ? 'max-h-96' : 'max-h-0'
                  }`}
                >
                  <div className="p-5 pt-0 text-slate-400 leading-relaxed">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-28 bg-slate-900 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
            Ready to transform your meetings?
          </h2>
          <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
            Join thousands of teams who are saving hours every week with zigznote.
            Start your free trial today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-white"
            >
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function ComparisonRow({
  feature,
  free,
  pro,
  business,
  enterprise,
}: {
  feature: string;
  free: string | boolean;
  pro: string | boolean;
  business: string | boolean;
  enterprise: string | boolean;
}) {
  const renderValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-5 w-5 text-primary-500 mx-auto" />
      ) : (
        <span className="text-slate-600">-</span>
      );
    }
    return <span className="text-slate-300">{value}</span>;
  };

  return (
    <tr>
      <td className="py-4 px-4 text-slate-400 text-sm">{feature}</td>
      <td className="py-4 px-4 text-center">{renderValue(free)}</td>
      <td className="py-4 px-4 text-center">{renderValue(pro)}</td>
      <td className="py-4 px-4 text-center">{renderValue(business)}</td>
      <td className="py-4 px-4 text-center">{renderValue(enterprise)}</td>
    </tr>
  );
}
