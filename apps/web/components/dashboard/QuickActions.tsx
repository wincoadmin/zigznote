'use client';

import Link from 'next/link';
import { Video, Calendar, RefreshCw, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Button variant="primary" className="w-full justify-start" asChild>
          <Link href="/meetings/new">
            <Plus className="mr-2 h-4 w-4" />
            Schedule Meeting
          </Link>
        </Button>
        <Button variant="secondary" className="w-full justify-start" asChild>
          <Link href="/meetings">
            <Video className="mr-2 h-4 w-4" />
            View All Meetings
          </Link>
        </Button>
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href="/calendar">
            <Calendar className="mr-2 h-4 w-4" />
            Open Calendar
          </Link>
        </Button>
        <Button variant="ghost" className="w-full justify-start">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Calendar
        </Button>
      </CardContent>
    </Card>
  );
}
