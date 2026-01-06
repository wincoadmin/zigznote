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
