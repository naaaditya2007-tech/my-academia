'use client';

import React from 'react';
import { Course, ScheduledClass } from '@/types/campus';
import { buildDayTimeline } from '@/lib/timetable';
import { Clock, MapPin, User, Coffee } from 'lucide-react';

interface TimetableFullViewProps {
  selectedDayOrder: number;
  onSelectDayOrder: (day: number) => void;
  courses: Course[];
  dayOrderMatrix: Record<number, any>;
}

export function TimetableFullView({
  selectedDayOrder,
  onSelectDayOrder,
  courses,
  dayOrderMatrix,
}: TimetableFullViewProps) {
  const dayTabs = [
    { day: 1, label: 'Day 1', date: 'Thu, 19 Nov', count: 3 },
    { day: 2, label: 'Day 2', date: 'Fri, 20 Nov', count: 2 },
    { day: 3, label: 'Day 3', date: 'Mon, 16 Nov', count: 6 },
    { day: 4, label: 'Day 4', date: 'Tue, 17 Nov', count: 3 },
    { day: 5, label: 'Day 5', date: 'Wed, 18 Nov', count: 4 },
  ];

  const timeline: ScheduledClass[] = buildDayTimeline(
    selectedDayOrder,
    courses,
    dayOrderMatrix
  );

  return (
    <div className="space-y-4 select-none">
      {/* Symmetrical Day 1..5 Cards Grid (Without Redundant Square Box) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {dayTabs.map((tab) => {
          const isActive = selectedDayOrder === tab.day;
          return (
            <button
              key={tab.day}
              onClick={() => onSelectDayOrder(tab.day)}
              className={`p-3 rounded-2xl text-left transition-all border ${
                tab.day === 5 ? 'col-span-2 sm:col-span-1' : ''
              } ${
                isActive
                  ? 'bg-white/[0.08] border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)] shadow-md'
                  : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20 text-zinc-400 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold ${
                    isActive ? 'text-[var(--accent-primary)]' : 'text-zinc-200'
                  }`}
                >
                  {tab.label}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {tab.count} classes
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 block mt-1 font-mono">
                {tab.date}
              </span>
            </button>
          );
        })}
      </div>

      {/* Chronological List of Classes for Selected Day */}
      <div className="space-y-3">
        {timeline.map((item, index) => {
          if (item.isBreak) {
            return (
              <div
                key={`break_${index}`}
                className="px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between text-xs text-zinc-400"
              >
                <div className="flex items-center gap-2">
                  <Coffee className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium text-zinc-300">
                    {item.breakDurationMinutes || 15}m Break / Intermission
                  </span>
                </div>
                <span className="font-mono text-zinc-500 text-[11px]">
                  {item.startTime} - {item.endTime}
                </span>
              </div>
            );
          }

          return (
            <div
              key={`class_${index}`}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md backdrop-blur-md"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/[0.06] text-zinc-300 font-semibold">
                    {item.course?.code || 'COURSE'}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.04] text-zinc-400">
                    {item.course?.type || 'Theory'}
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-white tracking-tight leading-snug truncate">
                  {item.course?.title || 'Course Title'}
                </h4>

                <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-zinc-500" />
                    <span>{item.course?.room || 'TP TBA'}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 truncate font-sans">
                    <User className="w-3 h-3 text-zinc-500" />
                    <span className="truncate">{item.course?.faculty || 'Faculty'}</span>
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex items-center justify-between sm:flex-col sm:items-end gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono">
                  <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>
                    {item.startTime} - {item.endTime}
                  </span>
                </div>

                <span
                  className={`text-xs font-mono font-semibold ${
                    (item.course?.attendancePercentage ?? 0) >= 75
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {(item.course?.attendancePercentage ?? 0).toFixed(1)}% Attended
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
