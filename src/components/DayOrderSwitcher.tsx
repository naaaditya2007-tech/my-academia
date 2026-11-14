'use client';

import React from 'react';
import { Calendar } from 'lucide-react';

interface DayOrderSwitcherProps {
  selectedDayOrder: number | 'holiday';
  onSelectDayOrder: (day: number | 'holiday') => void;
  todayDayOrder: number | null;
  tomorrowDayOrder: number | null;
  activeTab: string; // 'today' | 'tomorrow' | 'do1' | 'do2' | ...
  setActiveTab: (tab: string) => void;
}

export function DayOrderSwitcher({
  selectedDayOrder,
  onSelectDayOrder,
  todayDayOrder,
  tomorrowDayOrder,
  activeTab,
  setActiveTab,
}: DayOrderSwitcherProps) {
  const tabs = [
    { id: 'today', label: 'Today', dayOrder: todayDayOrder ?? 'holiday' },
    { id: 'tomorrow', label: 'Tmrw', dayOrder: tomorrowDayOrder ?? 'holiday' },
    { id: 'do1', label: 'DO 1', dayOrder: 1 },
    { id: 'do2', label: 'DO 2', dayOrder: 2 },
    { id: 'do3', label: 'DO 3', dayOrder: 3 },
    { id: 'do4', label: 'DO 4', dayOrder: 4 },
    { id: 'do5', label: 'DO 5', dayOrder: 5 },
  ];

  const getScheduleSummary = () => {
    if (selectedDayOrder === 'holiday') {
      return 'Weekend Holiday';
    }
    const slotMap: Record<number, string> = {
      1: 'Slots A–G · 3 classes',
      2: 'Slots B–E · 2 classes',
      3: 'Slots C–G · 6 classes',
      4: 'Slots D–A · 3 classes',
      5: 'Slots E–B · 4 classes',
    };
    return slotMap[selectedDayOrder] || `Day Order ${selectedDayOrder}`;
  };

  return (
    <div className="w-full space-y-2 select-none">
      {/* Header bar with Schedule title and single slot summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-zinc-300" />
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Schedule
          </h2>
        </div>
        <span className="text-xs text-zinc-400">
          {getScheduleSummary()}
        </span>
      </div>

      {/* Clean 7-Column Segmented Bar to prevent cutting off DO 4 and DO 5 on mobile */}
      <div className="grid grid-cols-7 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] w-full gap-1 shadow-sm">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                onSelectDayOrder(tab.dayOrder as number | 'holiday');
              }}
              className={`py-1.5 px-0.5 rounded-lg text-[11px] font-medium text-center transition-all truncate cursor-pointer ${
                isActive
                  ? 'bg-white/[0.12] text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
