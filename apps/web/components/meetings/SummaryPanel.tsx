'use client';

import { Copy, RefreshCw, Check } from 'lucide-react';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import type { Summary } from '@/types';

interface SummaryPanelProps {
  summary?: Summary | null;
  isLoading?: boolean;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  className?: string;
}

export function SummaryPanel({
  summary,
  isLoading,
  onRegenerate,
  isRegenerating,
  className,
}: SummaryPanelProps) {
  const { addToast } = useToast();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      addToast({
        type: 'success',
        title: 'Copied!',
        description: `${section} copied to clipboard`,
      });
      setTimeout(() => setCopiedSection(null), 2000);
    } catch {
      addToast({
        type: 'error',
        title: 'Failed to copy',
        description: 'Could not copy to clipboard',
      });
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Summary</CardTitle>
          {onRegenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              Generate
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-center text-slate-500 py-8">
            No summary available yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Summary</CardTitle>
        {onRegenerate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary">
          <TabsList className="w-full">
            <TabsTrigger value="summary" className="flex-1">Summary</TabsTrigger>
            <TabsTrigger value="topics" className="flex-1">Topics</TabsTrigger>
            <TabsTrigger value="decisions" className="flex-1">Decisions</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            <div className="relative">
              <p className="text-sm text-slate-700 leading-relaxed">
                {summary.content.executiveSummary}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="absolute -top-1 right-0"
                onClick={() => handleCopy(summary.content.executiveSummary, 'Summary')}
              >
                {copiedSection === 'Summary' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="topics" className="mt-4">
            <div className="space-y-4">
              {summary.content.topics.map((topic, index) => (
                <div key={index} className="rounded-lg bg-slate-50 p-3">
                  <h4 className="font-medium text-slate-900">{topic.title}</h4>
                  <p className="mt-1 text-sm text-slate-600">{topic.summary}</p>
                </div>
              ))}
              {summary.content.topics.length === 0 && (
                <p className="text-center text-slate-500 py-4">No topics extracted</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="decisions" className="mt-4">
            <div className="space-y-2">
              {summary.content.decisions.map((decision, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 rounded-lg bg-slate-50 p-3"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                    {index + 1}
                  </span>
                  <p className="text-sm text-slate-700">{decision}</p>
                </div>
              ))}
              {summary.content.decisions.length === 0 && (
                <p className="text-center text-slate-500 py-4">No decisions recorded</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
