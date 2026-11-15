'use client';

import React, { useState, useMemo } from 'react';
import { AcademicCalendarDay, Course } from '@/types/campus';
import { SRM_AUTHENTIC_DAY_ORDER_MATRIX, buildDayTimeline } from '@/lib/timetable';
import { ExamRecord } from '@/components/ExamTimetable';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  X,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface AcademicPlannerViewProps {
  calendar: AcademicCalendarDay[];
  courses: Course[];
  todayStr?: string;
}

export function AcademicPlannerView({
  calendar,
  courses,
  todayStr = '2026-11-14',
}: AcademicPlannerViewProps) {
  // Available semester months capping at November 2026 (final exam window)
  const availableMonths = [
    'July 2026',
    'August 2026',
    'September 2026',
    'October 2026',
    'November 2026',
  ];

  // Always default to current month: November 2026
  const [selectedMonth, setSelectedMonth] = useState<string>('November 2026');
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(todayStr);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const currentMonthIndex = availableMonths.indexOf(selectedMonth);

  const handlePrevMonth = () => {
    if (currentMonthIndex > 0) {
      setSelectedMonth(availableMonths[currentMonthIndex - 1]);
    }
  };

  const handleNextMonth = () => {
    // Hard cutoff: Cannot navigate past November 2026 (final semester exam month)
    if (currentMonthIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentMonthIndex + 1]);
    }
  };

  const handleGoToToday = () => {
    setSelectedMonth('November 2026');
    setSelectedDayDate(todayStr);
    setIsDrawerOpen(true);
  };

  // Filter calendar days for the selected month
  const monthDays = useMemo(() => {
    return calendar.filter((d) => d.month === selectedMonth);
  }, [calendar, selectedMonth]);

  // Compute month KPIs
  const { workingDaysLeft, totalWorkingDays, holidaysCount, nextMilestone } = useMemo(() => {
    const workingDays = monthDays.filter((d) => d.dayOrder !== null);
    const leftCount = workingDays.filter((d) => d.date >= todayStr).length;
    
    // Official non-weekend holidays in this month
    const officialHolidays = monthDays.filter(
      (d) => d.isHoliday && d.holidayReason && !['Saturday', 'Sunday', 'Weekend'].includes(d.holidayReason)
    );

    // Look for next major milestone (Last Working Day or upcoming Exam)
    let milestone = 'Last Working Day - B. Tech - II,III,IV ... · Fri, 20 Nov';
    if (todayStr > '2026-11-20') {
      milestone = 'Semester Final Examinations Window · Nov 25 - 30';
    }

    return {
      workingDaysLeft: leftCount,
      totalWorkingDays: workingDays.length,
      holidaysCount: officialHolidays.length,
      nextMilestone: milestone,
    };
  }, [monthDays, todayStr]);

  // Compute leading empty slots for 7-column grid (Monday to Sunday)
  const leadingBlanks = useMemo(() => {
    if (monthDays.length === 0) return 0;
    const firstDateStr = monthDays[0].date;
    const [y, m, d] = firstDateStr.split('-').map(Number);
    const firstDay = new Date(y, m - 1, d).getDay(); // 0 is Sun, 1 is Mon...
    // Monday is index 0, Sunday is index 6
    return (firstDay + 6) % 7;
  }, [monthDays]);

  // Exam lookup helper for dates derived dynamically from courses
  const getExamForDate = (dateStr: string): ExamRecord | null => {
    if (!courses || courses.length === 0) return null;
    const dayNum = dateStr.split('-')[2];
    if (dateStr.startsWith('2026-11-') && ['25', '26', '27', '30'].includes(dayNum)) {
      const idx = ['25', '26', '27', '30'].indexOf(dayNum);
      const course = courses[idx % courses.length];
      if (course) {
        return {
          semester: 'Active',
          code: course.code,
          title: course.title,
          dateSession: `${dayNum}-NOV-2026 (FN)`,
          hallNo: course.room || 'TBA',
          seatNo: 'TBA',
        };
      }
    }
    return null;
  };

  // Details of the selected day for drawer
  const selectedDayEntry = useMemo(() => {
    if (!selectedDayDate) return null;
    return calendar.find((d) => d.date === selectedDayDate) || null;
  }, [calendar, selectedDayDate]);

  const selectedDayClasses = useMemo(() => {
    if (!selectedDayEntry || !selectedDayEntry.dayOrder) return [];
    return buildDayTimeline(selectedDayEntry.dayOrder, courses);
  }, [selectedDayEntry, courses]);

  const selectedDayExam = useMemo(() => {
    if (!selectedDayDate) return null;
    return getExamForDate(selectedDayDate);
  }, [selectedDayDate]);

  // Format 24h to 12h time string
  const formatTimeSlot = (time24: string) => {
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const handleCellClick = (day: AcademicCalendarDay) => {
    setSelectedDayDate(day.date);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      {/* ======================================================== */}
      {/* 1. HEADER & MONTH SWITCHER                               */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevMonth}
            disabled={currentMonthIndex === 0}
            className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-all"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white min-w-[170px]">
            {selectedMonth}
          </h2>

          <button
            onClick={handleNextMonth}
            disabled={currentMonthIndex === availableMonths.length - 1}
            className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-all"
            aria-label="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={handleGoToToday}
            className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition-all ml-1 shadow-sm"
          >
            Today
          </button>
        </div>

        <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
          <CalendarIcon className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>SRMIST Odd Semester Academic Calendar 2026</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. 3-CARD KPI STRIP (MATCHING CAMPUS WEB REFERENCE)       */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-stretch gap-3">
        {/* Card 1: Class Days */}
        <div className="min-w-[150px] flex-1 sm:flex-initial p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] flex flex-col justify-between">
          <span className="text-[11px] font-medium text-zinc-400 block mb-1">
            Class days
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {workingDaysLeft}
            </span>
            <span className="text-xs text-zinc-400">left of {totalWorkingDays}</span>
          </div>
        </div>

        {/* Card 2: Holidays */}
        <div className="min-w-[130px] flex-1 sm:flex-initial p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] flex flex-col justify-between">
          <span className="text-[11px] font-medium text-zinc-400 block mb-1">
            Holidays
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {holidaysCount}
            </span>
            <span className="text-xs text-zinc-400">official</span>
          </div>
        </div>

        {/* Card 3: Next Up Milestone */}
        <div className="flex-[2] min-w-[260px] p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] flex flex-col justify-between">
          <span className="text-[11px] font-medium text-zinc-400 block mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>Next up</span>
          </span>
          <div className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate">
            {nextMilestone}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. LEGEND & HELPER BAR                                   */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1 text-xs text-zinc-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            <span className="text-zinc-300">Today</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-2.5 rounded border border-white/20 bg-white/5 relative overflow-hidden"
              style={{
                background: 'repeating-linear-gradient(-45deg, rgba(255,255,255,0.2), rgba(255,255,255,0.2) 2px, transparent 2px, transparent 4px)',
              }}
            />
            <span className="text-zinc-300">Holiday</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-zinc-300">Event / Exam</span>
          </span>
        </div>

        <span className="text-[11px] text-zinc-400 hidden sm:inline">
          Tap a class day to open its timetable
        </span>
      </div>

      {/* ======================================================== */}
      {/* 4. 7-COLUMN MONTH GRID (MON TO SUN)                      */}
      {/* ======================================================== */}
      <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-[#0B0E17] shadow-2xl">
        {/* Day-of-Week Header */}
        <div className="grid grid-cols-7 bg-white/[0.04] border-b border-white/[0.08]">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName) => (
            <div
              key={dayName}
              className="py-2.5 px-2 sm:px-3 text-[11px] sm:text-xs font-semibold text-zinc-300 text-center sm:text-left"
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-white/[0.06]">
          {/* Leading blank slots */}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div
              key={`blank-${i}`}
              className="min-h-[72px] sm:min-h-[105px] bg-black/30 border-b border-white/[0.04] opacity-30 pointer-events-none"
            />
          ))}

          {/* Month Days */}
          {monthDays.map((day) => {
            const dateNumber = parseInt(day.date.split('-')[2], 10);
            const isToday = day.date === todayStr;
            const isPast = day.date < todayStr;
            const isSelected = selectedDayDate === day.date;
            const examRecord = getExamForDate(day.date);
            const isLastWorkingDay = day.date === '2026-11-20';

            // Timetable summary for working days
            const dayOrderSlots = day.dayOrder
              ? SRM_AUTHENTIC_DAY_ORDER_MATRIX[day.dayOrder] || []
              : [];
            const classCount = dayOrderSlots.length;
            const firstClassStart = dayOrderSlots[0]?.startTime
              ? formatTimeSlot(dayOrderSlots[0].startTime)
              : null;

            return (
              <div
                key={day.date}
                onClick={() => handleCellClick(day)}
                className={`min-h-[72px] sm:min-h-[105px] p-2 sm:p-2.5 flex flex-col justify-between transition-all relative group cursor-pointer ${
                  isToday
                    ? 'bg-[var(--accent-tint,rgba(59,130,246,0.12))] ring-2 ring-inset ring-[var(--accent-primary)] shadow-[inset_0_0_20px_rgba(59,130,246,0.15)] z-10'
                    : isSelected
                    ? 'bg-white/[0.07] ring-1 ring-inset ring-white/30 z-10'
                    : day.isHoliday
                    ? 'hover:bg-white/[0.02]'
                    : 'hover:bg-white/[0.04]'
                }`}
                style={
                  day.isHoliday && !isToday && !examRecord
                    ? {
                        background:
                          'repeating-linear-gradient(-45deg, rgba(255,255,255,0.015), rgba(255,255,255,0.015) 6px, transparent 6px, transparent 12px)',
                      }
                    : undefined
                }
              >
                {/* Cell Top Row */}
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-xs sm:text-sm font-semibold ${
                      isToday
                        ? 'text-[var(--accent-primary)] font-bold'
                        : isPast
                        ? 'text-zinc-500'
                        : 'text-white'
                    }`}
                  >
                    {dateNumber}
                  </span>

                  {/* Day Order Badge (if working day) */}
                  {day.dayOrder && (
                    <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[9px] sm:text-[10px] font-medium text-zinc-300 group-hover:bg-white/[0.12] transition-colors">
                      <span className="hidden sm:inline">Day </span>
                      <span className="sm:hidden">D</span>
                      {day.dayOrder}
                    </span>
                  )}

                  {/* Exam Tag */}
                  {examRecord && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-semibold">
                      Exam
                    </span>
                  )}
                </div>

                {/* Cell Bottom Row / Content */}
                <div className="mt-1">
                  {/* Working Day Summary */}
                  {day.dayOrder && classCount > 0 && (
                    <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate font-sans">
                      <span className="font-medium text-zinc-300">{classCount}</span>
                      <span className="hidden sm:inline"> classes</span>
                      {firstClassStart && (
                        <span className="hidden md:inline"> · {firstClassStart}</span>
                      )}
                    </div>
                  )}

                  {/* Milestone: Last Working Day */}
                  {isLastWorkingDay && (
                    <div className="text-[9px] sm:text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1 py-0.5 rounded mt-0.5 truncate">
                      Last Working Day
                    </div>
                  )}

                  {/* Scheduled Semester Exam */}
                  {examRecord && (
                    <div className="text-[9px] sm:text-[10px] font-semibold text-amber-300 truncate">
                      {examRecord.code}
                    </div>
                  )}

                  {/* Holiday Reason */}
                  {day.isHoliday && !examRecord && !isLastWorkingDay && day.holidayReason && (
                    <div className="text-[9px] sm:text-[10px] text-zinc-500 truncate">
                      {['Saturday', 'Sunday'].includes(day.holidayReason)
                        ? ''
                        : day.holidayReason}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. SLIDE-OVER DRAWER / TIMETABLE INSPECTOR               */}
      {/* ======================================================== */}
      {isDrawerOpen && selectedDayEntry && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0E121D] p-5 sm:p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between pb-4 border-b border-white/[0.08] mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                  {selectedDayEntry.dayOfWeek}
                </span>
                {selectedDayEntry.dayOrder ? (
                  <span className="px-2 py-0.5 rounded bg-[var(--accent-tint)] border border-[var(--accent-border)] text-[var(--accent-primary)] font-bold text-xs font-mono">
                    Day Order {selectedDayEntry.dayOrder}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-white/[0.08] text-zinc-400 text-xs font-mono">
                    {selectedDayEntry.holidayReason || 'Non-Instructional Day'}
                  </span>
                )}
                {selectedDayEntry.date === todayStr && (
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold">
                    Today
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Schedule for {selectedDayEntry.date}
              </h3>
            </div>

            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Exam Details (if date has exam) */}
          {selectedDayExam && (
            <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
              <FileText className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block">
                  Semester Examination Scheduled
                </span>
                <h4 className="text-sm font-bold text-white mt-0.5">
                  {selectedDayExam.code} · {selectedDayExam.title}
                </h4>
                <p className="text-xs text-zinc-300 mt-1 font-mono">
                  {selectedDayExam.dateSession} · Hall: {selectedDayExam.hallNo}
                </p>
              </div>
            </div>
          )}

          {/* Working Day Class Schedule List */}
          {selectedDayClasses.length > 0 ? (
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-zinc-300 block mb-2">
                Classes ({selectedDayClasses.length} Scheduled):
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedDayClasses.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-white/20 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-mono">
                        <span className="flex items-center gap-1.5 text-zinc-200">
                          <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                          <span>
                            {item.startTime} - {item.endTime}
                          </span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 font-sans">
                          {item.course?.type || 'Theory'}
                        </span>
                      </div>

                      <h5 className="text-sm font-semibold text-white tracking-tight leading-snug">
                        {item.course?.code} · {item.course?.title}
                      </h5>

                      <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-zinc-500" />
                          <span>{item.course?.room || 'Venue TBA'}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 truncate">
                          <User className="w-3 h-3 text-zinc-500" />
                          <span className="truncate">{item.course?.faculty || 'Faculty TBA'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">Attendance:</span>
                      <span
                        className={`font-semibold font-mono ${
                          (item.course?.attendancePercentage ?? 0) >= 75
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {(item.course?.attendancePercentage ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !selectedDayExam ? (
            <div className="p-8 text-center text-zinc-400 text-xs">
              <CalendarIcon className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
              <span>No classes scheduled for this date ({selectedDayEntry.holidayReason || 'Weekend'}).</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
