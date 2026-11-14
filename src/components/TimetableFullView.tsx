'use client';

import React from 'react';
import { Course, ScheduledClass } from '@/types/campus';
import { buildDayTimeline, formatBreakDuration } from '@/lib/timetable';
import { formatTime12h } from '@/lib/attendance';
import { Clock, MapPin, User, Coffee, CheckCircle, Radio } from 'lucide-react';

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
    <div className="space-y-5">
      {/* Day Order Radio Group Header */}
      <div className="hw-card rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Instructional Day Schedule
            </h2>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Select a Day Order to inspect classes, lecture halls, and lab sessions
            </p>
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
            Day Order {selectedDayOrder}
          </span>
        </div>

        {/* Radio Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {dayTabs.map((tab) => {
            const isActive = selectedDayOrder === tab.day;
            return (
              <button
                key={tab.day}
                onClick={() => onSelectDayOrder(tab.day)}
                className={`p-3 rounded-xl text-left transition-all border ${
                  isActive
                    ? 'bg-[#181C28] border-emerald-500/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.25)]'
                    : 'bg-[#12151E] border-white/[0.06] hover:border-white/20 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      isActive ? 'text-emerald-400' : 'text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {tab.count} classes
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 block mt-1">
                  {tab.date}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chronological List of Classes with breaks */}
      <div className="space-y-3">
        {timeline.map((item, index) => {
          if (item.isBreak) {
            return (
              <div
                key={`break_${index}`}
                className="px-4 py-3 rounded-xl bg-[#0e1017] border border-white/[0.04] flex items-center justify-between text-xs text-zinc-400"
              >
                <div className="flex items-center gap-2.5">
                  <Coffee className="w-4 h-4 text-zinc-400" />
                  <span className="font-medium text-zinc-300">
                    {formatBreakDuration(item.breakDurationMinutes || 60)} Free
                  </span>
                </div>
                <span className="font-mono-numbers text-[11px] text-zinc-400">
                  {formatTime12h(item.startTime)} to {formatTime12h(item.endTime)}
                </span>
              </div>
            );
          }

          const course = item.course;
          if (!course) return null;

          return (
            <div
              key={`class_${index}`}
              className="hw-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-white/20 transition-all"
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="min-w-[90px]">
                  <span className="font-mono-numbers text-xs font-bold text-white block">
                    {formatTime12h(item.startTime)}
                  </span>
                  <span className="font-mono-numbers text-[11px] text-zinc-400 block">
                    to {formatTime12h(item.endTime)}
                  </span>
                </div>

                <div className="h-9 w-[1px] bg-white/10 hidden sm:block" />

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-white tracking-tight">
                      {course.title}
                    </h3>
                    <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-zinc-300">
                      {course.type}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      {course.code}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400 flex-wrap">
                    <span className="flex items-center gap-1 font-mono text-zinc-300">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      <strong>{course.room}</strong>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-zinc-400" />
                      {course.faculty}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono font-semibold text-emerald-400">
                  {course.attendancePercentage.toFixed(1)}% Attn
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
