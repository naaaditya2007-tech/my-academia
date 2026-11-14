'use client';

import React, { useState } from 'react';
import { AcademicCalendarDay } from '@/types/campus';
import { X, Calendar, Flag, Sparkles, Filter, CheckCircle2 } from 'lucide-react';

interface AcademicCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendar: AcademicCalendarDay[];
  todayStr?: string;
}

export function AcademicCalendarModal({
  isOpen,
  onClose,
  calendar,
  todayStr = '2026-11-14',
}: AcademicCalendarModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('November 2026');

  if (!isOpen) return null;

  // Strict Semester Cutoff: Only display until last semester exam date (November 30, 2026)
  const validCalendar = calendar.filter((c) => c.date <= '2026-11-30');

  // Extract unique months
  const months = Array.from(new Set(validCalendar.map((c) => c.month).filter(Boolean))) as string[];

  const filteredDays = selectedMonth === 'ALL'
    ? validCalendar
    : validCalendar.filter((c) => c.month === selectedMonth);

  const totalWorkingDays = filteredDays.filter((d) => !d.isHoliday && d.dayOrder !== null).length;
  const totalHolidays = filteredDays.filter((d) => d.isHoliday || d.dayOrder === null).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="hw-card rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/10">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white tracking-tight">
                Academic Planner & Day Order Matrix
              </h3>
              <p className="text-xs text-zinc-400 font-mono">
                SRMIST Odd Semester Calendar (Campus Web Reference)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Month Selector Pills & Telemetry Summary */}
        <div className="px-4 sm:px-6 py-3 border-b border-white/[0.06] bg-[#0d0f17] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {months.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                  selectedMonth === m
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'bg-[#141724] text-zinc-400 hover:text-zinc-200 border border-white/[0.06]'
                }`}
              >
                {m}
              </button>
            ))}
            <button
              onClick={() => setSelectedMonth('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                selectedMonth === 'ALL'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-[#141724] text-zinc-400 hover:text-zinc-200 border border-white/[0.06]'
              }`}
            >
              All Semester
            </button>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-zinc-400 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <strong className="text-zinc-200">{totalWorkingDays}</strong> Working Days
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <strong className="text-zinc-200">{totalHolidays}</strong> Holidays
            </span>
          </div>
        </div>

        {/* Calendar Day Order Table */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-zinc-400 font-mono uppercase text-[11px]">
                  <th className="pb-2.5 font-medium">Date</th>
                  <th className="pb-2.5 font-medium">Day</th>
                  <th className="pb-2.5 font-medium">Day Order</th>
                  <th className="pb-2.5 font-medium">Working Day #</th>
                  <th className="pb-2.5 font-medium">Status / Academic Event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredDays.map((item, idx) => {
                  const isToday = item.date === todayStr;
                  const isHoliday = item.isHoliday || item.dayOrder === null;

                  return (
                    <tr
                      key={idx}
                      className={`transition-colors ${
                        isToday
                          ? 'bg-emerald-500/10 font-medium'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Date */}
                      <td className="py-2.5 font-mono-numbers text-zinc-200 flex items-center gap-2">
                        <span>{item.date}</span>
                        {isToday && (
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                            Today
                          </span>
                        )}
                      </td>

                      {/* Day of Week */}
                      <td className="py-2.5 text-zinc-300">
                        {item.dayOfWeek || '-'}
                      </td>

                      {/* Day Order Badge */}
                      <td className="py-2.5">
                        {isHoliday ? (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 text-[10px] font-mono font-semibold">
                            -
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                            DO {item.dayOrder}
                          </span>
                        )}
                      </td>

                      {/* Working Day Count */}
                      <td className="py-2.5 font-mono text-zinc-400">
                        {item.workingDayNumber ? `Day ${item.workingDayNumber}` : '-'}
                      </td>

                      {/* Status / Holiday Reason */}
                      <td className="py-2.5">
                        {isHoliday ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-medium">
                            <Flag className="w-3 h-3" />
                            {item.holidayReason || 'Holiday'}
                          </span>
                        ) : (
                          <span className="text-zinc-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Instructional Day
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] bg-[#0d0f17] flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-mono">
            Synced from SRMIST Official Academic Calendar
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold text-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
