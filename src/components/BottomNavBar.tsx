'use client';

import React from 'react';
import { LayoutDashboard, Clock, BarChart3, Award, Palette } from 'lucide-react';
import { ActiveNavModule } from './SidebarNav';

interface BottomNavBarProps {
  activeModule: ActiveNavModule;
  onSelectModule: (module: ActiveNavModule) => void;
}

export function BottomNavBar({ activeModule, onSelectModule }: BottomNavBarProps) {
  const tabs: Array<{
    id: ActiveNavModule;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'timetable', label: 'Schedule', icon: Clock },
    { id: 'attendance', label: 'Attendance', icon: BarChart3 },
    { id: 'marks', label: 'Results', icon: Award },
    { id: 'appearance', label: 'Theme', icon: Palette },
  ];

  return (
    <nav className="fixed bottom-3 inset-x-3 sm:inset-x-8 z-50 h-16 rounded-3xl bg-[#131629]/85 backdrop-blur-xl border border-white/10 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] lg:hidden shadow-2xl select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeModule === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectModule(tab.id)}
            className="relative flex-1 flex flex-col items-center justify-center py-1 h-full transition-all group"
          >
            <Icon
              className={`w-5 h-5 transition-transform duration-200 ${
                isActive ? 'text-white scale-110' : 'text-zinc-400 group-hover:text-zinc-200'
              }`}
            />
            <span
              className={`text-[10px] font-medium tracking-tight mt-0.5 transition-colors ${
                isActive ? 'text-white font-semibold' : 'text-zinc-400 group-hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </span>

            {/* Clean active underline pill indicator (matching Campus Web 1:1) */}
            {isActive && (
              <span className="w-6 h-1 rounded-full bg-white mt-1 shadow-sm transition-all" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
