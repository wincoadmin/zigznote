'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Rocket,
  Sparkles,
  Plug,
  User,
  ChevronRight,
  Mail,
  MessageSquare,
  HelpCircle,
  Book,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  helpCategories,
  faqs,
  quickLinks,
  searchArticles,
  type HelpArticle,
} from '@/lib/help-content';

const categoryIcons: Record<string, React.ReactNode> = {
  Rocket: <Rocket className="w-6 h-6" />,
  Sparkles: <Sparkles className="w-6 h-6" />,
  Plug: <Plug className="w-6 h-6" />,
  User: <User className="w-6 h-6" />,
};

const quickLinkIcons: Record<string, React.ReactNode> = {
  Rocket: <Rocket className="w-5 h-5" />,
  Calendar: <Book className="w-5 h-5" />,
  Sparkles: <Sparkles className="w-5 h-5" />,
  Code: <ExternalLink className="w-5 h-5" />,
  Mail: <Mail className="w-5 h-5" />,
};

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HelpArticle[]>([]);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      setSearchResults(searchArticles(query));
    } else {
      setSearchResults([]);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-8 h-8 text-primary-600" />
        </div>
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-2">
          How can we help?
        </h1>
        <p className="text-slate-500 max-w-md mx-auto">
          Search our help center or browse categories below
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-xl mx-auto mb-12">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search for help articles..."
          className="w-full pl-12 pr-4 py-3 text-lg border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-96 overflow-y-auto">
            {searchResults.map((article) => (
              <Link
                key={article.id}
                href={`/help/${article.category}/${article.id}`}
                className="block px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0"
              >
                <p className="font-medium text-slate-900">{article.title}</p>
                <p className="text-sm text-slate-500">{article.description}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap justify-center gap-3 mb-12">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-full text-sm text-slate-700 transition-colors"
          >
            {quickLinkIcons[link.icon]}
            {link.title}
          </Link>
        ))}
      </div>

      {/* Categories */}
      <div className="grid gap-6 md:grid-cols-2 mb-12">
        {helpCategories.map((category) => (
          <Card key={category.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600">
                  {categoryIcons[category.icon]}
                </div>
                <div>
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                  <p className="text-sm text-slate-500">{category.description}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {category.articles.slice(0, 3).map((article) => (
                  <li key={article.id}>
                    <Link
                      href={`/help/${category.id}/${article.id}`}
                      className="flex items-center justify-between py-2 px-3 -mx-3 rounded-lg hover:bg-slate-50 text-slate-700 group"
                    >
                      <span>{article.title}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary-500" />
                    </Link>
                  </li>
                ))}
              </ul>
              {category.articles.length > 3 && (
                <Link
                  href={`/help/${category.id}`}
                  className="block mt-3 text-sm text-primary-600 hover:text-primary-700"
                >
                  View all {category.articles.length} articles
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FAQ Section */}
      <div className="mb-12">
        <h2 className="font-heading text-2xl font-bold text-slate-900 mb-6 text-center">
          Frequently Asked Questions
        </h2>
        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-slate-200 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{faq.question}</span>
                <ChevronRight
                  className={`w-5 h-5 text-slate-400 transition-transform ${
                    expandedFaq === index ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {expandedFaq === index && (
                <div className="px-5 pb-4 text-slate-600">{faq.answer}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <Card className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
        <CardContent className="py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Still need help?</h3>
                <p className="text-primary-100">
                  Our support team is here to assist you
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="bg-white text-primary-600 hover:bg-primary-50"
                asChild
              >
                <a href="mailto:support@zigznote.com">
                  <Mail className="mr-2 w-4 h-4" />
                  Email Support
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
