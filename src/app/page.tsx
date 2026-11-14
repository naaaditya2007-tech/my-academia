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
import { AcademicPlannerView } from '@/components/AcademicPlannerView';
import { LoginSyncModal } from '@/components/LoginSyncModal';
import { BottomNavBar } from '@/components/BottomNavBar';
import { CgpaCalculator } from '@/components/CgpaCalculator';
import { ExamTimetable } from '@/components/ExamTimetable';
import { MarksView } from '@/components/MarksView';
import { TimetableFullView } from '@/components/TimetableFullView';
import { AppearanceSettings, ALL_THEMES, THEMES, ThemeConfig, applyThemeVariables } from '@/components/AppearanceSettings';
import { LiveThemeWallpaper } from '@/components/LiveThemeWallpaper';
import { BackdropMode } from '@/components/BackdropCanvas';
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

  // Appearance & Backdrop state (Default: Vanta OLED)
  const [currentTheme, setCurrentTheme] = useState<string>('vanta');
  const [currentAccent, setCurrentAccent] = useState<string>('#FFFFFF');
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
      const cached = localStorage.getItem('myacademia_data_v7') || localStorage.getItem('myacademia_data_v6');
      const authUser = localStorage.getItem('myacademia_auth_user');
      if (!cached && !authUser) {
        window.location.href = '/login';
        return;
      }

      if (cached) {
        const parsed = JSON.parse(cached);
        // Ensure calendar adheres to official SRM timetable rules (Mon Nov 16 is strictly Day Order 3)
        const updatedData = {
          ...parsed,
          calendar: MOCK_CAMPUS_DATA.calendar,
        };
        setData(updatedData);
        localStorage.setItem('myacademia_data_v7', JSON.stringify(updatedData));
      } else {
        localStorage.setItem('myacademia_data_v7', JSON.stringify(MOCK_CAMPUS_DATA));
        setData(MOCK_CAMPUS_DATA);
      }

      // Load Appearance & Theme Preferences
      const themePrefs = localStorage.getItem('myacademia_theme') || localStorage.getItem('campuscore_theme_prefs');
      if (themePrefs) {
        const parsed = JSON.parse(themePrefs);
        const matched = ALL_THEMES.find((t) => t.id === parsed.themeId || (t.id === 'vanta' && parsed.themeId === 'vanta-oled')) || ALL_THEMES[0];
        setCurrentTheme(matched.id);
        setCurrentAccent(parsed.accent || matched.accentPrimary);
        setCurrentBackdrop(parsed.backdrop || 'default');
        applyThemeVariables(matched, parsed.accent || matched.accentPrimary);
      } else {
        const defaultTheme = ALL_THEMES[0]; // Vanta OLED Default
        setCurrentTheme(defaultTheme.id);
        setCurrentAccent(defaultTheme.accentPrimary);
        setCurrentBackdrop('default');
        applyThemeVariables(defaultTheme);
      }
    } catch (e) {
      console.warn('Could not read cached preferences or portal data', e);
    }

    // Zero-Trust Device Tracking & Remote Revocation Listener
    let deviceId = '';
    try {
      deviceId = localStorage.getItem('myacademia_device_id') || '';
      if (!deviceId) {
        deviceId = `dev_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
        localStorage.setItem('myacademia_device_id', deviceId);
      }

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      let deviceName = 'Desktop Workstation';
      if (/iPhone/i.test(ua)) deviceName = 'iPhone · iOS Safari';
      else if (/iPad/i.test(ua)) deviceName = 'iPad · Safari Mobile';
      else if (/Android/i.test(ua)) deviceName = 'Android · Chrome Mobile';
      else if (/Macintosh|Mac OS X/i.test(ua)) deviceName = 'MacBook Pro · macOS Safari';
      else if (/Windows/i.test(ua)) deviceName = 'Windows 11 · Chrome/Edge';

      fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          deviceId,
          deviceName,
          regNumber: 'RA2511026010107',
        }),
      }).catch(() => {});
    } catch {}

    const checkRevokeInterval = setInterval(() => {
      if (!deviceId) return;
      fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_status', deviceId }),
      })
        .then((res) => res.json())
        .then((resData) => {
          if (resData.revoked) {
            localStorage.clear();
            alert('Access revoked by Administrator.');
            window.location.href = '/login';
          }
        })
        .catch(() => {});
    }, 15000);

    // Cross-tab real-time theme sync listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'myacademia_theme' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const matched = ALL_THEMES.find((t) => t.id === parsed.themeId || (t.id === 'vanta' && parsed.themeId === 'vanta-oled'));
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
      clearInterval(checkRevokeInterval);
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
    const defaultTheme = ALL_THEMES.find((t) => t.id === 'vanta') || ALL_THEMES[0];
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

  const nextWorkingDay = isTodayHoliday
    ? data.calendar.find((c) => c.date >= todayStr && !c.isHoliday && c.dayOrder !== null)
    : data.calendar.find((c) => c.date > todayStr && !c.isHoliday && c.dayOrder !== null);
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

  const handleRefresh = async (force: boolean = false) => {
    // 1. Enforce 15-Minute Per-Device Sync Cooldown (Admin Force Sync bypasses)
    const lastSyncStr = typeof window !== 'undefined'
      ? (localStorage.getItem('last_sync_timestamp') || localStorage.getItem('myacademia_last_sync'))
      : null;
    const lastSyncTime = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
    const now = Date.now();
    const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes strictly enforced

    if (!force && now - lastSyncTime < COOLDOWN_MS) {
      const remainingSec = Math.ceil((COOLDOWN_MS - (now - lastSyncTime)) / 1000);
      const remainingMins = Math.ceil(remainingSec / 60);
      setSyncToastMessage(`Synced recently · Next live refresh in ${remainingMins} mins`);
      setTimeout(() => setSyncToastMessage(null), 3500);
      return;
    }

    setIsRefreshing(true);
    try {
      const res = await fetch('/api/portal/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const json = await res.json();
      if (json.circuitBreaker?.active) {
        setSyncToastMessage(`🛡️ SRM Firewall Circuit Breaker · Local cache active (${json.circuitBreaker.remainingMinutes}m)`);
        setTimeout(() => setSyncToastMessage(null), 4000);
      } else if (json.rateLimited) {
        setSyncToastMessage(json.message || `Synced recently · Next live refresh in ${json.remainingMinutes || 15} mins`);
        setTimeout(() => setSyncToastMessage(null), 3500);
      } else if (json.message && json.source === 'quiet_hours_offline_cache') {
        setSyncToastMessage(json.message);
        setTimeout(() => setSyncToastMessage(null), 3500);
      } else if (json.success && json.data) {
        setData(json.data);
        localStorage.setItem('myacademia_data_v7', JSON.stringify(json.data));
        localStorage.setItem('last_sync_timestamp', String(now));
        localStorage.setItem('myacademia_last_sync', String(now));
        setSyncToastMessage('Academic data synchronized');
        setTimeout(() => setSyncToastMessage(null), 2500);
      }
    } catch (err) {
      console.error('Refresh failed', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleSyncSuccess = (newData: CampusData) => {
    setData(newData);
    localStorage.setItem('myacademia_data_v7', JSON.stringify(newData));
  };

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground,#F3F4F6)] flex relative transition-colors duration-300">
      
      {/* 5-Theme Atmospheric Background (Zero-Resource, 120fps Native) */}
      <LiveThemeWallpaper
        themeId={currentTheme}
        accentPrimary={currentAccent}
        accentSecondary={
          ALL_THEMES.find((t) => t.id === currentTheme)?.accentSecondary || '#6366F1'
        }
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
          activeModule={activeModule}
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
                        {nextWorkingDay ? `${nextWorkingDay.dayOfWeek?.slice(0, 3) || 'Mon'} · Day Order ${nextWorkingDayOrder}` : `Mon · Day Order ${nextWorkingDayOrder}`}
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
                        showKpiBanner={false}
                      />
                    </div>
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
                <div className="space-y-4">
                  <AttendanceMarginCards
                    courses={data.courses}
                    layout="single-column"
                    showKpiBanner={true}
                  />
                </div>
              )}

              {activeModule === 'marks' && (
                <MarksView courses={data.courses} />
              )}

              {activeModule === 'planner' && (
                <AcademicPlannerView
                  calendar={data.calendar}
                  courses={data.courses}
                  todayStr={todayStr}
                />
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
                  onForceSync={() => handleRefresh(true)}
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
        courses={data.courses}
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
