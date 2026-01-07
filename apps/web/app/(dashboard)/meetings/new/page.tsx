'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AudioUploader, BrowserRecorder } from '@/components/audio';
import { MeetingLinkInput } from '@/components/meetings';

export default function NewMeetingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('link');

  const handleComplete = (meetingId: string) => {
    router.push(`/meetings/${meetingId}`);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">New Meeting</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Record a live meeting, upload a recording, or record in-person
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 grid grid-cols-3">
          <TabsTrigger value="link">Join Meeting</TabsTrigger>
          <TabsTrigger value="upload">Upload Audio</TabsTrigger>
          <TabsTrigger value="record">Record Live</TabsTrigger>
        </TabsList>

        <TabsContent value="link">
          <MeetingLinkInput onMeetingCreated={handleComplete} />
        </TabsContent>

        <TabsContent value="upload">
          <AudioUploader onUploadComplete={handleComplete} />
        </TabsContent>

        <TabsContent value="record">
          <BrowserRecorder onRecordingComplete={handleComplete} />
        </TabsContent>
      </Tabs>

      <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Other options</h3>
        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <li>
            - Connect your calendar in Settings to automatically record meetings
          </li>
          <li>- Enable auto-record to have our bot join all your scheduled meetings</li>
        </ul>
      </div>
    </div>
  );
}
