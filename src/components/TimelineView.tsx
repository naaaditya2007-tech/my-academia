'use client';

import React from 'react';
import { ScheduledClass } from '@/types/campus';
import { formatBreakDuration } from '@/lib/timetable';
import { formatTime12h } from '@/lib/attendance';
import { Coffee, CheckCircle, Clock } from 'lucide-react';

interface TimelineViewProps {
  timeline: ScheduledClass[];
  isHoliday: boolean;
  holidayReason?: string;
  nextWorkingDayOrder?: number;
  onJumpToNextWorkingDay?: () => void;
  isLiveDay?: boolean;
}

export function TimelineView({
  timeline,
  isHoliday,
  holidayReason,
  nextWorkingDayOrder,
  onJumpToNextWorkingDay,
  isLiveDay = false,
}: TimelineViewProps) {
  if (isHoliday) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center flex flex-col items-center justify-center my-2">
        <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-400 mb-2.5">
          <Coffee className="w-5 h-5 text-zinc-300" />
        </div>
        <h3 className="text-sm font-semibold text-white tracking-tight">
          No classes scheduled
        </h3>
        <p className="text-xs text-zinc-400 max-w-sm mt-1 mb-4">
          {holidayReason || 'Academic Holiday'}. Campus resumes on Monday with Day Order {nextWorkingDayOrder || 3}.
        </p>
        {nextWorkingDayOrder && onJumpToNextWorkingDay && (
          <button
            onClick={onJumpToNextWorkingDay}
            className="px-3.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 text-white transition-colors text-xs font-medium"
          >
            Preview Day Order {nextWorkingDayOrder}
          </button>
        )}
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-zinc-400 my-2">
        <p className="text-xs">No registered courses found for this Day Order.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 my-2">
      {timeline.map((item, index) => {
        // Render break item
        if (item.isBreak) {
          const nextRegistered = timeline.slice(index + 1).find((t) => t.course);
          return (
            <div
              key={`break_${index}`}
              className="px-3.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between text-xs text-zinc-400"
            >
              <div className="flex items-center gap-2">
                <Coffee className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-300">
                  {formatBreakDuration(item.breakDurationMinutes || 50)}
                  {nextRegistered?.course ? ` before ${nextRegistered.course.title}` : ''}
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">
                {formatTime12h(item.startTime)} – {formatTime12h(item.endTime)}
              </span>
            </div>
          );
        }

        const course = item.course;
        if (!course) return null;

        const isLive = Boolean(isLiveDay && item.status === 'live');
        const isCompleted = Boolean(isLiveDay && item.status === 'completed');

        return (
          <div
            key={`class_${course.id}_${item.periodIndex}`}
            className={`p-3.5 rounded-xl border transition-colors ${
              isLive
                ? 'bg-emerald-500/[0.07] border-emerald-500/30'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                {/* Time block */}
                <div className="min-w-[80px] shrink-0">
                  <span className="text-xs font-medium text-white block">
                    {formatTime12h(item.startTime)}
                  </span>
                  <span className="text-[11px] text-zinc-400 block">
                    to {formatTime12h(item.endTime)}
                  </span>
                </div>

                <div className="h-7 w-[1px] bg-white/[0.06] hidden sm:block shrink-0" />

                {/* Course details */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white tracking-tight truncate">
                      {course.title}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 shrink-0">
                      {course.code}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 truncate mt-0.5">
                    <span>{course.room}</span>
                    <span className="mx-1.5 text-zinc-600">·</span>
                    <span>{course.faculty}</span>
                  </div>
                </div>
              </div>

              {/* Status indicator on the right */}
              <div className="shrink-0 self-center">
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Live
                  </span>
                ) : isCompleted ? (
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                    <CheckCircle className="w-3.5 h-3.5 text-zinc-400" />
                    Done
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400">
                    Upcoming
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
