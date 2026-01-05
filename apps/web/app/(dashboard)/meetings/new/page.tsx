'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AudioUploader, BrowserRecorder } from '@/components/audio';

export default function NewMeetingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('upload');

  const handleComplete = (meetingId: string) => {
    router.push(`/meetings/${meetingId}`);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">New Meeting</h1>
        <p className="text-slate-500 mt-1">
          Upload a recording or record an in-person meeting
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="upload">Upload Audio</TabsTrigger>
          <TabsTrigger value="record">Record Meeting</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <AudioUploader onUploadComplete={handleComplete} />
        </TabsContent>

        <TabsContent value="record">
          <BrowserRecorder onRecordingComplete={handleComplete} />
        </TabsContent>
      </Tabs>

      <div className="mt-8 p-4 bg-slate-50 rounded-lg">
        <h3 className="font-medium text-slate-900 mb-2">Other options</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>
            - For Zoom, Google Meet, or Teams meetings, go to your calendar and
            the bot will join automatically
          </li>
          <li>- Or paste a meeting link on the meetings page to send a bot</li>
        </ul>
      </div>
    </div>
  );
}
