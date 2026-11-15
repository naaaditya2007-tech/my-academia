'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  TrendingUp,
  Award,
  FileText,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { AcademicCalendarDay, Course } from '@/types/campus';
import { formatRelativeTime } from '@/lib/attendance';
import { ActiveNavModule } from './SidebarNav';

interface RightTelemetryPanelProps {
  todayStr: string;
  todayDayOrder: number | null;
  isTodayHoliday: boolean;
  todayHolidayReason?: string;
  nextWorkingDayOrder: number;
  calendar: AcademicCalendarDay[];
  courses: Course[];
  lastSyncedAt: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onSelectDayOrder: (day: number) => void;
  selectedDayOrder: number | 'holiday';
  onOpenSyncModal: () => void;
  onOpenCalendarModal: () => void;
  onSelectModule?: (module: ActiveNavModule) => void;
}

export function RightTelemetryPanel({
  todayStr,
  todayDayOrder,
  isTodayHoliday,
  todayHolidayReason,
  nextWorkingDayOrder,
  calendar,
  courses,
  lastSyncedAt,
  isRefreshing,
  onRefresh,
  onSelectDayOrder,
  selectedDayOrder,
  onOpenSyncModal,
  onOpenCalendarModal,
  onSelectModule,
}: RightTelemetryPanelProps) {
  const [panelFilter, setPanelFilter] = useState<
    'all' | 'attendance' | 'timetable' | 'marks' | 'exams' | 'cgpa'
  >('all');

  const [relativeSyncedStr, setRelativeSyncedStr] = useState<string>('Updated recently');

  React.useEffect(() => {
    setRelativeSyncedStr(formatRelativeTime(lastSyncedAt));
    const interval = setInterval(() => {
      setRelativeSyncedStr(formatRelativeTime(lastSyncedAt));
    }, 30000);
    return () => clearInterval(interval);
  }, [lastSyncedAt]);

  // Overall attendance calculations
  const totalAttended = courses.reduce((acc, c) => acc + c.hoursAttended, 0);
  const totalConducted = courses.reduce((acc, c) => acc + c.hoursConducted, 0);
  const aggregatePct = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : 0;

  // Upcoming holidays / planner events
  const upcomingEvents = calendar
    .filter((c) => c.date >= todayStr && c.isHoliday && c.holidayReason)
    .slice(0, 3);

  // Registered courses total credits
  const totalCredits = courses.reduce((acc, c) => acc + c.credits, 0);

  // Lowest margin subject for quick attention
  const lowestCourse = [...courses].sort(
    (a, b) => a.attendancePercentage - b.attendancePercentage
  )[0];

  return (
    <aside className="w-80 shrink-0 bg-[var(--bg-surface)] border-l border-white/[0.06] p-4 space-y-3.5 hidden xl:flex flex-col h-screen sticky top-0 overflow-y-auto select-none">
      
      {/* 1. TOP STATUS CARD */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
        <div className="flex items-center justify-between mb-1.5 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 font-medium text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Live Status
          </span>
          <span className="font-mono text-[11px]">{todayStr}</span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div>
            <h4 className="text-base font-semibold tracking-tight text-white">
              {isTodayHoliday ? 'Holiday Break' : `Day Order ${todayDayOrder}`}
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              {isTodayHoliday
                ? todayHolidayReason || 'Weekend Break'
                : 'Regular Instruction Day'}
            </p>
          </div>

          <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white font-medium text-xs">
            {todayDayOrder ? `DO ${todayDayOrder}` : 'OFF'}
          </div>
        </div>

        {isTodayHoliday && (
          <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] text-xs text-zinc-400 flex items-center justify-between">
            <span>Next Working Day:</span>
            <span className="font-medium text-white">
              Mon · Day Order {nextWorkingDayOrder}
            </span>
          </div>
        )}
      </div>

      {/* 2. PANEL QUICK FILTER CHIPS */}
      <div className="flex-shrink-0 min-h-[44px] overflow-x-auto no-scrollbar py-2 flex items-center gap-1.5 border-y border-white/[0.04]">
        {[
          { id: 'all', label: 'All' },
          { id: 'attendance', label: 'Attendance' },
          { id: 'timetable', label: 'Timetable' },
          { id: 'marks', label: 'Marks' },
          { id: 'exams', label: 'Exams' },
          { id: 'cgpa', label: 'CGPA' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setPanelFilter(f.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${
              panelFilter === f.id
                ? 'bg-white/[0.12] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 3. ATTENDANCE MODULE */}
      {(panelFilter === 'all' || panelFilter === 'attendance') && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
              Attendance
            </span>
            <button
              onClick={() => onSelectModule?.('attendance')}
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-0.5"
            >
              Details <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold text-white">
                {aggregatePct.toFixed(1)}%
              </span>
              <span className="text-xs text-emerald-400 font-medium">Safe</span>
            </div>
            <span className="text-xs text-zinc-400">
              {totalAttended} / {totalConducted} hrs
            </span>
          </div>

          <div className="w-full bg-white/[0.06] h-1 rounded-full overflow-hidden relative">
            <div
              className="absolute top-0 bottom-0 w-[1.5px] bg-white/40 z-10"
              style={{ left: '75%' }}
              title="75% SRM Threshold"
            />
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, aggregatePct)}%`,
                background:
                  aggregatePct < 75
                    ? '#EF4444'
                    : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                boxShadow:
                  aggregatePct < 75
                    ? '0 0 10px rgba(239, 68, 68, 0.6)'
                    : '0 0 12px var(--accent-glow)',
              }}
            />
          </div>

          {lowestCourse && (
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <div className="truncate mr-2">
                <span className="text-zinc-400 block text-[10px]">Lowest Margin</span>
                <span className="font-medium text-white truncate block">
                  {lowestCourse.title}
                </span>
              </div>
              <span className="text-amber-400 font-medium text-xs shrink-0">
                {lowestCourse.attendancePercentage.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* 4. TIMETABLE & DAY ORDER MATRIX MODULE */}
      {(panelFilter === 'all' || panelFilter === 'timetable') && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              Day Orders
            </span>
            <button
              onClick={() => onSelectModule?.('timetable')}
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-0.5"
            >
              Full View <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {[1, 2, 3, 4, 5].map((d) => {
              const isSelected = selectedDayOrder === d;
              return (
                <button
                  key={d}
                  onClick={() => onSelectDayOrder(d)}
                  className={`py-1.5 rounded-lg text-center text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-white/[0.12] text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  DO {d}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-zinc-400 pt-1 flex items-center justify-between">
            <span>Next schedule:</span>
            <span className="text-white font-medium">Day Order 3 · 6 classes</span>
          </div>
        </div>
      )}

      {/* 5. MARKS & ACADEMIC PERFORMANCE MODULE */}
      {(panelFilter === 'all' || panelFilter === 'marks') && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-zinc-400" />
              Internal Marks
            </span>
            <button
              onClick={() => onSelectModule?.('marks')}
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-0.5"
            >
              Breakdown <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {(() => {
            const totalScored = courses.reduce((sum, c) => sum + (c.totalInternalScored || 0), 0);
            const totalMax = courses.reduce((sum, c) => sum + (c.totalInternalMax || 0), 0);
            const aggPct = totalMax > 0 ? (totalScored / totalMax) * 100 : 0;
            return (
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-lg font-semibold text-white">
                    {totalMax > 0 ? (
                      <>
                        {totalScored.toFixed(1)}{' '}
                        <span className="text-xs font-normal text-zinc-500">/ {totalMax.toFixed(0)}</span>
                      </>
                    ) : (
                      <span className="text-sm text-zinc-400">Pending Evaluation</span>
                    )}
                  </span>
                  <span className="text-xs text-zinc-400 block mt-0.5">
                    {totalMax > 0 ? `${aggPct.toFixed(1)}% Aggregate` : 'Internal marks updating'}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 block">Status</span>
                  <span className="text-xs font-semibold text-white">
                    {courses.length > 0 ? `${courses.length} Courses` : 'No courses'}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 6. EXAM TIMETABLE MODULE */}
      {(panelFilter === 'all' || panelFilter === 'exams') && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              Upcoming Exam
            </span>
            <button
              onClick={() => onSelectModule?.('exam_timetable')}
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-0.5"
            >
              Schedule <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
            {courses.length > 0 ? (
              <>
                <div className="min-w-0 flex-1 pr-2">
                  <span className="text-white font-medium block truncate">
                    {courses[0].code} · {courses[0].title}
                  </span>
                  <span className="text-[11px] text-zinc-400 block mt-0.5 font-mono">
                    Assessment schedule TBA
                  </span>
                </div>
                <span className="text-xs font-medium text-emerald-400 shrink-0">
                  Enrolled
                </span>
              </>
            ) : (
              <span className="text-zinc-500 text-xs">No active exam schedule</span>
            )}
          </div>
        </div>
      )}

      {/* 7. CGPA CALCULATOR PREVIEW */}
      {(panelFilter === 'all' || panelFilter === 'cgpa') && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-zinc-400" />
              CGPA Scale
            </span>
            <button
              onClick={() => onSelectModule?.('cgpa')}
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-0.5"
            >
              Simulate <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-zinc-400 block text-[10px]">Registered</span>
              <span className="text-xs font-medium text-white">
                {totalCredits} Credits
              </span>
            </div>
            <div className="text-right">
              <span className="text-zinc-400 block text-[10px]">Scale</span>
              <span className="text-xs font-medium text-white">
                10-Point System
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 8. ACADEMIC PLANNER & HOLIDAYS */}
      {(panelFilter === 'all') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              Academic Planner
            </span>
            <button
              onClick={onOpenCalendarModal}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              View all
            </button>
          </div>

          <div className="space-y-1">
            {upcomingEvents.map((event, i) => (
              <div
                key={i}
                className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs"
              >
                <div>
                  <span className="text-[10px] text-zinc-400 block font-mono">
                    {event.date} · {event.dayOfWeek}
                  </span>
                  <span className="font-medium text-zinc-200 mt-0.5 block truncate max-w-[150px]">
                    {event.holidayReason || 'Academic Event'}
                  </span>
                </div>
                <span className="text-[11px] text-amber-400 font-medium">
                  Holiday
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. SETTINGS & SYNC ACTIONS */}
      <div className="mt-auto pt-3 border-t border-white/[0.06] space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{relativeSyncedStr}</span>
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Portal Active
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-full py-1.5 px-2.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-zinc-300 hover:text-white transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onOpenSyncModal}
            className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.08] border border-white/10 hover:bg-white/[0.12] text-white transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Connect</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
