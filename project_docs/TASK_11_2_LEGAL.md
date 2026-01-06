# Task 11.2: Legal Pages

## Overview
Create Terms of Service, Privacy Policy, Cookie Policy pages and GDPR-compliant cookie consent banner.

---

## Step 1: Legal Pages Layout

**File:** `apps/web/app/(legal)/layout.tsx`

```tsx
import Link from 'next/link';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">zigznote</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/terms" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Terms
            </Link>
            <Link href="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Privacy
            </Link>
            <Link href="/cookies" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Cookies
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <article className="prose prose-gray dark:prose-invert max-w-none">
          {children}
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} zigznote. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
```

---

## Step 2: Terms of Service

**File:** `apps/web/app/(legal)/terms/page.tsx`

```tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | zigznote',
  description: 'Terms of Service for using zigznote AI meeting assistant',
};

export default function TermsOfServicePage() {
  const lastUpdated = 'January 6, 2026';

  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-gray-500 dark:text-gray-400">Last updated: {lastUpdated}</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using zigznote (&quot;Service&quot;), you agree to be bound by these Terms of Service. 
        If you do not agree, do not use the Service.
      </p>

      <h2>2. Description of Service</h2>
      <p>zigznote is an AI-powered meeting assistant that provides:</p>
      <ul>
        <li>Automated meeting recording and transcription</li>
        <li>AI-generated meeting summaries and action items</li>
        <li>Meeting search and analytics</li>
        <li>Integration with calendar and productivity tools</li>
      </ul>

      <h2>3. Account Registration</h2>
      <p>To use the Service, you must create an account. You agree to:</p>
      <ul>
        <li>Provide accurate and complete registration information</li>
        <li>Maintain the security of your account credentials</li>
        <li>Promptly notify us of any unauthorized use</li>
        <li>Be responsible for all activities under your account</li>
      </ul>

      <h2>4. Acceptable Use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Record meetings without proper consent from all participants</li>
        <li>Violate any applicable laws or regulations</li>
        <li>Infringe on intellectual property rights</li>
        <li>Transmit malicious code or interfere with the Service</li>
        <li>Use the Service for illegal surveillance or monitoring</li>
      </ul>

      <h2>5. Meeting Recording Consent</h2>
      <p>
        <strong>Important:</strong> You are solely responsible for obtaining proper consent from all 
        meeting participants before recording. This includes informing participants that the meeting 
        will be recorded and complying with all applicable wiretapping and recording laws.
      </p>

      <h2>6. Intellectual Property</h2>
      <p>
        The Service is owned by zigznote and protected by intellectual property laws. You retain 
        ownership of your meeting content. By using the Service, you grant us a license to process, 
        store, and display your content as necessary to provide the Service.
      </p>

      <h2>7. Payment Terms</h2>
      <p>
        Paid plans are billed in advance. Fees are non-refundable except as required by law. 
        Prices may change with 30 days notice. You can cancel at any time.
      </p>

      <h2>8. Data Retention and Deletion</h2>
      <p>We retain your data as long as your account is active. Upon deletion:</p>
      <ul>
        <li>Your data will be deleted within 30 days</li>
        <li>Backups may retain data for up to 90 days</li>
        <li>Anonymized analytics data may be retained indefinitely</li>
      </ul>

      <h2>9. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, zigznote shall not be liable for any indirect, 
        incidental, special, or consequential damages. Our total liability shall not exceed the 
        amount paid by you in the 12 months preceding the claim.
      </p>

      <h2>10. Changes to Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you of material changes 
        via email or in-app notification.
      </p>

      <h2>11. Contact Us</h2>
      <p>If you have questions about these Terms, contact us at legal@zigznote.com</p>
    </>
  );
}
```

---

## Step 3: Privacy Policy

**File:** `apps/web/app/(legal)/privacy/page.tsx`

```tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | zigznote',
  description: 'Privacy Policy for zigznote AI meeting assistant',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = 'January 6, 2026';

  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-gray-500 dark:text-gray-400">Last updated: {lastUpdated}</p>

      <h2>1. Information We Collect</h2>
      
      <h3>1.1 Information You Provide</h3>
      <ul>
        <li><strong>Account Information:</strong> Name, email address, profile photo</li>
        <li><strong>Payment Information:</strong> Billing address, payment card details (processed by Stripe)</li>
        <li><strong>Meeting Content:</strong> Audio recordings, transcripts, summaries, action items</li>
      </ul>

      <h3>1.2 Information Collected Automatically</h3>
      <ul>
        <li><strong>Usage Data:</strong> Features used, meetings created, actions taken</li>
        <li><strong>Device Information:</strong> Browser type, operating system, device type</li>
        <li><strong>Log Data:</strong> IP address, access times, pages viewed</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>Provide, maintain, and improve the Service</li>
        <li>Process transactions and send related information</li>
        <li>Send technical notices, updates, and support messages</li>
        <li>Monitor and analyze usage trends</li>
        <li>Detect, prevent, and address technical issues and fraud</li>
      </ul>

      <h2>3. AI Processing</h2>
      <p>We use artificial intelligence to process your meeting content:</p>
      <ul>
        <li><strong>Transcription:</strong> Converting audio to text using AI speech recognition</li>
        <li><strong>Summarization:</strong> Generating meeting summaries using large language models</li>
        <li><strong>Action Items:</strong> Extracting tasks and follow-ups from transcripts</li>
      </ul>
      <p>
        Your content may be processed by third-party AI providers (OpenAI, Anthropic, Deepgram) 
        under strict data processing agreements.
      </p>

      <h2>4. How We Share Your Information</h2>
      <ul>
        <li><strong>Service Providers:</strong> Third parties that help us operate the Service</li>
        <li><strong>Business Transfers:</strong> In connection with mergers or acquisitions</li>
        <li><strong>Legal Requirements:</strong> To comply with laws or legal processes</li>
      </ul>
      <p><strong>We do not sell your personal information.</strong></p>

      <h2>5. Data Security</h2>
      <ul>
        <li>Encryption of data in transit (TLS) and at rest (AES-256)</li>
        <li>Regular security assessments and penetration testing</li>
        <li>Access controls and authentication requirements</li>
      </ul>

      <h2>6. Your Rights</h2>
      <p>Depending on your location, you may have the right to:</p>
      <ul>
        <li><strong>Access:</strong> Request a copy of your personal data</li>
        <li><strong>Correction:</strong> Update or correct inaccurate data</li>
        <li><strong>Deletion:</strong> Request deletion of your data</li>
        <li><strong>Portability:</strong> Export your data in a portable format</li>
      </ul>
      <p>To exercise these rights, contact privacy@zigznote.com</p>

      <h2>7. Children&apos;s Privacy</h2>
      <p>
        The Service is not intended for children under 16. We do not knowingly collect 
        personal information from children.
      </p>

      <h2>8. Contact Us</h2>
      <p>For questions about this Privacy Policy: privacy@zigznote.com</p>
    </>
  );
}
```

---

## Step 4: Cookie Policy

**File:** `apps/web/app/(legal)/cookies/page.tsx`

```tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy | zigznote',
  description: 'Cookie Policy for zigznote AI meeting assistant',
};

export default function CookiePolicyPage() {
  const lastUpdated = 'January 6, 2026';

  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="text-gray-500 dark:text-gray-400">Last updated: {lastUpdated}</p>

      <h2>1. What Are Cookies?</h2>
      <p>
        Cookies are small text files stored on your device when you visit a website. 
        They help websites remember your preferences and improve your experience.
      </p>

      <h2>2. Types of Cookies We Use</h2>

      <h3>2.1 Essential Cookies</h3>
      <p>These cookies are necessary for the Service to function. They cannot be disabled.</p>
      <table className="w-full text-sm">
        <thead>
          <tr><th>Cookie</th><th>Purpose</th><th>Duration</th></tr>
        </thead>
        <tbody>
          <tr><td><code>__session</code></td><td>Authentication session</td><td>Session</td></tr>
          <tr><td><code>__clerk_*</code></td><td>Authentication state</td><td>1 year</td></tr>
          <tr><td><code>csrf_token</code></td><td>Security protection</td><td>Session</td></tr>
        </tbody>
      </table>

      <h3>2.2 Functional Cookies</h3>
      <p>These cookies remember your preferences.</p>
      <table className="w-full text-sm">
        <thead>
          <tr><th>Cookie</th><th>Purpose</th><th>Duration</th></tr>
        </thead>
        <tbody>
          <tr><td><code>theme</code></td><td>Dark/light mode preference</td><td>1 year</td></tr>
          <tr><td><code>sidebar_collapsed</code></td><td>UI preference</td><td>1 year</td></tr>
        </tbody>
      </table>

      <h3>2.3 Analytics Cookies</h3>
      <p>These cookies help us understand how visitors use the Service. Set only with consent.</p>
      <table className="w-full text-sm">
        <thead>
          <tr><th>Cookie</th><th>Provider</th><th>Duration</th></tr>
        </thead>
        <tbody>
          <tr><td><code>_ga</code></td><td>Google Analytics</td><td>2 years</td></tr>
          <tr><td><code>ph_*</code></td><td>PostHog</td><td>1 year</td></tr>
        </tbody>
      </table>

      <h2>3. Managing Cookies</h2>
      <ul>
        <li><strong>Cookie Banner:</strong> Use our cookie consent banner to accept or reject non-essential cookies</li>
        <li><strong>Browser Settings:</strong> Configure your browser to block or delete cookies</li>
      </ul>

      <h2>4. Updates to This Policy</h2>
      <p>We may update this Cookie Policy from time to time.</p>

      <h2>5. Contact Us</h2>
      <p>For questions about our use of cookies: privacy@zigznote.com</p>
    </>
  );
}
```

---

## Step 5: Cookie Consent Banner

**File:** `apps/web/components/legal/CookieConsent.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Button } from '../ui/button';

const COOKIE_CONSENT_KEY = 'zigznote_cookie_consent';

interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    functional: true,
    analytics: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) {
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (newPreferences: CookiePreferences) => {
    const data = {
      preferences: newPreferences,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(data));
    setShowBanner(false);
    setShowPreferences(false);

    if (newPreferences.analytics && typeof window !== 'undefined') {
      (window as any).gtag?.('consent', 'update', { analytics_storage: 'granted' });
    }
  };

  const handleAcceptAll = () => saveConsent({ essential: true, functional: true, analytics: true });
  const handleRejectAll = () => saveConsent({ essential: true, functional: false, analytics: false });
  const handleSavePreferences = () => saveConsent(preferences);

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-4"
      >
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          {!showPreferences ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">🍪 We use cookies</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  We use cookies to improve your experience.{' '}
                  <Link href="/cookies" className="text-indigo-600 hover:underline">Learn more</Link>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <Button onClick={handleAcceptAll}>Accept All</Button>
                <Button variant="outline" onClick={handleRejectAll}>Reject All</Button>
                <Button variant="ghost" onClick={() => setShowPreferences(true)}>Customize</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cookie Preferences</h3>
              
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Essential</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Required for site function</p>
                  </div>
                  <input type="checkbox" checked disabled className="h-5 w-5" />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Functional</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Remember preferences</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.functional}
                    onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                    className="h-5 w-5"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Analytics</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Help us improve</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                    className="h-5 w-5"
                  />
                </label>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSavePreferences}>Save Preferences</Button>
                <Button variant="ghost" onClick={() => setShowPreferences(false)}>Back</Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## Step 6: Footer Component

**File:** `apps/web/components/layout/Footer.tsx`

```tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">zigznote</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">AI Meeting Assistant</span>
          </div>

          <nav className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm">
            <Link href="/terms" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Privacy Policy
            </Link>
            <Link href="/cookies" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Cookie Policy
            </Link>
            <Link href="/help" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Help Center
            </Link>
          </nav>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} zigznote
          </div>
        </div>
      </div>
    </footer>
  );
}
```

---

## Step 7: Export and Add to Layout

**File:** `apps/web/components/legal/index.ts`

```typescript
export { CookieConsent } from './CookieConsent';
```

**File:** `apps/web/components/layout/index.ts`

Add export if not already present:

```typescript
export { Footer } from './Footer';
```

**File:** `apps/web/app/layout.tsx`

Add import and component:

```tsx
import { CookieConsent } from '@/components/legal';

// In the body, before closing </body>:
<CookieConsent />
```

---

## Verification Checklist

- [ ] `/terms` page renders with proper styling
- [ ] `/privacy` page renders with proper styling
- [ ] `/cookies` page renders with proper styling
- [ ] Cookie consent banner appears on first visit
- [ ] "Accept All" saves preferences and closes banner
- [ ] "Reject All" saves preferences and closes banner
- [ ] "Customize" shows preference toggles
- [ ] Preferences persist after page reload (banner doesn't reappear)
- [ ] Footer links work correctly
