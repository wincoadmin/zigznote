'use client';

import Link from 'next/link';
import { Twitter, Linkedin, Github } from 'lucide-react';
import { footerContent } from '@/lib/landing-content';

const socialIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Twitter,
  LinkedIn: Linkedin,
  GitHub: Github,
};

export function Footer() {
  return (
    <footer className="relative py-16 lg:py-20 bg-slate-900 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <span className="text-2xl font-bold">
                <span className="text-primary-500">zig</span>
                <span className="text-white">znote</span>
              </span>
            </Link>
            <p className="text-slate-400 text-sm mb-6 max-w-xs">
              {footerContent.brand.tagline}
            </p>

            {/* Social links */}
            <div className="flex items-center gap-4">
              {footerContent.social.map((social, index) => {
                const Icon = socialIcons[social.icon];
                return (
                  <Link
                    key={index}
                    href={social.href}
                    className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-primary-400 hover:bg-slate-700 transition-colors"
                    aria-label={social.name}
                  >
                    {Icon && <Icon className="h-5 w-5" />}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {footerContent.columns.map((column, index) => (
            <div key={index}>
              <h4 className="font-semibold text-white mb-4">{column.title}</h4>
              <ul className="space-y-3">
                {column.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-primary-400 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-800">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">{footerContent.copyright}</p>
            <div className="flex items-center gap-6">
              <Link
                href="/privacy"
                className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/cookies"
                className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
              >
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
