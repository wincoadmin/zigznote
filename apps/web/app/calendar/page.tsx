'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Sample meetings for demo
const sampleMeetings = [
  { id: '1', title: 'Product Sync', time: '10:00 AM', platform: 'Zoom' },
  { id: '2', title: 'Client Call', time: '2:00 PM', platform: 'Google Meet' },
  { id: '3', title: 'Team Standup', time: '9:00 AM', platform: 'Teams' },
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      month === selectedDate.getMonth() &&
      year === selectedDate.getFullYear()
    );
  };

  const renderCalendarDays = () => {
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const hasMeetings = day % 3 === 0; // Demo: every 3rd day has meetings
      days.push(
        <button
          key={day}
          onClick={() => setSelectedDate(new Date(year, month, day))}
          className={`h-24 p-2 border-t border-slate-200 text-left transition-colors hover:bg-slate-50 ${
            isSelected(day) ? 'bg-primary-50 ring-2 ring-primary-500 ring-inset' : ''
          } ${isToday(day) ? 'bg-primary-50' : ''}`}
        >
          <span
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${
              isToday(day)
                ? 'bg-primary-500 text-white font-semibold'
                : 'text-slate-700'
            }`}
          >
            {day}
          </span>
          {hasMeetings && (
            <div className="mt-1">
              <div className="text-xs text-primary-600 truncate">
                Meeting
              </div>
            </div>
          )}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
          <p className="text-slate-500">View and manage your meeting schedule</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Schedule Meeting
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200 overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {MONTHS[month]} {year}
              </h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={prevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200">
            {DAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-sm font-medium text-slate-500"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">{renderCalendarDays()}</div>
        </div>

        {/* Selected Day Details */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900 mb-4">
            {selectedDate
              ? selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Select a date'}
          </h3>

          {selectedDate && (
            <div className="space-y-3">
              {sampleMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Video className="w-4 h-4 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {meeting.title}
                      </p>
                      <p className="text-sm text-slate-500">
                        {meeting.time} · {meeting.platform}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <Button variant="outline" className="w-full mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add Meeting
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
