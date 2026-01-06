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
