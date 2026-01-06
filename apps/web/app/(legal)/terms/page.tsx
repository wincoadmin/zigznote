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
