'use client';

import React, { useState } from 'react';
import { Course } from '@/types/campus';
import { GraduationCap, Plus, Trash2, RotateCcw, Calculator, Sparkles } from 'lucide-react';

interface CourseGradeItem {
  id: string;
  name: string;
  code: string;
  credits: number;
  grade: 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'F';
}

const GRADE_POINTS: Record<string, number> = {
  O: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  F: 0,
};

interface CgpaCalculatorProps {
  courses: Course[];
}

export function CgpaCalculator({ courses }: CgpaCalculatorProps) {
  // Initialize with student's actual registered courses
  const initialSubjects: CourseGradeItem[] = courses.map((c, i) => {
    let defaultGrade: 'O' | 'A+' | 'A' | 'B+' | 'B' = 'A+';
    if (c.code === '21LEM201T') defaultGrade = 'O';
    if (c.code === '21LEM202T') defaultGrade = 'O';
    if (c.code === '21CSC203P') defaultGrade = 'A+';
    if (c.code === '21MAB201T') defaultGrade = 'A+';
    return {
      id: `course_${c.code}_${i}`,
      name: c.title,
      code: c.code,
      credits: c.credits || 4,
      grade: defaultGrade,
    };
  });

  const [subjects, setSubjects] = useState<CourseGradeItem[]>(initialSubjects);
  const [priorCgpa, setPriorCgpa] = useState<string>('9.12');
  const [priorCredits, setPriorCredits] = useState<string>('44');

  const updateGrade = (id: string, grade: 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'F') => {
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, grade } : s)));
  };

  const updateCredits = (id: string, credits: number) => {
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, credits } : s)));
  };

  const removeSubject = (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  const addSubject = () => {
    setSubjects((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        name: 'New Elective / Subject',
        code: 'ELECTIVE',
        credits: 3,
        grade: 'O',
      },
    ]);
  };

  const resetToDefault = () => {
    setSubjects(initialSubjects);
  };

  // SGPA Calculation
  const totalSemesterCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
  const totalWeightedPoints = subjects.reduce(
    (sum, s) => sum + s.credits * (GRADE_POINTS[s.grade] || 0),
    0
  );
  const projectedSgpa =
    totalSemesterCredits > 0 ? totalWeightedPoints / totalSemesterCredits : 0;

  // Cumulative CGPA Calculation
  const pCgpaNum = parseFloat(priorCgpa) || 0;
  const pCredNum = parseFloat(priorCredits) || 0;
  const combinedTotalCredits = pCredNum + totalSemesterCredits;
  const combinedWeightedPoints = pCgpaNum * pCredNum + totalWeightedPoints;
  const projectedCgpa =
    combinedTotalCredits > 0 ? combinedWeightedPoints / combinedTotalCredits : 0;

  return (
    <div className="space-y-6">
      
      {/* Top Telemetry Marquee Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Projected SGPA */}
        <div className="hw-card rounded-2xl p-5 relative overflow-hidden">
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
              boxShadow: '0 0 12px var(--accent-glow)',
            }}
          />
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
            Projected Semester 3 SGPA
          </span>
          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl font-bold font-mono-numbers"
              style={{ color: 'var(--accent-primary)' }}
            >
              {projectedSgpa.toFixed(2)}
            </span>
            <span className="text-xs text-zinc-400 font-mono">/ 10.00</span>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono mt-2 block">
            {totalSemesterCredits} total semester credits considered
          </span>
        </div>

        {/* Projected Cumulative CGPA */}
        <div className="hw-card rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-400" />
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
            Projected Cumulative CGPA
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono-numbers text-white">
              {projectedCgpa.toFixed(2)}
            </span>
            <span className="text-xs text-zinc-400 font-mono">/ 10.00</span>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono mt-2 block">
            Across {combinedTotalCredits} credits (Sem 1 + 2 + 3)
          </span>
        </div>

        {/* Prior CGPA Inputs */}
        <div className="hw-card rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-2">
            Prior Semesters Base (Sem 1 & 2)
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Prior CGPA</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={priorCgpa}
                onChange={(e) => setPriorCgpa(e.target.value)}
                className="w-full bg-[#0d0f17] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Prior Credits</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={priorCredits}
                onChange={(e) => setPriorCredits(e.target.value)}
                className="w-full bg-[#0d0f17] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Subject List */}
      <div className="hw-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm text-white tracking-tight">
              Registered Course Forecast Table
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetToDefault}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-xs font-medium text-zinc-300 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={addSubject}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-all text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Subject</span>
            </button>
          </div>
        </div>

        {/* Subjects list */}
        <div className="space-y-2.5">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="p-3.5 rounded-xl bg-[#0e111a] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-all hover:border-white/15"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-white">
                    {subject.name}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">
                    {subject.code}
                  </span>
                </div>
              </div>

              {/* Controls: Credits, Grade Selector, Delete */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase">Credits:</span>
                  <select
                    value={subject.credits}
                    onChange={(e) => updateCredits(subject.id, parseInt(e.target.value, 10))}
                    className="bg-[#141724] border border-white/10 rounded-lg px-2 py-1 text-xs font-mono font-semibold text-white focus:outline-none focus:border-emerald-500"
                  >
                    {[0, 1, 2, 3, 4, 5, 8].map((c) => (
                      <option key={c} value={c}>
                        {c} cr
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase">Grade:</span>
                  <select
                    value={subject.grade}
                    onChange={(e) => updateGrade(subject.id, e.target.value as any)}
                    className="bg-[#141724] border border-emerald-500/30 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  >
                    {['O', 'A+', 'A', 'B+', 'B', 'C', 'F'].map((g) => (
                      <option key={g} value={g}>
                        {g} ({GRADE_POINTS[g]} pts)
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => removeSubject(subject.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Remove course"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
