'use client';

import React from 'react';
import { FileText, Calendar, Clock, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';

export interface ExamRecord {
  semester: string;
  code: string;
  title: string;
  dateSession: string;
  hallNo: string;
  seatNo: string;
}

export const AUTHENTIC_EXAMS: ExamRecord[] = [
  {
    semester: 'III',
    code: '21MAB201T',
    title: 'TRANSFORMS AND BOUNDARY VALUE PROBLEMS',
    dateSession: '25-NOV-2026 AN (02:00-05:00)',
    hallNo: 'TBA',
    seatNo: 'TBA',
  },
  {
    semester: 'III',
    code: '21CSS201T',
    title: 'COMPUTER ORGANIZATION AND ARCHITECTURE',
    dateSession: '26-NOV-2026 AN (02:00-05:00)',
    hallNo: 'TBA',
    seatNo: 'TBA',
  },
  {
    semester: 'III',
    code: '21CSC201J',
    title: 'DATA STRUCTURES AND ALGORITHMS',
    dateSession: '27-NOV-2026 AN (02:00-05:00)',
    hallNo: 'TBA',
    seatNo: 'TBA',
  },
  {
    semester: 'III',
    code: '21CSC202J',
    title: 'OPERATING SYSTEMS',
    dateSession: '30-NOV-2026 AN (02:00-05:00)',
    hallNo: 'TBA',
    seatNo: 'TBA',
  },
  {
    semester: 'III',
    code: '21LEM201T',
    title: 'PROFESSIONAL ETHICS',
    dateSession: 'TBA',
    hallNo: 'TBA',
    seatNo: 'TBA',
  },
  {
    semester: 'III',
    code: '21CSC203P',
    title: 'ADVANCED PROGRAMMING PRACTICE',
    dateSession: 'TBA',
    hallNo: 'TBA',
    seatNo: 'TBA',
  },
  {
    semester: 'III',
    code: '21LEM202T',
    title: 'UNIVERSAL HUMAN VALUES - II',
    dateSession: 'TBA',
    hallNo: 'TBA',
    seatNo: 'TBA',
  },
];

export function ExamTimetable() {
  return (
    <div className="space-y-4">
      {/* Header telemetry summary */}
      <div className="hw-card rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs uppercase font-mono tracking-wider text-zinc-400">
              Odd Semester End Examination Timetable
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            November 2026 Assessment Schedule
          </h2>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">
            7 registered exams · 4 announced dates · 3 practical/evaluations TBA
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
            First Exam: Nov 25, 2026
          </span>
        </div>
      </div>

      {/* Exam Table */}
      <div className="hw-card rounded-2xl p-4 sm:p-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] text-zinc-400 font-mono uppercase text-[11px]">
                <th className="pb-3 font-medium">Sem</th>
                <th className="pb-3 font-medium">Subject Code</th>
                <th className="pb-3 font-medium">Course Description</th>
                <th className="pb-3 font-medium">Date & Session</th>
                <th className="pb-3 font-medium">Hall No.</th>
                <th className="pb-3 font-medium">Seat No.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {AUTHENTIC_EXAMS.map((exam, idx) => {
                const isScheduled = exam.dateSession !== 'TBA';
                return (
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
                      {isScheduled ? (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
                          {exam.dateSession}
                        </span>
                      ) : (
                        <span className="text-zinc-500">To be announced</span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-zinc-400">{exam.hallNo}</td>
                    <td className="py-3 font-mono text-zinc-400">{exam.seatNo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
