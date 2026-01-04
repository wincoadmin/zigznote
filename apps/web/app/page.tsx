import Link from 'next/link';
import { ArrowRight, Mic, FileText, Zap, Calendar } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen gradient-mesh">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary-500" />
              <span className="font-heading text-xl font-bold">
                <span className="text-primary-500">zig</span>
                <span className="text-slate-700">note</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/sign-in" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/sign-up" className="btn-primary">
                Get started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="font-heading text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Your meetings,{' '}
            <span className="text-primary-500">simplified</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            zigznote automatically joins your meetings, transcribes
            conversations, generates intelligent summaries, and extracts action
            items. Focus on the conversation, not the notes.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/sign-up" className="btn-primary inline-flex items-center gap-2">
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/demo" className="btn-secondary">
              Watch demo
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="mt-24 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<Mic className="h-6 w-6" />}
            title="Auto-join meetings"
            description="Bot automatically joins your Zoom, Meet, and Teams calls"
          />
          <FeatureCard
            icon={<FileText className="h-6 w-6" />}
            title="Smart transcription"
            description="95%+ accurate transcription with speaker identification"
          />
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title="AI summaries"
            description="Get structured summaries and action items instantly"
          />
          <FeatureCard
            icon={<Calendar className="h-6 w-6" />}
            title="Calendar sync"
            description="Connects with Google Calendar for seamless scheduling"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} zigznote. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="card animate-fade-in-up">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
        {icon}
      </div>
      <h3 className="font-heading text-lg font-semibold text-slate-900">
        {title}
      </h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
