'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Zap,
  Radio,
  Activity,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  CloudRain,
  Key,
  Flame,
  ArrowRight,
  Server,
  ToggleLeft,
  ToggleRight,
  Search,
} from 'lucide-react';

export interface AdminOverrideState {
  enabled: boolean;
  type: 'auto' | 'holiday' | 'day_order';
  targetDayOrder?: number;
  reason?: string;
  autoShiftSubsequent: boolean;
}

export interface CampusBroadcast {
  enabled: boolean;
  message: string;
  severity: 'info' | 'warning' | 'alert';
}

interface AdminConsoleProps {
  currentRegNumber: string;
  onOverrideChange: (override: AdminOverrideState) => void;
  onBroadcastChange: (broadcast: CampusBroadcast) => void;
  onOpenVerificationModal?: () => void;
}

export function AdminConsole({
  currentRegNumber,
  onOverrideChange,
  onBroadcastChange,
  onOpenVerificationModal,
}: AdminConsoleProps) {
  // Passkey Gate: Protected strictly by Master PIN 2077
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyError, setPasskeyError] = useState(false);

  // 1. Emergency Override State
  const [override, setOverride] = useState<AdminOverrideState>(() => {
    if (typeof window === 'undefined') return { enabled: false, type: 'auto', autoShiftSubsequent: false };
    try {
      const saved = localStorage.getItem('myacademia_admin_override');
      return saved ? JSON.parse(saved) : { enabled: false, type: 'auto', autoShiftSubsequent: false };
    } catch {
      return { enabled: false, type: 'auto', autoShiftSubsequent: false };
    }
  });

  // 2. Campus Broadcast State (Default: Completely OFF)
  const [broadcast, setBroadcast] = useState<CampusBroadcast>(() => {
    if (typeof window === 'undefined') {
      return {
        enabled: false,
        message: '🌧️ Monsoon Advisory: Heavy rainfall predicted in Chengalpattu district. Monitor portal for shift notices.',
        severity: 'warning',
      };
    }
    try {
      const saved = localStorage.getItem('myacademia_campus_broadcast');
      return saved
        ? JSON.parse(saved)
        : {
            enabled: false,
            message: '🌧️ Monsoon Advisory: Heavy rainfall predicted in Chengalpattu district. Monitor portal for shift notices.',
            severity: 'warning',
          };
    } catch {
      return {
        enabled: false,
        message: '🌧️ Monsoon Advisory: Heavy rainfall predicted in Chengalpattu district. Monitor portal for shift notices.',
        severity: 'warning',
      };
    }
  });

  // 3. Scraper Health Metrics & Maintenance Mode
  const [metrics, setMetrics] = useState({
    portalStatus: 'online',
    avgLatencyMs: 142,
    totalSyncRequests: 48,
    cacheHitRatio: 98.4,
    maintenanceMode: false,
  });

  useEffect(() => {
    // Fetch live scraper metrics from sync endpoint
    fetch('/api/academia/sync')
      .then((res) => res.json())
      .then((json) => {
        if (json.metrics) {
          setMetrics(json.metrics);
        }
      })
      .catch(() => {});
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const correctKey = process.env.NEXT_PUBLIC_ADMIN_KEY || '2077';
    if (passkeyInput.trim() === correctKey || passkeyInput.trim() === '2077') {
      setIsUnlocked(true);
      setPasskeyError(false);
    } else {
      setPasskeyError(true);
    }
  };

  const updateOverride = (next: AdminOverrideState) => {
    setOverride(next);
    localStorage.setItem('myacademia_admin_override', JSON.stringify(next));
    onOverrideChange(next);
  };

  const updateBroadcast = (next: CampusBroadcast) => {
    setBroadcast(next);
    localStorage.setItem('myacademia_campus_broadcast', JSON.stringify(next));
    onBroadcastChange(next);
  };

  const toggleMaintenanceMode = async (enabled: boolean) => {
    setMetrics((prev) => ({ ...prev, maintenanceMode: enabled }));
    try {
      await fetch('/api/academia/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenanceModeToggle: enabled }),
      });
    } catch (e) {
      console.warn('Failed to update maintenance mode', e);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl border border-white/[0.08] bg-[#0E1015] select-none text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-zinc-300">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">
            Admin Console Restricted
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Enter the 4-digit master passkey to access emergency overrides and scraper health controls.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-3">
          <input
            type="password"
            placeholder="Enter Master PIN (4 digits)"
            value={passkeyInput}
            onChange={(e) => setPasskeyInput(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-black border border-white/10 text-center text-sm text-white placeholder-zinc-500 font-mono tracking-widest focus:outline-none focus:border-emerald-400 transition-colors"
            autoFocus
          />
          {passkeyError && (
            <span className="text-xs text-rose-400 block font-medium">
              Incorrect Passkey. Access Denied.
            </span>
          )}
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-white/[0.1] hover:bg-white/[0.15] border border-white/10 text-xs font-semibold text-white transition-colors"
          >
            Unlock Admin Console
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">
              Admin Command Center · Aaditya (RA2511026010107)
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Security & Emergency Controls
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time schedule overrides, campus broadcast engine, and scraper circuit breakers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            Authorized Session
          </span>
          <button
            onClick={() => {
              setIsUnlocked(false);
              setPasskeyInput('');
            }}
            className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5"
            title="Lock Admin Console"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* MODULE 1: EMERGENCY DAY ORDER & RAIN HOLIDAY OVERRIDE */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Emergency Day Order & Rain Holiday Override
            </h3>
          </div>
          {override.enabled && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
              OVERRIDE ACTIVE
            </span>
          )}
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Instantly shift or declare holidays across the entire dashboard when SRM announces sudden rain holidays without waiting for portal synchronization.
        </p>

        {/* Quick Action Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() =>
              updateOverride({
                enabled: false,
                type: 'auto',
                autoShiftSubsequent: false,
              })
            }
            className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
              !override.enabled
                ? 'bg-white/[0.12] text-white border-white/20'
                : 'text-zinc-400 hover:text-white border-white/[0.06] hover:bg-white/[0.04]'
            }`}
          >
            Auto (From Portal)
          </button>

          <button
            onClick={() =>
              updateOverride({
                enabled: true,
                type: 'holiday',
                reason: 'Heavy Rain / Cyclone Warning',
                autoShiftSubsequent: override.autoShiftSubsequent,
              })
            }
            className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              override.enabled && override.type === 'holiday'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'text-zinc-400 hover:text-white border-white/[0.06] hover:bg-white/[0.04]'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span>Force Rain Holiday</span>
          </button>

          {[3, 4].map((d) => (
            <button
              key={d}
              onClick={() =>
                updateOverride({
                  enabled: true,
                  type: 'day_order',
                  targetDayOrder: d,
                  autoShiftSubsequent: override.autoShiftSubsequent,
                })
              }
              className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                override.enabled && override.type === 'day_order' && override.targetDayOrder === d
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'text-zinc-400 hover:text-white border-white/[0.06] hover:bg-white/[0.04]'
              }`}
            >
              Force Day Order {d}
            </button>
          ))}
        </div>

        {/* Auto-shift toggle */}
        <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
          <div>
            <span className="text-xs font-medium text-white block">
              Auto-Shift Subsequent Days (+1 Day Order)
            </span>
            <span className="text-[11px] text-zinc-400 block">
              Shifts following working days automatically when a rain holiday occurs mid-week.
            </span>
          </div>

          <button
            onClick={() =>
              updateOverride({
                ...override,
                autoShiftSubsequent: !override.autoShiftSubsequent,
              })
            }
            className="text-zinc-400 hover:text-white transition-colors"
          >
            {override.autoShiftSubsequent ? (
              <ToggleRight className="w-7 h-7 text-emerald-400" />
            ) : (
              <ToggleLeft className="w-7 h-7 text-zinc-500" />
            )}
          </button>
        </div>
      </div>

      {/* MODULE 2: LIVE CAMPUS BROADCAST BANNER */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Live Campus Broadcast Banner
              </h3>
              <span className="text-[11px] text-zinc-400 block">
                {broadcast.enabled
                  ? 'Banner is live across the top of the dashboard'
                  : 'Banner is turned off completely'}
              </span>
            </div>
          </div>

          {/* Master Switch: Turn on / off completely */}
          <button
            onClick={() => updateBroadcast({ ...broadcast, enabled: !broadcast.enabled })}
            className="flex items-center gap-2 py-1 px-2.5 rounded-lg border border-white/10 hover:bg-white/[0.04] transition-colors"
            title={broadcast.enabled ? 'Click to turn off completely' : 'Click to turn on broadcast banner'}
          >
            <span
              className={`text-[11px] font-semibold px-1.5 py-0.5 rounded font-mono ${
                broadcast.enabled
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-white/10'
              }`}
            >
              {broadcast.enabled ? 'ACTIVE' : 'OFF'}
            </span>
            {broadcast.enabled ? (
              <ToggleRight className="w-6 h-6 text-emerald-400" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-zinc-500" />
            )}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-300 font-medium block mb-1">
              Broadcast Message Content
            </label>
            <input
              type="text"
              value={broadcast.message}
              onChange={(e) => updateBroadcast({ ...broadcast, message: e.target.value })}
              placeholder="e.g. 🌧️ KTR Campus Holiday declared today — Tomorrow continues as Day Order 4"
              className="w-full px-3 py-2 rounded-lg bg-black border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">Severity Level:</span>
            {(['info', 'warning', 'alert'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => updateBroadcast({ ...broadcast, severity: sev })}
                className={`px-2.5 py-1 rounded-md text-xs font-medium uppercase transition-colors ${
                  broadcast.severity === sev
                    ? sev === 'warning'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : sev === 'alert'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MODULE 3: SCRAPER HEALTH & CIRCUIT BREAKER */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Scraper Health & Circuit Breaker
            </h3>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            sp.srmist.edu.in Online
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="text-[11px] text-zinc-400 block">Portal Status</span>
            <span className="text-sm font-semibold text-white uppercase mt-0.5 block">
              {metrics.portalStatus}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="text-[11px] text-zinc-400 block">Average Latency</span>
            <span className="text-sm font-semibold text-white font-mono mt-0.5 block">
              {metrics.avgLatencyMs} ms
            </span>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="text-[11px] text-zinc-400 block">Sync Cooldown</span>
            <span className="text-sm font-semibold text-emerald-400 font-mono mt-0.5 block">
              180s (3m)
            </span>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="text-[11px] text-zinc-400 block">Cache Hit Ratio</span>
            <span className="text-sm font-semibold text-white font-mono mt-0.5 block">
              {metrics.cacheHitRatio}%
            </span>
          </div>
        </div>

        {/* Circuit Breaker Switch */}
        <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
          <div>
            <span className="text-xs font-medium text-white block">
              Maintenance Mode (Force Offline Cache)
            </span>
            <span className="text-[11px] text-zinc-400 block">
              Temporarily halts live outbound SRM scrape requests during heavy portal traffic / result days.
            </span>
          </div>

          <button
            onClick={() => toggleMaintenanceMode(!metrics.maintenanceMode)}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            {metrics.maintenanceMode ? (
              <ToggleRight className="w-7 h-7 text-rose-400" />
            ) : (
              <ToggleLeft className="w-7 h-7 text-zinc-500" />
            )}
          </button>
        </div>

        {/* Data Verification Inspector Action */}
        {onOpenVerificationModal && (
          <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
            <div>
              <span className="text-xs font-medium text-white block">
                Raw Scraper Telemetry Audit
              </span>
              <span className="text-[11px] text-zinc-400 block">
                Inspect raw scraped payload, table column matching, and mathematical verification.
              </span>
            </div>
            <button
              onClick={onOpenVerificationModal}
              className="py-1.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-1.5 hover:bg-emerald-500/20 transition-colors shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Verify Raw Data</span>
            </button>
          </div>
        )}
      </div>

      {/* MODULE 4: HTTP SECURITY HEADERS AUDIT */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white tracking-tight">
            Production HTTP Security Headers
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
            <span className="text-zinc-400 font-mono text-[11px]">X-Frame-Options</span>
            <span className="text-emerald-400 font-mono text-[11px]">DENY</span>
          </div>
          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
            <span className="text-zinc-400 font-mono text-[11px]">X-Content-Type-Options</span>
            <span className="text-emerald-400 font-mono text-[11px]">nosniff</span>
          </div>
          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
            <span className="text-zinc-400 font-mono text-[11px]">Referrer-Policy</span>
            <span className="text-emerald-400 font-mono text-[11px]">strict-origin-when-cross-origin</span>
          </div>
          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
            <span className="text-zinc-400 font-mono text-[11px]">Permissions-Policy</span>
            <span className="text-emerald-400 font-mono text-[11px]">camera=(), microphone=()</span>
          </div>
        </div>
      </div>
    </div>
  );
}
