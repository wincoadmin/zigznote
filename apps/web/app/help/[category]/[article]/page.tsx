'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Clock, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getArticleById,
  getCategoryById,
  helpCategories,
} from '@/lib/help-content';
import ReactMarkdown from 'react-markdown';

export default function ArticlePage() {
  const params = useParams();
  const categoryId = params.category as string;
  const articleId = params.article as string;

  const article = getArticleById(articleId);
  const category = getCategoryById(categoryId);

  if (!article || !category) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Article not found
        </h1>
        <p className="text-slate-500 mb-6">
          The article you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/help">Back to Help Center</Link>
        </Button>
      </div>
    );
  }

  // Get related articles from same category
  const relatedArticles = category.articles
    .filter((a) => a.id !== articleId)
    .slice(0, 3);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/help" className="hover:text-primary-600">
          Help Center
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link
          href={`/help/${category.id}`}
          className="hover:text-primary-600"
        >
          {category.name}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-700">{article.title}</span>
      </nav>

      {/* Back button */}
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/help">
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back to Help Center
        </Link>
      </Button>

      {/* Article header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-3">
          {article.title}
        </h1>
        <p className="text-lg text-slate-500 mb-4">{article.description}</p>
        <div className="flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              <Tag className="w-3 h-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Article content */}
      <div className="prose prose-slate max-w-none mb-12">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="font-heading text-2xl font-bold text-slate-900 mt-8 mb-4">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="font-heading text-xl font-semibold text-slate-900 mt-6 mb-3">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="font-heading text-lg font-semibold text-slate-900 mt-4 mb-2">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="text-slate-600 mb-4 leading-relaxed">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-2 mb-4 text-slate-600">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-2 mb-4 text-slate-600">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => (
              <strong className="font-semibold text-slate-900">{children}</strong>
            ),
            code: ({ children }) => (
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-slate-800">
                {children}
              </code>
            ),
          }}
        >
          {article.content}
        </ReactMarkdown>
      </div>

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <div className="border-t border-slate-200 pt-8">
          <h2 className="font-heading text-xl font-bold text-slate-900 mb-4">
            Related Articles
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {relatedArticles.map((related) => (
              <Card key={related.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <Link
                    href={`/help/${category.id}/${related.id}`}
                    className="group"
                  >
                    <h3 className="font-medium text-slate-900 group-hover:text-primary-600 mb-1">
                      {related.title}
                    </h3>
                    <p className="text-sm text-slate-500 line-clamp-2">
                      {related.description}
                    </p>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      <Card className="mt-8 bg-slate-50 border-slate-200">
        <CardContent className="py-6">
          <div className="text-center">
            <p className="text-slate-700 mb-4">Was this article helpful?</p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" size="sm">
                Yes, thanks!
              </Button>
              <Button variant="outline" size="sm">
                Not really
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
