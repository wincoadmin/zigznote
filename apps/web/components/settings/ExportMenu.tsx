'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Download,
  FileText,
  FileJson,
  Subtitles,
  FileType2,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { meetingExportApi, MeetingExportOptions } from '@/lib/api';

interface ExportMenuProps {
  meetingId: string;
  meetingTitle: string;
  hasTranscript?: boolean;
  hasSummary?: boolean;
  hasActionItems?: boolean;
  className?: string;
}

type ExportFormat = 'pdf' | 'docx' | 'srt' | 'txt' | 'json';

interface FormatOption {
  value: ExportFormat;
  label: string;
  description: string;
  icon: typeof FileText;
  requiresTranscript?: boolean;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'pdf',
    label: 'PDF Document',
    description: 'Formatted document with summary and transcript',
    icon: FileText,
  },
  {
    value: 'docx',
    label: 'Word Document',
    description: 'Editable document format',
    icon: FileType2,
  },
  {
    value: 'srt',
    label: 'SRT Subtitles',
    description: 'Subtitle file with timestamps',
    icon: Subtitles,
    requiresTranscript: true,
  },
  {
    value: 'txt',
    label: 'Plain Text',
    description: 'Simple text transcript',
    icon: FileText,
    requiresTranscript: true,
  },
  {
    value: 'json',
    label: 'JSON Data',
    description: 'Full meeting data export',
    icon: FileJson,
  },
];

export function ExportMenu({
  meetingId,
  meetingTitle,
  hasTranscript = true,
  hasSummary = true,
  hasActionItems = true,
  className,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState({
    includeTranscript: true,
    includeSummary: true,
    includeActionItems: true,
    includeSpeakerNames: true,
    includeTimestamps: true,
  });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);

    try {
      const exportOptions: MeetingExportOptions = {
        format,
        ...options,
      };

      const blob = await meetingExportApi.export(meetingId, exportOptions);

      // Determine file extension
      let extension: string = format;
      if (format === 'pdf' || format === 'docx') {
        extension = 'html'; // API returns HTML for these formats currently
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meetingTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsOpen(false);
      setShowOptions(false);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const availableFormats = FORMAT_OPTIONS.filter(
    (format) => !format.requiresTranscript || hasTranscript
  );

  return (
    <div ref={menuRef} className={cn('relative', className)}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-slate-200 bg-white shadow-lg z-50">
          {!showOptions ? (
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Export Format
              </p>
              {availableFormats.map((format) => {
                const Icon = format.icon;
                return (
                  <button
                    key={format.value}
                    onClick={() => {
                      setSelectedFormat(format.value);
                      setShowOptions(true);
                    }}
                    disabled={isExporting}
                    className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <Icon className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {format.label}
                      </p>
                      <p className="text-xs text-slate-500">{format.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setShowOptions(false)}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Back
                </button>
                <span className="text-sm font-medium text-slate-900">
                  {FORMAT_OPTIONS.find((f) => f.value === selectedFormat)?.label}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                {selectedFormat !== 'srt' && selectedFormat !== 'txt' && (
                  <>
                    {hasSummary && (
                      <Switch
                        checked={options.includeSummary}
                        onChange={(e) =>
                          setOptions({ ...options, includeSummary: e.target.checked })
                        }
                        label="Include summary"
                        size="sm"
                      />
                    )}
                    {hasActionItems && (
                      <Switch
                        checked={options.includeActionItems}
                        onChange={(e) =>
                          setOptions({ ...options, includeActionItems: e.target.checked })
                        }
                        label="Include action items"
                        size="sm"
                      />
                    )}
                  </>
                )}

                {hasTranscript && (
                  <>
                    {selectedFormat !== 'srt' && selectedFormat !== 'txt' && (
                      <Switch
                        checked={options.includeTranscript}
                        onChange={(e) =>
                          setOptions({ ...options, includeTranscript: e.target.checked })
                        }
                        label="Include transcript"
                        size="sm"
                      />
                    )}

                    <Switch
                      checked={options.includeSpeakerNames}
                      onChange={(e) =>
                        setOptions({ ...options, includeSpeakerNames: e.target.checked })
                      }
                      label="Include speaker names"
                      size="sm"
                    />

                    <Switch
                      checked={options.includeTimestamps}
                      onChange={(e) =>
                        setOptions({ ...options, includeTimestamps: e.target.checked })
                      }
                      label="Include timestamps"
                      size="sm"
                    />
                  </>
                )}
              </div>

              <Button
                onClick={() => handleExport(selectedFormat)}
                isLoading={isExporting}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export as {FORMAT_OPTIONS.find((f) => f.value === selectedFormat)?.label}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
