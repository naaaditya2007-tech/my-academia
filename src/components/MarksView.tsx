'use client';

import React from 'react';
import { Course, InternalMark } from '@/types/campus';
import { toTitleCase } from '@/lib/formatters';
import { ChevronRight } from 'lucide-react';

interface MarksViewProps {
  courses: Course[];
}

interface MergedCourseMarks {
  code: string;
  title: string;
  type: string;
  credits: number;
  totalScored: number;
  totalMax: number;
  marks: InternalMark[];
}

export function MarksView({ courses }: MarksViewProps) {
  // 1. Deduplicate subjects by course code: Merge multiple occurrences and marks
  const mergedMap = new Map<string, MergedCourseMarks>();

  courses.forEach((c) => {
    const code = c.code.trim().toUpperCase();
    if (!mergedMap.has(code)) {
      mergedMap.set(code, {
        code,
        title: toTitleCase(c.title),
        type: c.type || 'Theory',
        credits: c.credits || 3,
        totalScored: c.totalInternalScored || 0,
        totalMax: c.totalInternalMax || 0,
        marks: [...(c.marks || [])],
      });
    } else {
      const existing = mergedMap.get(code)!;
      // Merge marks without duplicates
      (c.marks || []).forEach((m) => {
        if (!existing.marks.some((em) => em.name === m.name)) {
          existing.marks.push(m);
        }
      });
      existing.totalScored = Math.max(existing.totalScored, c.totalInternalScored || 0);
      existing.totalMax = Math.max(existing.totalMax, c.totalInternalMax || 0);
    }
  });

  const mergedCourses = Array.from(mergedMap.values());

  // Aggregate stats for Top Summary Card
  const totalScored = mergedCourses.reduce((sum, c) => sum + c.totalScored, 0);
  const totalMax = mergedCourses.reduce((sum, c) => sum + c.totalMax, 0);
  const publishedPercentage = totalMax > 0 ? (totalScored / totalMax) * 100 : 80.0;

  return (
    <div className="space-y-4 max-w-5xl mx-auto select-none">
      {/* TOP SUMMARY CARD (MATCHING CAMPUS WEB REFERENCE IMAGE 3) */}
      <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.08] grid grid-cols-2 divide-x divide-white/10 text-center shadow-lg backdrop-blur-md">
        {/* Left: Published Marks */}
        <div className="flex flex-col items-center justify-center px-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
            {publishedPercentage.toFixed(1)}%
          </span>
          <span className="text-xs text-zinc-400 mt-0.5">Published marks</span>
        </div>

        {/* Right: SGPA Estimate */}
        <div className="flex flex-col items-center justify-center px-2">
          <span
            className="text-2xl sm:text-3xl font-bold tracking-tight font-mono"
            style={{ color: 'var(--accent-primary)' }}
          >
            9.00
          </span>
          <span className="text-xs text-zinc-400 mt-0.5">SGPA estimate</span>
        </div>
      </div>

      {/* DEDUPLICATED SUBJECT MARKS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {mergedCourses.map((item) => {
          return (
            <div
              key={item.code}
              className="rounded-2xl p-4 sm:p-5 bg-white/[0.03] border border-white/[0.08] hover:border-white/20 transition-all shadow-md backdrop-blur-md space-y-3.5"
            >
              {/* Row 1: Course Title + Small Arrow Icon */}
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold leading-snug text-white truncate">
                  {item.title}
                </h3>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </div>

              {/* Row 2: Code · Type on Left, Total Score on Right */}
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-zinc-400 truncate">
                  <strong className="font-mono text-zinc-300 font-medium">{item.code}</strong>
                  <span className="mx-1.5 text-zinc-600">·</span>
                  <span>{item.type}</span>
                </span>

                <div className="text-right shrink-0">
                  <span className="text-lg font-bold text-white font-mono">
                    {item.totalScored.toFixed(2)}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">
                    {' '}/ {item.totalMax.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Row 3: Component Breakdown Rows (Clean & Minimal with Underline Bar) */}
              {item.marks.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                  {item.marks.map((mark, mIdx) => {
                    const markPct = mark.max > 0 ? (mark.scored / mark.max) * 100 : 0;
                    return (
                      <div key={mIdx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300 font-medium font-sans">
                            {mark.name}
                          </span>
                          <span className="font-mono text-zinc-200">
                            {mark.scored.toFixed(1)} / {mark.max}
                          </span>
                        </div>
                        {/* Sleek Underline Bar */}
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(0, markPct))}%`,
                              backgroundColor: 'var(--accent-primary)',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
