'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, ShieldCheck, Search } from 'lucide-react';
import { ScheduledClass } from '@/types/campus';
import { formatTime12h, formatRelativeTime } from '@/lib/attendance';

interface HeaderTelemetryProps {
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
}

export function HeaderTelemetry({
  dayOrder,
  isHoliday,
  holidayReason,
  nextWorkingDayOrder = 3,
  nextWorkingStartTime = '08:00',
  timeline,
  lastSyncedAt,
  dataSource = 'demo',
  onRefresh,
  isRefreshing,
  onOpenSyncModal,
  onOpenVerificationModal,
}: HeaderTelemetryProps) {
  const [relativeSyncedStr, setRelativeSyncedStr] = useState<string>('Updated recently');
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Find active live class only when today is an active working day
  const liveClass =
    !isHoliday && dayOrder !== null
      ? timeline.find((t) => t.status === 'live' && t.course)
      : undefined;
  const nextClass =
    !isHoliday && dayOrder !== null
      ? timeline.find((t) => t.status === 'upcoming' && t.course)
      : undefined;

  const activeTarget = liveClass || nextClass;

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      setRelativeSyncedStr(formatRelativeTime(lastSyncedAt));

      if (activeTarget) {
        const targetTimeStr = liveClass ? activeTarget.endTime : activeTarget.startTime;
        const [targetH, targetM] = targetTimeStr.split(':').map(Number);
        const targetDate = new Date();
        targetDate.setHours(targetH, targetM, 0, 0);

        const diffSec = Math.floor((targetDate.getTime() - now.getTime()) / 1000);
        setSecondsRemaining(diffSec > 0 ? diffSec : 0);
      } else {
        setSecondsRemaining(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeTarget, liveClass, lastSyncedAt]);

  const formatCountdown = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) {
      return `${hours}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Compute natural banner status
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

  return (
    <header className="w-full border-b border-white/[0.06] bg-[var(--bg-canvas)]/90 backdrop-blur-md sticky top-0 z-40 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-4">
          
          {/* LEFT: Current status pill with live indicator */}
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

              <span className="text-xs text-zinc-300 truncate">
                {statusCopy}
              </span>

              {secondsRemaining !== null && secondsRemaining > 0 && (
                <span className="text-xs text-[var(--accent-primary)] pl-2 border-l border-white/10 shrink-0 font-medium">
                  {formatCountdown(secondsRemaining)}
                </span>
              )}
            </div>
          </div>

          {/* RIGHT: Sync status, data source badge and action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Verified Portal Live Handshake Badge */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              title="Authenticated live handshake with SRM Student Portal (sp.srmist.edu.in)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span>Live SRM Session (Verified)</span>
            </div>

            <span className="text-xs text-zinc-400 hidden xl:inline-block">
              {relativeSyncedStr}
            </span>

            {/* Verify Raw Data Button */}
            {onOpenVerificationModal && (
              <button
                onClick={onOpenVerificationModal}
                className="py-1 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Audit raw portal JSON vs computed calculations"
              >
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Verify Raw Data</span>
                <span className="sm:hidden">Verify</span>
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="py-1 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Refresh portal data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[var(--accent-primary)]' : ''}`} />
              <span>Sync</span>
            </button>

            <button
              onClick={onOpenSyncModal}
              className="py-1 px-2.5 rounded-lg bg-white/[0.08] border border-white/10 text-white hover:bg-white/[0.12] transition-colors text-xs font-medium flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Connect Portal</span>
              <span className="sm:hidden">Connect</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
