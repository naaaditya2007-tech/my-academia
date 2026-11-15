'use client';

import React from 'react';
import {
  LayoutDashboard,
  Clock,
  BarChart3,
  Award,
  Calendar,
  FileText,
  GraduationCap,
  Palette,
  ChevronRight,
  ShieldAlert,
  LogOut,
} from 'lucide-react';
import { StudentProfile } from '@/types/campus';

export type ActiveNavModule =
  | 'dashboard'
  | 'timetable'
  | 'attendance'
  | 'marks'
  | 'planner'
  | 'exam_timetable'
  | 'cgpa'
  | 'appearance'
  | 'admin';

interface SidebarNavProps {
  activeModule: ActiveNavModule;
  onSelectModule: (module: ActiveNavModule) => void;
  student?: StudentProfile | null;
  overallAttendancePct: number;
  onOpenSyncModal: () => void;
}

export function SidebarNav({
  activeModule,
  onSelectModule,
  student,
  overallAttendancePct,
}: SidebarNavProps) {
  const navItems: Array<{
    id: ActiveNavModule;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    category: 'studies' | 'tools';
    badge?: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, category: 'studies' },
    { id: 'timetable', label: 'Timetable', icon: Clock, category: 'studies' },
    { id: 'attendance', label: 'Attendance', icon: BarChart3, category: 'studies', badge: `${overallAttendancePct.toFixed(1)}%` },
    { id: 'marks', label: 'Internal Marks', icon: Award, category: 'studies', badge: '9.0' },
    { id: 'planner', label: 'Academic Planner', icon: Calendar, category: 'studies' },
    { id: 'exam_timetable', label: 'Exam Timetable', icon: FileText, category: 'tools', badge: 'Nov 25' },
    { id: 'cgpa', label: 'CGPA Calculator', icon: GraduationCap, category: 'tools' },
    { id: 'admin', label: 'Admin Console', icon: ShieldAlert, category: 'tools', badge: 'Dev' },
  ];

  const studiesNav = navItems.filter((i) => i.category === 'studies');
  const toolsNav = navItems.filter((i) => i.category === 'tools');

  return (
    <aside className="w-60 shrink-0 bg-[var(--bg-surface)] border-r border-white/[0.06] flex flex-col justify-between h-screen sticky top-0 z-30 select-none">
      
      {/* Top Branding: Clean MyAcademia */}
      <div>
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-white block">
                MyAcademia
              </span>
              <span className="text-[11px] text-zinc-400 block">
                SRM KTR
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="px-3 py-3 space-y-5">
          
          {/* Studies Group */}
          <div>
            <span className="px-2 text-xs font-medium text-zinc-400 block mb-1.5">
              Academic
            </span>
            <nav className="space-y-0.5">
              {studiesNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectModule(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-white/[0.08] text-white'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded text-zinc-400 bg-white/[0.04]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tools & Planning Group */}
          <div>
            <span className="px-2 text-xs font-medium text-zinc-400 block mb-1.5">
              Tools
            </span>
            <nav className="space-y-0.5">
              {toolsNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectModule(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-white/[0.08] text-white'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded text-zinc-400 bg-white/[0.04]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom Section: Appearance + Student Profile Card */}
      <div className="p-3 border-t border-white/[0.06] space-y-1.5">
        {/* Appearance & Themes Navigation Item */}
        <button
          onClick={() => onSelectModule('appearance')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeModule === 'appearance'
              ? 'bg-white/[0.08] text-white'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Palette className={`w-4 h-4 ${activeModule === 'appearance' ? 'text-white' : 'text-zinc-400'}`} />
            <span>Appearance & Themes</span>
          </div>
        </button>

        {/* Student Profile Card */}
        <button
          onClick={() => onSelectModule('appearance')}
          className="w-full text-left p-2 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] transition-colors flex items-center justify-between group"
          title="Open Preferences"
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-7 h-7 rounded-md bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white font-medium text-xs shrink-0">
              {(student?.name || 'SRM').split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
            <div className="truncate">
              <span className="text-xs font-medium text-white block truncate leading-tight">
                {student?.name || 'Student Portal'}
              </span>
              <span className="text-[11px] font-mono text-zinc-400 block truncate">
                {student?.regNumber || 'Not Authenticated'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-300 transition-colors shrink-0" />
        </button>

        {/* Disconnect & Sign Out */}
        <button
          onClick={async () => {
            try {
              await fetch('/api/auth/logout', { method: 'POST' });
              await fetch('/api/academia/logout', { method: 'POST' });
            } catch {}
            try {
              // Preserve device ID and theme preference while clearing all student data
              const devId = localStorage.getItem('myacademia_device_id');
              const theme = localStorage.getItem('myacademia_theme');
              localStorage.clear();
              if (devId) localStorage.setItem('myacademia_device_id', devId);
              if (theme) localStorage.setItem('myacademia_theme', theme);
            } catch {}
            window.location.href = '/login';
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Sign Out of SRM Portal"
        >
          <div className="flex items-center gap-2.5">
            <LogOut className="w-4 h-4 text-zinc-400 hover:text-red-400" />
            <span>Sign Out</span>
          </div>
        </button>
      </div>
    </aside>
  );
}
