'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">General Settings</h2>
        <p className="text-sm text-slate-500">Manage your organization settings</p>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              defaultValue="My Organization"
              className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      {/* Default Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Meeting Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Auto-join scheduled meetings</p>
              <p className="text-sm text-slate-500">
                Automatically send bot to join meetings from connected calendars
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Auto-generate summaries</p>
              <p className="text-sm text-slate-500">
                Automatically generate AI summaries after meetings end
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Extract action items</p>
              <p className="text-sm text-slate-500">
                Automatically identify and extract action items from meetings
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Delete Organization</p>
              <p className="text-sm text-slate-500">
                Permanently delete your organization and all associated data
              </p>
            </div>
            <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
              Delete Organization
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
