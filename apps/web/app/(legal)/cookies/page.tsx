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
