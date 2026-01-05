'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getCategoryById } from '@/lib/help-content';

export default function CategoryPage() {
  const params = useParams();
  const categoryId = params.category as string;
  const category = getCategoryById(categoryId);

  if (!category) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Category not found
        </h1>
        <Button asChild>
          <Link href="/help">Back to Help Center</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/help" className="hover:text-primary-600">
          Help Center
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-700">{category.name}</span>
      </nav>

      {/* Back button */}
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/help">
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back to Help Center
        </Link>
      </Button>

      {/* Category header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-2">
          {category.name}
        </h1>
        <p className="text-lg text-slate-500">{category.description}</p>
      </div>

      {/* Articles list */}
      <div className="space-y-4">
        {category.articles.map((article) => (
          <Card key={article.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4">
              <Link
                href={`/help/${category.id}/${article.id}`}
                className="flex items-start gap-4 group"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100">
                  <FileText className="w-5 h-5 text-slate-500 group-hover:text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900 group-hover:text-primary-600 mb-1">
                    {article.title}
                  </h3>
                  <p className="text-sm text-slate-500">{article.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-500 mt-2" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
