'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CampusData, ScheduledClass } from '@/types/campus';
import { MOCK_CAMPUS_DATA } from '@/lib/mockData';
import { buildDayTimeline, SRM_AUTHENTIC_DAY_ORDER_MATRIX } from '@/lib/timetable';
import { SidebarNav, ActiveNavModule } from '@/components/SidebarNav';
import { RightTelemetryPanel } from '@/components/RightTelemetryPanel';
import { HeaderTelemetry } from '@/components/HeaderTelemetry';
import { DayOrderSwitcher } from '@/components/DayOrderSwitcher';
import { TimelineView } from '@/components/TimelineView';
import { AttendanceMarginCards } from '@/components/AttendanceMarginCards';
import { AcademicCalendarModal } from '@/components/AcademicCalendarModal';
import { LoginSyncModal } from '@/components/LoginSyncModal';
import { BottomNavBar } from '@/components/BottomNavBar';
import { CgpaCalculator } from '@/components/CgpaCalculator';
import { ExamTimetable } from '@/components/ExamTimetable';
import { MarksView } from '@/components/MarksView';
import { TimetableFullView } from '@/components/TimetableFullView';
import { AppearanceSettings, ALL_THEMES, THEMES, ThemeConfig, applyThemeVariables } from '@/components/AppearanceSettings';
import { BackdropCanvas, BackdropMode } from '@/components/BackdropCanvas';
import { GamingHeroWatermark } from '@/components/GamingHeroWatermark';
import { GamingEasterEggManager } from '@/components/GamingEasterEggManager';
import { AdminConsole, AdminOverrideState, CampusBroadcast } from '@/components/AdminConsole';
import { DataVerificationModal } from '@/components/DataVerificationModal';
import {
  Calendar,
  Clock,
  BarChart3,
  Award,
  GraduationCap,
  FileText,
  ChevronRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

export default function MyAcademiaDashboard() {
  const [data, setData] = useState<CampusData>(MOCK_CAMPUS_DATA);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeModule, setActiveModule] = useState<ActiveNavModule>('dashboard');
  const [selectedDayOrder, setSelectedDayOrder] = useState<number | 'holiday'>(1);
  const [activeTab, setActiveTab] = useState<string>('today');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

  // Admin Override & Campus Broadcast State
  const [adminOverride, setAdminOverride] = useState<AdminOverrideState>(() => {
    if (typeof window === 'undefined') return { enabled: false, type: 'auto', autoShiftSubsequent: false };
    try {
      const saved = localStorage.getItem('myacademia_admin_override');
      return saved ? JSON.parse(saved) : { enabled: false, type: 'auto', autoShiftSubsequent: false };
    } catch {
      return { enabled: false, type: 'auto', autoShiftSubsequent: false };
    }
  });

  const [campusBroadcast, setCampusBroadcast] = useState<CampusBroadcast>(() => {
    if (typeof window === 'undefined') return { enabled: false, message: '', severity: 'info' };
    try {
      const saved = localStorage.getItem('myacademia_campus_broadcast');
      return saved ? JSON.parse(saved) : { enabled: false, message: '', severity: 'info' };
    } catch {
      return { enabled: false, message: '', severity: 'info' };
    }
  });

  const [isBroadcastDismissed, setIsBroadcastDismissed] = useState(false);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  // Appearance & Backdrop state (Default: Emerald Telemetry)
  const [currentTheme, setCurrentTheme] = useState<string>('emerald');
  const [currentAccent, setCurrentAccent] = useState<string>('#10B981');
  const [currentBackdrop, setCurrentBackdrop] = useState<BackdropMode>('default');
  const [stealthMode, setStealthMode] = useState<boolean>(false);
  const [watermarkTriggerCount, setWatermarkTriggerCount] = useState<number>(0);

  const [todayStr, setTodayStr] = useState<string>('2026-11-14');
  const [tomorrowStr, setTomorrowStr] = useState<string>('2026-11-15');
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null);

  // Initialize data, theme preferences, stealth mode, and cross-tab sync
  useEffect(() => {
    try {
      const now = new Date();
      const tStr = now.toISOString().split('T')[0];
      setTodayStr(tStr);
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());

      const tTomorrow = new Date();
      tTomorrow.setDate(tTomorrow.getDate() + 1);
      setTomorrowStr(tTomorrow.toISOString().split('T')[0]);

      // Stealth mode preference
      const savedStealth = localStorage.getItem('myacademia_stealth_mode') === 'true';
      setStealthMode(savedStealth);

      // Session Gate: Check for authenticated session
      const cached = localStorage.getItem('myacademia_data_v6');
      const authUser = localStorage.getItem('myacademia_auth_user');
      if (!cached && !authUser) {
        window.location.href = '/login';
        return;
      }

      if (cached) {
        const parsed = JSON.parse(cached);
        setData(parsed);
      } else {
        localStorage.setItem('myacademia_data_v6', JSON.stringify(MOCK_CAMPUS_DATA));
        setData(MOCK_CAMPUS_DATA);
      }

      // Load Appearance & Theme Preferences
      const themePrefs = localStorage.getItem('myacademia_theme') || localStorage.getItem('campuscore_theme_prefs');
      if (themePrefs) {
        const parsed = JSON.parse(themePrefs);
        const matched = ALL_THEMES.find((t) => t.id === parsed.themeId) || ALL_THEMES[2];
        setCurrentTheme(matched.id);
        setCurrentAccent(parsed.accent || matched.accentPrimary);
        setCurrentBackdrop(parsed.backdrop || 'default');
        applyThemeVariables(matched, parsed.accent || matched.accentPrimary);
      } else {
        const defaultTheme = ALL_THEMES.find((t) => t.id === 'emerald') || ALL_THEMES[2];
        setCurrentTheme(defaultTheme.id);
        setCurrentAccent(defaultTheme.accentPrimary);
        setCurrentBackdrop('default');
        applyThemeVariables(defaultTheme);
      }
    } catch (e) {
      console.warn('Could not read cached preferences or portal data', e);
    }

    // Cross-tab real-time theme sync listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'myacademia_theme' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const matched = ALL_THEMES.find((t) => t.id === parsed.themeId);
          if (matched) {
            setCurrentTheme(matched.id);
            setCurrentAccent(parsed.accent || matched.accentPrimary);
            setCurrentBackdrop(parsed.backdrop || 'default');
            applyThemeVariables(matched, parsed.accent || matched.accentPrimary);
          }
        } catch (err) {}
      }
      if (e.key === 'myacademia_stealth_mode') {
        setStealthMode(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const interval = setInterval(() => {
      const n = new Date();
      setCurrentMinutes(n.getHours() * 60 + n.getMinutes());
    }, 30000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleSelectTheme = (themeConfig: ThemeConfig) => {
    setCurrentTheme(themeConfig.id);
    setCurrentAccent(themeConfig.accentPrimary);
    applyThemeVariables(themeConfig, themeConfig.accentPrimary);
    saveThemePrefs(themeConfig.id, themeConfig.accentPrimary, currentBackdrop);
  };

  const handleSelectAccent = (accentHex: string) => {
    setCurrentAccent(accentHex);
    document.documentElement.style.setProperty('--accent-primary', accentHex);
    saveThemePrefs(currentTheme, accentHex, currentBackdrop);
  };

  const handleSelectBackdrop = (backdrop: BackdropMode) => {
    setCurrentBackdrop(backdrop);
    saveThemePrefs(currentTheme, currentAccent, backdrop);
  };

  const handleToggleStealthMode = (stealth: boolean) => {
    setStealthMode(stealth);
    try {
      localStorage.setItem('myacademia_stealth_mode', String(stealth));
    } catch (e) {}
  };

  const handleResetDefaults = () => {
    const defaultTheme = ALL_THEMES.find((t) => t.id === 'emerald') || ALL_THEMES[2];
    setCurrentTheme(defaultTheme.id);
    setCurrentAccent(defaultTheme.accentPrimary);
    setCurrentBackdrop('default');
    setStealthMode(false);
    applyThemeVariables(defaultTheme);
    localStorage.removeItem('myacademia_theme');
    localStorage.removeItem('campuscore_theme_prefs');
    localStorage.removeItem('myacademia_stealth_mode');
  };

  const saveThemePrefs = (themeId: string, accent: string, backdrop: BackdropMode) => {
    try {
      const payload = JSON.stringify({ themeId, accent, backdrop });
      localStorage.setItem('myacademia_theme', payload);
      localStorage.setItem('campuscore_theme_prefs', payload);
    } catch (e) {
      console.warn('Could not save theme preferences', e);
    }
  };

  const rawTodayEntry = data.calendar.find((c) => c.date === todayStr);
  const tomorrowEntry = data.calendar.find((c) => c.date === tomorrowStr);

  // Apply Admin Override if active
  const isTodayHoliday = adminOverride.enabled && adminOverride.type === 'holiday'
    ? true
    : (rawTodayEntry ? rawTodayEntry.isHoliday || rawTodayEntry.dayOrder === null : false);

  const todayHolidayReason = adminOverride.enabled && adminOverride.type === 'holiday'
    ? (adminOverride.reason || 'Admin Emergency Override (Monsoon / Rain Holiday)')
    : rawTodayEntry?.holidayReason;

  const todayDayOrder = adminOverride.enabled && adminOverride.type === 'day_order' && adminOverride.targetDayOrder
    ? adminOverride.targetDayOrder
    : (rawTodayEntry?.dayOrder ?? null);

  const tomorrowDayOrder = tomorrowEntry?.dayOrder ?? null;

  const nextWorkingDay = data.calendar.find(
    (c) => c.date >= todayStr && !c.isHoliday && c.dayOrder !== null
  );
  const nextWorkingDayOrder = nextWorkingDay?.dayOrder || 3;

  useEffect(() => {
    if (isTodayHoliday) {
      setSelectedDayOrder('holiday');
      setActiveTab('today');
    } else if (todayDayOrder) {
      setSelectedDayOrder(todayDayOrder);
      setActiveTab('today');
    } else {
      setSelectedDayOrder(3);
      setActiveTab('do3');
    }
  }, [isTodayHoliday, todayDayOrder]);

  const effectiveDayOrder =
    selectedDayOrder === 'holiday' ? nextWorkingDayOrder : selectedDayOrder;

  // A day's classes are ONLY live if today is an active working day AND user is on the 'Today' tab viewing today's day order!
  const isLiveDay =
    !isTodayHoliday && todayDayOrder !== null && activeTab === 'today' && selectedDayOrder === todayDayOrder;

  // Timeline for the inspector (selected Day Order)
  const timeline: ScheduledClass[] = buildDayTimeline(
    effectiveDayOrder,
    data.courses,
    data.dayOrderMatrix,
    currentMinutes,
    isLiveDay
  );

  // Dedicated todayTimeline for HeaderTelemetry: strictly evaluates TODAY's real status, NEVER preview day orders!
  const todayTimeline: ScheduledClass[] =
    !isTodayHoliday && todayDayOrder !== null
      ? buildDayTimeline(todayDayOrder, data.courses, data.dayOrderMatrix, currentMinutes, true)
      : [];

  // Accurate overall attendance calculation: 298 / 346 = 86.127% -> 86.1%
  const totalAttended = data.courses.reduce((acc, c) => acc + c.hoursAttended, 0);
  const totalConducted = data.courses.reduce((acc, c) => acc + c.hoursConducted, 0);
  const overallPct = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : 0;

  // Strict dynamic internal marks sum across all published courses
  const totalInternalScored = data.courses.reduce((acc, c) => acc + (c.totalInternalScored || 0), 0);
  const totalInternalMax = data.courses.reduce((acc, c) => acc + (c.totalInternalMax || 0), 0);
  const internalPct = totalInternalMax > 0 ? (totalInternalScored / totalInternalMax) * 100 : 0;

  const handleRefresh = async () => {
    // Check 3-minute client cooldown
    const lastSyncStr = typeof window !== 'undefined' ? localStorage.getItem('myacademia_last_sync') : null;
    const lastSyncTime = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
    const now = Date.now();
    const COOLDOWN_MS = 180000; // 3 minutes

    if (now - lastSyncTime < COOLDOWN_MS) {
      const remainingSec = Math.ceil((COOLDOWN_MS - (now - lastSyncTime)) / 1000);
      setSyncToastMessage(`Already up to date · Next live sync available in ${Math.ceil(remainingSec / 60)}m`);
      setTimeout(() => setSyncToastMessage(null), 3000);
      return;
    }

    setIsRefreshing(true);
    try {
      const res = await fetch('/api/academia/sync', { method: 'POST' });
      const json = await res.json();
      if (json.rateLimited) {
        setSyncToastMessage(json.message || 'Rate limit active · Please wait');
        setTimeout(() => setSyncToastMessage(null), 3000);
      } else if (json.success && json.data) {
        setData(json.data);
        localStorage.setItem('myacademia_data_v6', JSON.stringify(json.data));
        localStorage.setItem('myacademia_last_sync', String(now));
      }
    } catch (err) {
      console.error('Refresh failed', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleSyncSuccess = (newData: CampusData) => {
    setData(newData);
    localStorage.setItem('myacademia_data_v6', JSON.stringify(newData));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--foreground,#F3F4F6)] flex relative transition-colors duration-300">
      
      {/* Adaptive Background Canvas Effect (Frame-capped on mobile) */}
      <BackdropCanvas
        mode={currentBackdrop}
        theme={currentTheme}
        accentHex={currentAccent}
      />

      {/* Collector's Edition: Animated Vector Character Art Watermark */}
      <GamingHeroWatermark
        themeId={currentTheme}
        stealthMode={stealthMode}
        onTriggerEasterEgg={() => setWatermarkTriggerCount((c) => c + 1)}
      />

      {/* PC Gaming Vault: Interactive Audio / Glitch / Cheat FX Manager */}
      <GamingEasterEggManager
        themeId={currentTheme}
        stealthMode={stealthMode}
        overallAttendance={overallPct}
        courses={data.courses}
        watermarkTriggerCount={watermarkTriggerCount}
      />

      {/* LAYER 1: Left Persistent Navigation Rail (Desktop >= 1024px) */}
      <div className="hidden lg:block shrink-0">
        <SidebarNav
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          student={data.student}
          overallAttendancePct={overallPct}
          onOpenSyncModal={() => setIsSyncModalOpen(true)}
        />
      </div>

      {/* LAYER 2: Main Center Core Stage */}
      <div className="flex-1 flex flex-col min-w-0 pb-28 lg:pb-12">
        {/* Streamlined Liquid Glass Status Header */}
        <HeaderTelemetry
          dayOrder={todayDayOrder}
          isHoliday={isTodayHoliday}
          holidayReason={todayHolidayReason}
          nextWorkingDayOrder={nextWorkingDayOrder}
          nextWorkingStartTime="08:00"
          timeline={todayTimeline}
          lastSyncedAt={data.lastSyncedAt}
          dataSource={data.dataSource || 'demo'}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onOpenSyncModal={() => setIsSyncModalOpen(true)}
          onOpenVerificationModal={() => setIsVerificationModalOpen(true)}
        />

        {/* Campus Broadcast Banner (Admin Command Module) */}
        {campusBroadcast.enabled && !isBroadcastDismissed && (
          <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium shadow-lg backdrop-blur-md transition-all ${
                campusBroadcast.severity === 'alert'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : campusBroadcast.severity === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full animate-ping shrink-0 bg-current" />
                <span>{campusBroadcast.message}</span>
              </div>
              <button
                onClick={() => setIsBroadcastDismissed(true)}
                className="p-1 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                title="Dismiss Broadcast"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-7">
          
          {/* GPU-Only Fluid Page Transitions (120FPS spring) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 6, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeModule === 'dashboard' && (
                <div className="space-y-6">
                  
                  {/* ROW 1: Compact Horizontal Metric Strip (Max 88px, divide-x, no empty space) */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y lg:divide-y-0 divide-x-0 lg:divide-x divide-white/[0.06]">
                    <button
                      onClick={() => setActiveModule('attendance')}
                      className="p-4 text-left hover:bg-white/[0.02] transition-colors min-w-0"
                    >
                      <span className="text-xs text-zinc-400 block">Attendance</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-xl font-semibold text-white tracking-tight">
                          {overallPct.toFixed(1)}%
                        </span>
                        <span className="text-xs text-emerald-400 font-medium">Safe</span>
                      </div>
                      <span className="text-xs text-zinc-400 block mt-0.5 truncate">
                        {totalAttended}/{totalConducted} hrs
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveModule('marks')}
                      className="p-4 text-left hover:bg-white/[0.02] transition-colors min-w-0"
                    >
                      <span className="text-xs text-zinc-400 block">Internal Marks</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-xl font-semibold text-white tracking-tight">
                          {totalInternalScored.toFixed(1)}
                        </span>
                        <span className="text-xs text-zinc-500">
                          / {totalInternalMax.toFixed(0)}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-400 block mt-0.5 truncate">
                        {internalPct.toFixed(1)}% · 9.0 SGPA
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveModule('timetable')}
                      className="p-4 text-left hover:bg-white/[0.02] transition-colors min-w-0"
                    >
                      <span className="text-xs text-zinc-400 block">Next Working Day</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-xl font-semibold text-white tracking-tight">
                          {SRM_AUTHENTIC_DAY_ORDER_MATRIX[nextWorkingDayOrder]?.length || 6} Classes
                        </span>
                      </div>
                      <span className="text-xs text-zinc-400 block mt-0.5 truncate">
                        Mon · Day Order {nextWorkingDayOrder}
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveModule('exam_timetable')}
                      className="p-4 text-left hover:bg-white/[0.02] transition-colors min-w-0"
                    >
                      <span className="text-xs text-zinc-400 block">Next Exam</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-xl font-semibold text-white tracking-tight">Nov 25</span>
                      </div>
                      <span className="text-xs text-zinc-400 block mt-0.5 truncate">
                        21MAB201T · Transforms
                      </span>
                    </button>
                  </div>

                  {/* ROW 2: Schedule (7 cols) + Courses (5 cols) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    
                    {/* Left 7 cols: Schedule */}
                    <div className="lg:col-span-7 space-y-3 min-w-0">
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <DayOrderSwitcher
                          selectedDayOrder={selectedDayOrder}
                          onSelectDayOrder={(day) => setSelectedDayOrder(day)}
                          todayDayOrder={todayDayOrder}
                          tomorrowDayOrder={tomorrowDayOrder}
                          activeTab={activeTab}
                          setActiveTab={setActiveTab}
                        />

                        <div className="mt-3 pt-3 border-t border-white/[0.06]">
                          <TimelineView
                            timeline={timeline}
                            isHoliday={selectedDayOrder === 'holiday'}
                            holidayReason={todayHolidayReason}
                            nextWorkingDayOrder={nextWorkingDayOrder}
                            isLiveDay={isLiveDay}
                            onJumpToNextWorkingDay={() => {
                              setSelectedDayOrder(nextWorkingDayOrder);
                              setActiveTab(`do${nextWorkingDayOrder}`);
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right 5 cols: Compact Courses List */}
                    <div className="lg:col-span-5 space-y-3 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white tracking-tight">
                          Courses
                        </h3>
                        <button
                          onClick={() => setActiveModule('attendance')}
                          className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                        >
                          <span>View all 7</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      <AttendanceMarginCards
                        courses={data.courses}
                        layout="single-column"
                        maxItems={3}
                      />
                    </div>
                  </div>

                  {/* ROW 3: All Courses Directory */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white tracking-tight">
                          All Courses
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          7 registered courses · 75% minimum attendance threshold
                        </p>
                      </div>
                      <span className="text-xs font-medium text-emerald-400">
                        7 on track
                      </span>
                    </div>

                    <AttendanceMarginCards
                      courses={data.courses}
                      layout="grid"
                    />
                  </div>
                </div>
              )}

              {activeModule === 'timetable' && (
                <TimetableFullView
                  selectedDayOrder={typeof selectedDayOrder === 'number' ? selectedDayOrder : 3}
                  onSelectDayOrder={(d) => setSelectedDayOrder(d)}
                  courses={data.courses}
                  dayOrderMatrix={data.dayOrderMatrix}
                />
              )}

              {activeModule === 'attendance' && (
                <div className="space-y-5">
                  <div className="liquid-glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-white tracking-tight">
                        Course-Wise Attendance & Safety Margins
                      </h2>
                      <p className="text-xs text-zinc-400 font-mono mt-1">
                        SRMIST enforces attendance course-by-course. Safe margin indicates how many consecutive hours you can miss while remaining above 75.0%.
                      </p>
                    </div>
                    <div className="flex items-baseline gap-2 shrink-0">
                      <span className="text-3xl font-bold font-mono-numbers text-white">
                        {overallPct.toFixed(1)}%
                      </span>
                      <span className="text-xs font-mono text-[var(--accent-primary)] font-semibold">
                        Overall
                      </span>
                    </div>
                  </div>

                  <AttendanceMarginCards
                    courses={data.courses}
                    layout="grid"
                  />
                </div>
              )}

              {activeModule === 'marks' && (
                <MarksView courses={data.courses} />
              )}

              {activeModule === 'planner' && (
                <div className="liquid-glass rounded-2xl p-6">
                  <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] mb-4">
                    <div>
                      <h2 className="text-base font-bold text-white tracking-tight">
                        Full Academic Calendar & Day Orders
                      </h2>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">
                        Instructional days, weekends, and official SRM holidays
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] text-zinc-400 font-mono uppercase text-[11px]">
                          <th className="pb-3 font-medium">Date</th>
                          <th className="pb-3 font-medium">Day</th>
                          <th className="pb-3 font-medium">Day Order</th>
                          <th className="pb-3 font-medium">Working Day #</th>
                          <th className="pb-3 font-medium">Event / Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {data.calendar.slice(0, 50).map((d, i) => (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="py-2.5 font-mono text-zinc-200">{d.date}</td>
                            <td className="py-2.5 text-zinc-400">{d.dayOfWeek}</td>
                            <td className="py-2.5">
                              {d.dayOrder ? (
                                <span className="px-2 py-0.5 rounded bg-[var(--accent-tint)] border border-[var(--accent-border)] text-[var(--accent-primary)] font-mono font-bold text-[10px]">
                                  DO {d.dayOrder}
                                </span>
                              ) : (
                                <span className="text-zinc-600 font-mono">-</span>
                              )}
                            </td>
                            <td className="py-2.5 font-mono text-zinc-400">
                              {d.workingDayNumber ? `Day ${d.workingDayNumber}` : '-'}
                            </td>
                            <td className="py-2.5">
                              {d.isHoliday ? (
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono">
                                  {d.holidayReason || 'Holiday'}
                                </span>
                              ) : (
                                <span className="text-zinc-400">Instructional Day</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeModule === 'exam_timetable' && (
                <ExamTimetable />
              )}

              {activeModule === 'cgpa' && (
                <CgpaCalculator courses={data.courses} />
              )}

              {activeModule === 'appearance' && (
                <AppearanceSettings
                  currentTheme={currentTheme}
                  currentAccent={currentAccent}
                  currentBackdrop={currentBackdrop}
                  stealthMode={stealthMode}
                  onSelectTheme={handleSelectTheme}
                  onSelectAccent={handleSelectAccent}
                  onSelectBackdrop={handleSelectBackdrop}
                  onToggleStealthMode={handleToggleStealthMode}
                  onResetDefaults={handleResetDefaults}
                />
              )}

              {activeModule === 'admin' && (
                <AdminConsole
                  currentRegNumber={data.student.regNumber}
                  onOverrideChange={(ov) => setAdminOverride(ov)}
                  onBroadcastChange={(bc) => {
                    setCampusBroadcast(bc);
                    setIsBroadcastDismissed(false);
                  }}
                  onOpenVerificationModal={() => setIsVerificationModalOpen(true)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* LAYER 3: Right Dedicated Telemetry Panel (Desktop XL >= 1280px) */}
      <RightTelemetryPanel
        todayStr={todayStr}
        todayDayOrder={todayDayOrder}
        isTodayHoliday={isTodayHoliday}
        todayHolidayReason={todayHolidayReason}
        nextWorkingDayOrder={nextWorkingDayOrder}
        calendar={data.calendar}
        courses={data.courses}
        lastSyncedAt={data.lastSyncedAt}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onSelectDayOrder={(day) => {
          setSelectedDayOrder(day);
          setActiveTab(`do${day}`);
        }}
        selectedDayOrder={selectedDayOrder}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onOpenCalendarModal={() => setIsCalendarOpen(true)}
        onSelectModule={setActiveModule}
      />

      {/* Modals */}
      <AcademicCalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        calendar={data.calendar}
        todayStr={todayStr}
      />

      <LoginSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncSuccess={handleSyncSuccess}
      />

      <DataVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        courses={data.courses}
        student={data.student}
        lastSyncedAt={data.lastSyncedAt}
        dataSource={data.dataSource}
      />

      {/* LAYER 4: Mobile & Tablet Floating Liquid Glass Bottom Dock (< 1024px) */}
      <BottomNavBar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
      />

      {/* Sync Cooldown & Telemetry Notification Toast */}
      {syncToastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 right-6 z-50 bg-[#111318] border border-white/20 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span>{syncToastMessage}</span>
        </div>
      )}
    </div>
  );
}
