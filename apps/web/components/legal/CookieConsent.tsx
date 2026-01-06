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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">We use cookies</h3>
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
