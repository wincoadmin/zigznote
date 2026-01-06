'use client';

import Link from 'next/link';
import { Video, Calendar, RefreshCw, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="p-3 sm:p-6">
        <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:gap-3 p-3 sm:p-6 pt-0">
        <Button variant="primary" className="w-full justify-start text-xs sm:text-sm h-9 sm:h-10" asChild>
          <Link href="/meetings/new">
            <Plus className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Schedule Meeting
          </Link>
        </Button>
        <Button variant="secondary" className="w-full justify-start text-xs sm:text-sm h-9 sm:h-10" asChild>
          <Link href="/meetings">
            <Video className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            View All Meetings
          </Link>
        </Button>
        <Button variant="outline" className="w-full justify-start text-xs sm:text-sm h-9 sm:h-10" asChild>
          <Link href="/calendar">
            <Calendar className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Open Calendar
          </Link>
        </Button>
        <Button variant="ghost" className="w-full justify-start text-xs sm:text-sm h-9 sm:h-10">
          <RefreshCw className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Sync Calendar
        </Button>
      </CardContent>
    </Card>
  );
}
