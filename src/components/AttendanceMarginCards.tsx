'use client';

import React from 'react';
import { Course } from '@/types/campus';
import { calculateAttendanceMargin } from '@/lib/attendance';
import { toTitleCase } from '@/lib/formatters';

interface AttendanceMarginCardsProps {
  courses: Course[];
  layout?: 'grid' | 'single-column';
  maxItems?: number;
}

export function AttendanceMarginCards({
  courses,
  layout = 'grid',
  maxItems,
}: AttendanceMarginCardsProps) {
  const displayedCourses = maxItems ? courses.slice(0, maxItems) : courses;

  const containerClass =
    layout === 'single-column'
      ? 'space-y-2.5 w-full min-w-0'
      : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 w-full min-w-0';

  return (
    <div className={containerClass}>
      {displayedCourses.map((course) => {
        const margin = calculateAttendanceMargin(course.hoursConducted, course.hoursAttended);
        const pct = course.attendancePercentage;
        
        const isDanger = pct < 75;

        // Theme-synced gradient fill unless strictly danger (< 75%)
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

        const pctTextColor = isDanger ? 'text-rose-400' : 'text-[var(--accent-primary)]';
        const marginTextColor = isDanger ? 'text-rose-400' : 'text-[var(--accent-primary)]';
        const dotBg = isDanger ? 'bg-rose-500' : 'bg-[var(--accent-primary)]';

        return (
          <div
            key={course.id}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] p-3.5 transition-colors flex flex-col justify-between gap-2.5"
          >
            {/* Top Line: Course Title on left, Percentage on right */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-sm text-white tracking-tight truncate">
                {toTitleCase(course.title)}
              </h3>
              <span className={`text-sm font-semibold shrink-0 ${pctTextColor}`}>
                {pct.toFixed(1)}%
              </span>
            </div>

            {/* Middle Line: Code · Room · Faculty */}
            <div className="text-xs text-zinc-400 truncate">
              <span className="font-mono text-zinc-300">{course.code}</span>
              <span className="mx-1.5 text-zinc-600">·</span>
              <span>{course.room}</span>
              <span className="mx-1.5 text-zinc-600">·</span>
              <span>{course.faculty}</span>
            </div>

            {/* Bottom Line: Ultra-thin h-1 progress bar + hours and margin status */}
            <div className="space-y-1.5 pt-0.5">
              <div className="w-full bg-white/[0.06] h-1 rounded-full overflow-hidden relative">
                <div
                  className="absolute top-0 bottom-0 w-[1.5px] bg-white/40 z-10"
                  style={{ left: '75%' }}
                  title="75% threshold"
                />
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={progressBarStyle}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>
                  {course.hoursAttended} / {course.hoursConducted} hrs · {course.hoursAbsent} missed
                </span>

                {/* Clean inline margin: dot + text, NO bulky pill */}
                <span className={`inline-flex items-center gap-1.5 font-medium ${marginTextColor}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`} />
                  {margin.canSkip > 0 ? (
                    `Safe to skip ${margin.canSkip}`
                  ) : margin.needed > 0 ? (
                    `Need ${margin.needed} classes`
                  ) : (
                    'On the margin'
                  )}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
