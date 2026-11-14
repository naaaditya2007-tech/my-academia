'use client';

import React from 'react';
import { motion } from 'framer-motion';
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
    { id: 'marks', label: 'Marks', icon: Award },
    { id: 'appearance', label: 'Themes', icon: Palette },
  ];

  return (
    <nav className="fixed bottom-3 inset-x-3 sm:inset-x-8 z-50 h-16 rounded-2xl liquid-glass flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] lg:hidden shadow-2xl select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeModule === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectModule(tab.id)}
            className="relative flex-1 flex flex-col items-center justify-center py-1.5 h-full transition-all group"
          >
            {/* Liquid spring active glider */}
            {isActive && (
              <motion.div
                layoutId="mobileDockActive"
                className="absolute inset-1 rounded-xl bg-[var(--accent-tint)] border border-[var(--accent-border)] -z-10 shadow-[0_0_15px_-4px_var(--accent-glow)]"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}

            <Icon
              className={`w-5 h-5 transition-transform duration-200 ${
                isActive
                  ? 'text-[var(--accent-primary)] scale-110'
                  : 'text-zinc-400 group-hover:text-zinc-200'
              }`}
            />
            <span
              className={`text-[10px] font-medium tracking-tight mt-1 transition-colors ${
                isActive
                  ? 'text-white font-semibold'
                  : 'text-zinc-400 group-hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
