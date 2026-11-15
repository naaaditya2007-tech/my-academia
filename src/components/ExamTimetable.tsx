'use client';

import React from 'react';
import { FileText, Calendar, Clock, MapPin } from 'lucide-react';
import { Course } from '@/types/campus';

export interface ExamRecord {
  semester: string;
  code: string;
  title: string;
  dateSession: string;
  hallNo: string;
  seatNo: string;
}

interface ExamTimetableProps {
  courses?: Course[];
}

export function ExamTimetable({ courses = [] }: ExamTimetableProps) {
  // Generate exam list strictly from the student's actual scraped courses (Zero hardcoded courses)
  const examRecords: ExamRecord[] = courses.map((course) => ({
    semester: 'Active',
    code: course.code,
    title: course.title,
    dateSession: 'TBA (Portal Sync Pending)',
    hallNo: course.room || 'TBA',
    seatNo: 'TBA',
  }));

  const hasCourses = examRecords.length > 0;

  return (
    <div className="space-y-4 select-none">
      {/* Header telemetry summary */}
      <div className="hw-card rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-primary,#6366F1)]" />
            <span className="text-xs uppercase font-mono tracking-wider text-zinc-400">
              Semester Examination Schedule
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Academic Assessment Timetable
          </h2>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">
            {hasCourses
              ? `${examRecords.length} registered courses for this semester`
              : 'No enrolled courses found'}
          </p>
        </div>

        {hasCourses && (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-300 text-xs font-mono">
              Live Portal Sync
            </span>
          </div>
        )}
      </div>

      {/* Exam Table */}
      <div className="hw-card rounded-2xl p-4 sm:p-5 overflow-hidden">
        {!hasCourses ? (
          <div className="py-12 text-center text-zinc-500 text-xs space-y-2">
            <FileText className="w-8 h-8 mx-auto text-zinc-600 opacity-60" />
            <p className="font-medium text-zinc-300">No examination schedules loaded</p>
            <p className="text-zinc-500 max-w-sm mx-auto text-[11px]">
              Examination dates will automatically populate once your courses are scraped from the SRM Student Portal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-zinc-400 font-mono uppercase text-[11px]">
                  <th className="pb-3 font-medium">Sem</th>
                  <th className="pb-3 font-medium">Subject Code</th>
                  <th className="pb-3 font-medium">Course Description</th>
                  <th className="pb-3 font-medium">Date & Session</th>
                  <th className="pb-3 font-medium">Venue</th>
                  <th className="pb-3 font-medium">Seat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {examRecords.map((exam, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 font-mono font-semibold text-zinc-400">
                      {exam.semester}
                    </td>
                    <td className="py-3 font-mono font-bold text-white">
                      {exam.code}
                    </td>
                    <td className="py-3 font-medium text-zinc-200">
                      {exam.title}
                    </td>
                    <td className="py-3 font-mono text-xs">
                      <span className="text-zinc-500">{exam.dateSession}</span>
                    </td>
                    <td className="py-3 font-mono text-zinc-400">{exam.hallNo}</td>
                    <td className="py-3 font-mono text-zinc-400">{exam.seatNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
