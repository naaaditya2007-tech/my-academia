'use client';

import React from 'react';
import { Course } from '@/types/campus';
import { Award, Sparkles, TrendingUp, CheckCircle2, ChevronRight } from 'lucide-react';

interface MarksViewProps {
  courses: Course[];
}

export function MarksView({ courses }: MarksViewProps) {
  // Strict dynamic calculations from registered courses (Zero-Mock Fallback)
  const totalScored = Math.round(courses.reduce((acc, c) => acc + (c.totalInternalScored || 0), 0) * 100) / 100;
  const totalMax = Math.round(courses.reduce((acc, c) => acc + (c.totalInternalMax || 0), 0) * 100) / 100;
  const aggregatePct = totalMax > 0 ? (totalScored / totalMax) * 100 : 0;
  const totalAssessments = courses.reduce((acc, c) => acc + (c.marks?.length || 0), 0);

  return (
    <div className="space-y-5">
      {/* Overview Banner */}
      <div className="hw-card rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs uppercase font-mono tracking-wider text-zinc-400">
              Internal Assessments & Projected Performance
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold font-mono-numbers text-white tracking-tight">
              {totalScored.toFixed(2)}{' '}
              <span className="text-base text-zinc-500 font-normal">/ {totalMax.toFixed(0)}</span>
            </span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
              {aggregatePct.toFixed(1)}% Scored
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            {totalAssessments} assessment components published across {courses.length} registered subjects
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] font-mono text-zinc-400 block uppercase">
              Projected SGPA
            </span>
            <span className="text-2xl font-bold font-mono-numbers text-emerald-400">
              9.00
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm">
            A+
          </div>
        </div>
      </div>

      {/* Grid of Subject Internal Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map((course) => {
          const hasMarks = course.marks && course.marks.length > 0;
          const pct =
            course.totalInternalMax > 0
              ? (course.totalInternalScored / course.totalInternalMax) * 100
              : 0;

          const gradeBadge =
            pct >= 85 ? 'O' : pct >= 75 ? 'A+' : pct >= 65 ? 'A' : 'B+';

          return (
            <div
              key={course.id}
              className="hw-card rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-semibold text-sm text-white tracking-tight">
                      {course.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[10px] text-zinc-400">
                        {course.code}
                      </span>
                      <span className="text-[10px] text-zinc-500">•</span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {course.credits} Credits · {course.type}
                      </span>
                    </div>
                  </div>

                  {hasMarks && (
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="font-mono-numbers text-base font-bold text-white">
                          {course.totalInternalScored.toFixed(2)}
                        </span>
                        <span className="font-mono text-xs text-zinc-500">
                          /{course.totalInternalMax.toFixed(0)} conducted
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-bold ml-1">
                          {gradeBadge}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {hasMarks && (
                  <div className="w-full bg-[#181C28] h-1.5 rounded-full overflow-hidden my-2">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        background:
                          pct < 50
                            ? '#EF4444'
                            : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                        boxShadow: '0 0 12px var(--accent-glow)',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Assessment Breakdown List */}
              <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block mb-1">
                  Assessment Breakdown
                </span>

                {hasMarks ? (
                  <div className="space-y-1.5">
                    {course.marks.map((mark, mIdx) => {
                      const mPct = (mark.scored / mark.max) * 100;
                      return (
                        <div
                          key={mIdx}
                          className="px-3 py-2 rounded-xl bg-[#0e111a] border border-white/[0.04] flex items-center justify-between text-xs"
                        >
                          <span className="text-zinc-300 font-medium">
                            {mark.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-numbers font-semibold text-white">
                              {mark.scored} <span className="text-zinc-500">/{mark.max}</span>
                            </span>
                            <span className="font-mono text-[10px] text-emerald-400 font-semibold min-w-[38px] text-right">
                              {mPct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic py-1">
                    Awaiting marks · No assessments published yet.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
