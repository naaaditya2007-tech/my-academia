'use client';

import React from 'react';
import { Course } from '@/types/campus';
import { calculateAttendanceMargin } from '@/lib/attendance';
import { toTitleCase } from '@/lib/formatters';

interface AttendanceMarginCardsProps {
  courses: Course[];
  layout?: 'grid' | 'single-column';
  maxItems?: number;
  showKpiBanner?: boolean;
}

export function AttendanceMarginCards({
  courses,
  layout = 'grid',
  maxItems,
  showKpiBanner = true,
}: AttendanceMarginCardsProps) {
  const displayedCourses = maxItems ? courses.slice(0, maxItems) : courses;

  // Compute overall KPI metrics
  const totalConducted = courses.reduce((sum, c) => sum + (c.hoursConducted || 0), 0);
  const totalAttended = courses.reduce((sum, c) => sum + (c.hoursAttended || 0), 0);
  const overallPercentage = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : 0;
  const below75Count = courses.filter((c) => c.attendancePercentage < 75).length;

  const containerClass =
    layout === 'single-column'
      ? 'space-y-3 w-full min-w-0'
      : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 w-full min-w-0';

  return (
    <div className="space-y-4 w-full">
      {/* TOP KPI CARD (MATCHING CAMPUS WEB REFERENCE IMAGE 2) */}
      {showKpiBanner && (
        <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.08] grid grid-cols-3 text-center shadow-lg backdrop-blur-md">
          {/* Col 1: Overall Percentage */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
              {overallPercentage.toFixed(1)}%
            </span>
            <span className="text-xs text-zinc-400 mt-0.5">Overall</span>
          </div>

          {/* Col 2: Total Subjects */}
          <div className="flex flex-col items-center justify-center border-x border-white/[0.08]">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
              {courses.length}
            </span>
            <span className="text-xs text-zinc-400 mt-0.5">Subjects</span>
          </div>

          {/* Col 3: Below 75% */}
          <div className="flex flex-col items-center justify-center">
            <span
              className={`text-2xl sm:text-3xl font-bold tracking-tight font-mono ${
                below75Count > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {below75Count}
            </span>
            <span className="text-xs text-zinc-400 mt-0.5">Below 75%</span>
          </div>
        </div>
      )}

      {/* SUBJECT ATTENDANCE CARDS */}
      {displayedCourses.length === 0 ? (
        <div className="rounded-2xl p-6 bg-white/[0.02] border border-white/[0.06] text-center text-zinc-400">
          <p className="text-xs font-medium text-zinc-300">No course attendance loaded yet</p>
          <p className="text-[11px] text-zinc-500 mt-1">Tap Sync to fetch your live courses and attendance records from SRM Student Portal.</p>
        </div>
      ) : (
        <div className={containerClass}>
          {displayedCourses.map((course) => {
          const margin = calculateAttendanceMargin(course.hoursConducted, course.hoursAttended);
          const pct = course.attendancePercentage;
          const isDanger = pct < 75;

          const progressBarStyle: React.CSSProperties = isDanger
            ? {
                width: `${Math.min(100, Math.max(0, pct))}%`,
                background: '#EF4444',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.6)',
              }
            : {
                width: `${Math.min(100, Math.max(0, pct))}%`,
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                boxShadow: '0 0 12px var(--accent-glow)',
              };

          return (
            <div
              key={course.id}
              className="rounded-2xl p-4 flex flex-col gap-3 bg-white/[0.03] border border-white/[0.08] hover:border-white/20 transition-all shadow-md backdrop-blur-md"
            >
              {/* TOP ROW: Course Title + Subtitle on Left, Big Margin Number on Right */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold leading-snug text-white truncate">
                    {toTitleCase(course.title)}
                  </h3>
                  <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5 truncate">
                    <span className="font-mono text-zinc-300">{course.code}</span>
                    <span>·</span>
                    <span>{course.credits} credits</span>
                    <span>·</span>
                    <span className="truncate">{course.room}</span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div
                    className={`text-2xl sm:text-3xl font-bold font-mono leading-none ${
                      isDanger ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {margin.canSkip > 0 ? margin.canSkip : margin.needed > 0 ? `-${margin.needed}` : 0}
                  </div>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">
                    Margin
                  </span>
                </div>
              </div>

              {/* MIDDLE ROW: Status Pills P / A / T on Left, Exact Percentage on Right */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-400 font-mono">
                    P {course.hoursAttended}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-rose-500/15 text-rose-400 font-mono">
                    A {course.hoursAbsent}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-sky-500/15 text-sky-400 font-mono">
                    T {course.hoursConducted}
                  </span>
                </div>

                <span className="text-sm font-medium text-zinc-200 font-mono">
                  {pct.toFixed(1)}%
                </span>
              </div>

              {/* BOTTOM ROW: Full-Width Thin Progress Bar with 75% Vertical Tick Mark */}
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden relative">
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-white z-10 shadow-sm"
                  style={{ left: '75%' }}
                  title="75% threshold"
                />
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={progressBarStyle}
                />
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
