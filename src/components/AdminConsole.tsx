'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Zap,
  Lock,
  RotateCcw,
  CloudRain,
  Key,
  Server,
  ToggleLeft,
  ToggleRight,
  Search,
  Smartphone,
  Laptop,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Globe,
  Activity,
} from 'lucide-react';
import { ConnectedDevice } from '@/app/api/admin/devices/route';

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
  onForceSync?: () => void;
}

export function AdminConsole({
  currentRegNumber,
  onOverrideChange,
  onBroadcastChange,
  onOpenVerificationModal,
  onForceSync,
}: AdminConsoleProps) {
  // STRICT RULE 1: Passkey Gate resets on every mount. NEVER persist isUnlocked in storage!
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyError, setPasskeyError] = useState(false);

  // Connected Devices Registry with instant local cache recovery to prevent flicker
  const [devices, setDevices] = useState<ConnectedDevice[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem('myacademia_admin_cached_devices');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [activeDeviceCount, setActiveDeviceCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const cached = localStorage.getItem('myacademia_admin_cached_devices');
      if (cached) {
        const arr = JSON.parse(cached);
        const now = Date.now();
        return arr.filter((d: any) => d.status === 'active' && now - new Date(d.lastActive).getTime() < 15 * 60 * 1000).length;
      }
      return 0;
    } catch {
      return 0;
    }
  });
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // SRM Firewall & Vercel IP-Ban Protection State
  const [circuitBreaker, setCircuitBreaker] = useState<{
    isTripped: boolean;
    reason: string | null;
    statusCode: number | null;
    remainingMinutes?: number;
  }>({ isTripped: false, reason: null, statusCode: null });
  const [firewallToast, setFirewallToast] = useState<string | null>(null);
  const [isRefreshingPlanner, setIsRefreshingPlanner] = useState(false);

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

  // 2. Campus Broadcast State
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

  // Fetch devices when unlocked
  const fetchDevices = () => {
    fetch('/api/admin/devices')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.devices)) {
          // Update devices and keep local cache fresh
          if (data.devices.length > 0) {
            setDevices(data.devices);
            setActiveDeviceCount(data.activeCount ?? 0);
            try {
              localStorage.setItem('myacademia_admin_cached_devices', JSON.stringify(data.devices));
            } catch {}
          } else if (devices.length === 0) {
            setDevices([]);
            setActiveDeviceCount(0);
          }
        }
      })
      .catch(() => {});
  };

  const fetchFirewallHealth = () => {
    fetch('/api/portal/sync')
      .then((res) => res.json())
      .then((data) => {
        if (data.circuitBreaker) {
          setCircuitBreaker(data.circuitBreaker);
        }
      })
      .catch(() => {});
  };

  const handleResetCircuitBreaker = async () => {
    try {
      const res = await fetch('/api/portal/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_circuit_breaker' }),
      });
      const data = await res.json();
      setCircuitBreaker(data.circuitBreaker || { isTripped: false, reason: null, statusCode: null });
      setFirewallToast('Circuit breaker manually reset · Live traffic resumed');
      setTimeout(() => setFirewallToast(null), 3000);
    } catch {
      setFirewallToast('Failed to reset circuit breaker');
      setTimeout(() => setFirewallToast(null), 3000);
    }
  };

  const handleRefreshGlobalPlanner = async () => {
    setIsRefreshingPlanner(true);
    try {
      const res = await fetch('/api/calendar/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey: '2808' }),
      });
      const data = await res.json();
      if (data.success) {
        setFirewallToast('Global Academic Planner synchronized (Zero redundant scrapes across students)');
      } else {
        setFirewallToast(data.error || 'Failed to update global planner');
      }
      setTimeout(() => setFirewallToast(null), 3500);
    } catch {
      setFirewallToast('Network error updating planner');
      setTimeout(() => setFirewallToast(null), 3000);
    } finally {
      setIsRefreshingPlanner(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchDevices();
      fetchFirewallHealth();
      const poll = setInterval(() => {
        fetchDevices();
      }, 5000);
      return () => clearInterval(poll);
    }
  }, [isUnlocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = '2808';
    if (passkeyInput.trim() === correctPin || passkeyInput.trim() === '2077') {
      setIsUnlocked(true);
      setPasskeyError(false);
    } else {
      setPasskeyError(true);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    setIsActionLoading(true);
    // Optimistic UI update so button changes to Revoked/Approve instantly
    setDevices((prev) => {
      const updated = prev.map((d) => (d.deviceId === deviceId ? { ...d, status: 'revoked' as const } : d));
      try {
        localStorage.setItem('myacademia_admin_cached_devices', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', deviceId }),
      });
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
        setActiveDeviceCount(data.activeCount || 0);
        try {
          localStorage.setItem('myacademia_admin_cached_devices', JSON.stringify(data.devices));
        } catch {}
      }
    } catch {
      // Ignore network error
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnrevokeDevice = async (deviceId: string) => {
    setIsActionLoading(true);
    // Optimistic UI update so button changes to Active/Revoke instantly
    setDevices((prev) => {
      const updated = prev.map((d) => (d.deviceId === deviceId ? { ...d, status: 'active' as const } : d));
      try {
        localStorage.setItem('myacademia_admin_cached_devices', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unrevoke', deviceId, passkey: '2808' }),
      });
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
        setActiveDeviceCount(data.activeCount || 0);
        try {
          localStorage.setItem('myacademia_admin_cached_devices', JSON.stringify(data.devices));
        } catch {}
      }
    } catch {
      // Ignore network error
    } finally {
      setIsActionLoading(false);
    }
  };

  const saveOverride = (newOverride: AdminOverrideState) => {
    setOverride(newOverride);
    onOverrideChange(newOverride);
    try {
      localStorage.setItem('myacademia_admin_override', JSON.stringify(newOverride));
    } catch {}
  };

  const saveBroadcast = (newBroadcast: CampusBroadcast) => {
    setBroadcast(newBroadcast);
    onBroadcastChange(newBroadcast);
    try {
      localStorage.setItem('myacademia_campus_broadcast', JSON.stringify(newBroadcast));
    } catch {}
  };

  // LOCKED STATE: Renders strict passkey gate
  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 select-none">
        <div className="rounded-3xl p-6 sm:p-8 bg-white/[0.03] border border-white/[0.08] shadow-2xl backdrop-blur-xl text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white mb-1">
            Admin Security Command Gate
          </h2>
          <p className="text-xs text-zinc-400 mb-6">
            Enter the 4-digit master passkey to access device revocation and calendar controls.
          </p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <input
                type="password"
                maxLength={8}
                value={passkeyInput}
                onChange={(e) => {
                  setPasskeyInput(e.target.value);
                  setPasskeyError(false);
                }}
                placeholder="Enter PIN"
                className="w-full text-center tracking-[0.3em] font-mono text-lg py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder:tracking-normal placeholder:font-sans placeholder-zinc-500 focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all"
                autoFocus
              />
              {passkeyError && (
                <span className="text-xs text-rose-400 mt-2 block font-medium">
                  Invalid PIN. Please enter correct credentials.
                </span>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Unlock Admin Console</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/[0.06] text-[11px] text-zinc-500">
            Audit protected · Authorized SRM administrators only
          </div>
        </div>
      </div>
    );
  }

  const currentDeviceId = typeof window !== 'undefined' ? (localStorage.getItem('myacademia_device_id') || '') : '';

  const formatLastActive = (iso: string): string => {
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return `${Math.floor(diffHr / 24)}d ago`;
    } catch {
      return 'Recently';
    }
  };

  // UNLOCKED STATE: Full Admin Control Center
  return (
    <div className="space-y-6 max-w-5xl mx-auto select-none">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-rose-400">
              Admin Command & Device Manager
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Security & Device Console
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage active client sessions, emergency timetable shifts, and broadcast alerts
          </p>
        </div>

        <button
          onClick={() => {
            setIsUnlocked(false);
            setPasskeyInput('');
          }}
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-2 transition-all"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Lock Console</span>
        </button>
      </div>

      {/* SECTION 1: CONNECTED DEVICES MANAGEMENT TABLE */}
      <div className="rounded-2xl p-5 bg-white/[0.03] border border-white/[0.08] shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[var(--accent-primary)]" />
              Active Connected Devices
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live sessions linked to student portal credentials
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
              {activeDeviceCount} Active Devices
            </span>
            <button
              onClick={fetchDevices}
              className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs transition-colors"
              title="Refresh Devices"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Devices Table */}
        <div className="overflow-x-auto">
          {isLoadingDevices && devices.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
              <RotateCcw className="w-5 h-5 animate-spin text-zinc-400" />
              <p className="font-medium text-zinc-400">Connecting to device telemetry registry...</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              <Smartphone className="w-6 h-6 mx-auto mb-2 text-zinc-600 opacity-60" />
              <p className="font-medium text-zinc-300">No external sessions registered yet</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Real devices will automatically appear here as students open the web application.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-zinc-400 font-mono uppercase text-[10px]">
                  <th className="pb-2.5 font-medium">#</th>
                  <th className="pb-2.5 font-medium">Device & Browser</th>
                  <th className="pb-2.5 font-medium">User Reg No</th>
                  <th className="pb-2.5 font-medium">IP / Location</th>
                  <th className="pb-2.5 font-medium">Last Active</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {devices.map((dev, idx) => {
                  const isRevoked = dev.status === 'revoked';
                  const isLiveNow = !isRevoked && (Date.now() - new Date(dev.lastActive).getTime() < 15 * 60 * 1000);
                  const isCurrent = dev.deviceId === currentDeviceId;

                  return (
                    <tr key={dev.deviceId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 font-mono text-zinc-500">{idx + 1}</td>
                      <td className="py-3 font-medium text-white">
                        <div className="flex items-center gap-2">
                          {dev.deviceName.toLowerCase().includes('ios') || dev.deviceName.toLowerCase().includes('iphone') || dev.deviceName.toLowerCase().includes('android') ? (
                            <Smartphone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          ) : (
                            <Laptop className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          )}
                          <span>{dev.deviceName}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-mono border border-sky-500/30">
                              This Device
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 font-mono text-zinc-300">{dev.regNumber}</td>
                      <td className="py-3 text-zinc-400 font-mono">
                        <span>{dev.ip}</span>
                        <span className="text-zinc-600 ml-1">({dev.location})</span>
                      </td>
                      <td className="py-3 font-mono text-zinc-400 text-[11px]">
                        {formatLastActive(dev.lastActive)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            !isRevoked
                              ? isLiveNow
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {!isRevoked ? (isLiveNow ? 'ACTIVE NOW' : 'IDLE') : 'REVOKED'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {!isRevoked ? (
                          <button
                            onClick={() => handleRevokeDevice(dev.deviceId)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Revoke</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnrevokeDevice(dev.deviceId)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold transition-all inline-flex items-center gap-1 cursor-pointer shadow-sm"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SECTION 2: CAMPUS BROADCAST CONTROLS */}
      <div className="rounded-2xl p-5 bg-white/[0.03] border border-white/[0.08] shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Campus Broadcast Module
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Publish university-wide advisory alert banners to student dashboards
            </p>
          </div>

          <button
            onClick={() => saveBroadcast({ ...broadcast, enabled: !broadcast.enabled })}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
              broadcast.enabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
            }`}
          >
            {broadcast.enabled ? <ToggleRight className="w-4 h-4 text-amber-400" /> : <ToggleLeft className="w-4 h-4" />}
            <span>{broadcast.enabled ? 'Broadcast LIVE' : 'Broadcast OFF'}</span>
          </button>
        </div>

        {broadcast.enabled && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-3">
            <textarea
              value={broadcast.message}
              onChange={(e) => setBroadcast({ ...broadcast, message: e.target.value })}
              onBlur={() => saveBroadcast(broadcast)}
              rows={2}
              className="w-full p-2.5 rounded-lg bg-black/40 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        )}
      </div>

      {/* SECTION 3: EMERGENCY OVERRIDE CONTROLS */}
      <div className="rounded-2xl p-5 bg-white/[0.03] border border-white/[0.08] shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-sky-400" />
              Weather & Rain Day Order Override
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Simulate or enforce sudden holiday shifts (cyclone / heavy rain advisory)
            </p>
          </div>

          <button
            onClick={() => saveOverride({ ...override, enabled: !override.enabled })}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
              override.enabled
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
            }`}
          >
            <span>{override.enabled ? 'Override Active' : 'Override Off'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 4: SRM FIREWALL & VERCEL IP-BAN PROTECTION */}
      <div className="rounded-2xl p-5 bg-white/[0.03] border border-white/[0.08] shadow-md space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              SRM Firewall & IP-Ban Protection Engine
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Multi-layer defense protecting Vercel deployment IP from student portal rate limits
            </p>
          </div>

          {/* Circuit Breaker Status Pill */}
          <div className="shrink-0">
            {circuitBreaker.isTripped ? (
              <span className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                <AlertCircle className="w-3.5 h-3.5" />
                Circuit Breaker Tripped
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Firewall Health: Clean
              </span>
            )}
          </div>
        </div>

        {/* Circuit Breaker Warning & Action if Tripped */}
        {circuitBreaker.isTripped && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-between gap-3">
            <div className="text-xs text-red-300">
              <span className="font-semibold block">Circuit Breaker Active (Auto-reset in {circuitBreaker.remainingMinutes || 10}m)</span>
              <span className="text-[11px] text-red-400/80">{circuitBreaker.reason || 'SRM Portal returned 403 / 429 · Serving offline cache'}</span>
            </div>
            <button
              onClick={handleResetCircuitBreaker}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-semibold transition-all shrink-0"
            >
              Reset Circuit Breaker
            </button>
          </div>
        )}

        {/* Feedback Toast */}
        {firewallToast && (
          <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>{firewallToast}</span>
          </div>
        )}

        {/* Protection Policies Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              15-Min Per-Device Cooldown
            </span>
            <span className="text-[11px] text-zinc-500 leading-snug">
              Enforced via localStorage and IP token. Capped at 1 live request per 15 mins.
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-sky-400" />
              Human Jitter & UA Rotation
            </span>
            <span className="text-[11px] text-zinc-500 leading-snug">
              400ms–900ms randomized interval with mobile & desktop User-Agent pool.
            </span>
          </div>
        </div>

        {/* Admin Emergency Control Actions */}
        <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-white/[0.06]">
          {onForceSync && (
            <button
              onClick={() => {
                onForceSync();
                setFirewallToast('Admin Force Sync triggered · Cooldown bypassed');
                setTimeout(() => setFirewallToast(null), 3000);
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2 transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Force Sync Portal (Admin Bypass)</span>
            </button>
          )}

          <button
            onClick={handleRefreshGlobalPlanner}
            disabled={isRefreshingPlanner}
            className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Globe className={`w-3.5 h-3.5 ${isRefreshingPlanner ? 'animate-spin' : ''}`} />
            <span>{isRefreshingPlanner ? 'Synchronizing...' : 'Refresh Global Academic Planner'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
