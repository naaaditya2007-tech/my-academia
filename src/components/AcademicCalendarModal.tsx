'use client';

import React from 'react';
import { AcademicCalendarDay, Course } from '@/types/campus';
import { X, Calendar as CalendarIcon } from 'lucide-react';
import { AcademicPlannerView } from './AcademicPlannerView';

interface AcademicCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendar: AcademicCalendarDay[];
  courses?: Course[];
  todayStr?: string;
}

export function AcademicCalendarModal({
  isOpen,
  onClose,
  calendar,
  courses = [],
  todayStr = '2026-11-14',
}: AcademicCalendarModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="hw-card rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-white/10 bg-[#0B0E17]">
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white">
              <CalendarIcon className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white tracking-tight">
                Academic Planner & Day Order Matrix
              </h3>
              <p className="text-xs text-zinc-400">
                Official Campus Web Odd Semester Calendar (July - November 2026)
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

        {/* Modal Body: 7-Column Campus Web Month Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <AcademicPlannerView
            calendar={calendar}
            courses={courses}
            todayStr={todayStr}
          />
        </div>
      </div>
    </div>
  );
}
