'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { ScheduledClass, StudentProfile } from '@/types/campus';
import { formatTime12h, formatRelativeTime } from '@/lib/attendance';

interface HeaderTelemetryProps {
  student?: StudentProfile | null;
  dayOrder: number | null;
  isHoliday: boolean;
  holidayReason?: string;
  nextWorkingDayOrder?: number;
  nextWorkingStartTime?: string;
  timeline: ScheduledClass[];
  lastSyncedAt: string;
  dataSource?: 'live_student_portal' | 'demo';
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenSyncModal: () => void;
  onOpenVerificationModal?: () => void;
  activeModule?: string;
}

export function HeaderTelemetry({
  student,
  dayOrder,
  isHoliday,
  holidayReason,
  nextWorkingDayOrder = 3,
  nextWorkingStartTime = '08:00',
  timeline,
  lastSyncedAt,
  onRefresh,
  isRefreshing,
  onOpenVerificationModal,
  activeModule = 'dashboard',
}: HeaderTelemetryProps) {
  const [relativeSyncedStr, setRelativeSyncedStr] = useState<string>('Updated recently');

  const liveClass =
    !isHoliday && dayOrder !== null
      ? timeline.find((t) => t.status === 'live' && t.course)
      : undefined;
  const nextClass =
    !isHoliday && dayOrder !== null
      ? timeline.find((t) => t.status === 'upcoming' && t.course)
      : undefined;

  useEffect(() => {
    const updateTimer = () => {
      setRelativeSyncedStr(formatRelativeTime(lastSyncedAt));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 10000);
    return () => clearInterval(interval);
  }, [lastSyncedAt]);

  const registeredClasses = timeline.filter((t) => t.course);
  const lastClass = registeredClasses[registeredClasses.length - 1];

  let statusCopy = '';
  if (isHoliday || dayOrder === null) {
    const holidayTitle = holidayReason ? `(${holidayReason})` : '(Weekend Break)';
    const nextStart12h = formatTime12h(nextWorkingStartTime);
    statusCopy = `No classes today ${holidayTitle} · Next is Day Order ${nextWorkingDayOrder} on Monday (${nextStart12h} start)`;
  } else if (liveClass && liveClass.course) {
    statusCopy = `LIVE: ${liveClass.course.title} in ${liveClass.course.room}`;
  } else if (nextClass && nextClass.course) {
    statusCopy = `Next: ${nextClass.course.title} at ${formatTime12h(nextClass.startTime)} (${nextClass.course.room})`;
  } else {
    const wrapUpTime = lastClass ? formatTime12h(lastClass.endTime) : '4:05 PM';
    statusCopy = `Day Order ${dayOrder} · All classes completed (wrapped up at ${wrapUpTime})`;
  }

  // Friendly title for mobile header matching Campus Web
  const getModuleTitle = (mod: string) => {
    switch (mod) {
      case 'attendance':
        return 'Attendance';
      case 'marks':
        return 'Results';
      case 'timetable':
        return 'Schedule';
      case 'appearance':
        return 'Theme';
      case 'planner':
        return 'Academic Planner';
      case 'exam_timetable':
        return 'Exam Timetable';
      case 'cgpa':
        return 'CGPA Calculator';
      case 'admin':
        return 'Admin Console';
      case 'dashboard':
      default:
        return 'MyAcademia';
    }
  };

  return (
    <header className="w-full border-b border-white/[0.06] bg-transparent backdrop-blur-md sticky top-0 z-40 select-none">
      {/* MOBILE NATIVE HEADER (MATCHING CAMPUS WEB 1:1) */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white leading-none">
            {getModuleTitle(activeModule)}
          </h1>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {student?.name ? `${student.name} · ${student.regNumber || 'SRMIST'}` : 'SRMIST KTR · Live Portal'}
          </span>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 disabled:opacity-50"
          aria-label="Refresh Data"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[var(--accent-primary)]' : ''}`}
          />
        </button>
      </div>

      {/* DESKTOP HEADER BAR */}
      <div className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-4">
          {/* Status ticker */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] max-w-full truncate">
              {liveClass ? (
                <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[10px] font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-ping" />
                  LIVE NOW
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              )}
              <span className="text-xs text-zinc-300 truncate">{statusCopy}</span>
            </div>
          </div>

          {/* Desktop Right actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {student?.name && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium font-mono bg-sky-500/10 text-sky-400 border-sky-500/30"
                title={`${student.name} · ${student.regNumber || ''}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                <span className="truncate max-w-[140px]">{student.name}</span>
                {student.regNumber && (
                  <span className="text-zinc-400 font-mono text-[10px]">· {student.regNumber}</span>
                )}
              </div>
            )}

            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              title="Verified live portal connection"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span>Live SRM Session</span>
            </div>

            <span className="text-xs text-zinc-400 font-mono">
              {relativeSyncedStr}
            </span>

            {onOpenVerificationModal && (
              <button
                onClick={onOpenVerificationModal}
                className="py-1 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center gap-1.5 text-xs font-medium"
              >
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                <span>Audit Data</span>
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="py-1 px-2.5 rounded-lg bg-[var(--accent-tint)] border border-[var(--accent-border)] text-white hover:brightness-110 transition-all flex items-center gap-1.5 text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
