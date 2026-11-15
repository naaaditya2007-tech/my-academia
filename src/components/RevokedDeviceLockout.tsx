'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Key, RefreshCw, Smartphone, Laptop, Lock } from 'lucide-react';

interface RevokedDeviceLockoutProps {
  deviceId: string;
  deviceName?: string;
  onUnlocked: () => void;
}

export function RevokedDeviceLockout({
  deviceId,
  deviceName = 'Device',
  onUnlocked,
}: RevokedDeviceLockoutProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isPolling, setIsPolling] = useState(true);

  // Poll cloud registry every 1.5s: if Admin clicks "Approve / Unrevoke" in console, unlock instantly!
  useEffect(() => {
    let active = true;

    const interval = setInterval(async () => {
      if (!deviceId || !active) return;
      try {
        const res = await fetch('/api/admin/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check_status', deviceId }),
        });
        const data = await res.json();
        if (data.success && !data.revoked) {
          localStorage.removeItem('myacademia_device_revoked');
          onUnlocked();
        }
      } catch {}
    }, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [deviceId, onUnlocked]);

  const handleAuthorizeWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsAuthorizing(true);

    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unrevoke', deviceId, passkey: pin.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.removeItem('myacademia_device_revoked');
        onUnlocked();
      } else {
        setError(data.error || 'Invalid administrator master PIN.');
      }
    } catch {
      setError('Connection failed. Please retry.');
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-[#0A0D14] flex items-center justify-center p-4 text-white select-none">
      {/* Volumetric background glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, transparent 70%)' }}
      />

      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#121622]/95 border border-rose-500/30 shadow-[0_20px_60px_rgba(239,68,68,0.2)] backdrop-blur-2xl text-center relative z-10">
        {/* Pulsing Shield Icon */}
        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-5 shadow-lg relative">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Device Access Revoked
        </h1>
        <p className="text-xs text-zinc-400 leading-relaxed mb-6">
          This device was disconnected by the administrator. Administrator permission is required to re-enter MyAcademia.
        </p>

        {/* Device Information Pill */}
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-left text-xs space-y-2 mb-6">
          <div className="flex items-center justify-between text-zinc-300">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5" />
              <span>Device Name</span>
            </span>
            <span className="font-medium text-white truncate max-w-[200px]">{deviceName}</span>
          </div>

          <div className="flex items-center justify-between text-zinc-300">
            <span className="text-zinc-500 font-mono">Device ID</span>
            <span className="font-mono text-[11px] text-zinc-400 truncate max-w-[180px]">{deviceId}</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
            <span className="text-zinc-500">Security Status</span>
            <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 font-semibold text-[10px] tracking-wide uppercase">
              Revoked · Locked
            </span>
          </div>
        </div>

        {/* Real-time Approval Listener Indicator */}
        <div className="mb-6 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-2 text-xs text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Waiting for administrator approval in Admin Console...</span>
        </div>

        {/* Master PIN Authorize Gate */}
        <form onSubmit={handleAuthorizeWithPin} className="space-y-3 pt-2 border-t border-white/[0.08]">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
            <span>Admin Instant Override</span>
            <span className="text-zinc-500">Master Passkey</span>
          </div>

          <input
            type="password"
            maxLength={8}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError('');
            }}
            placeholder="Enter PIN"
            className="w-full text-center tracking-[0.25em] font-mono text-base py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder:tracking-normal placeholder:font-sans placeholder-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
          />

          {error && (
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={isAuthorizing || !pin.trim()}
            className="w-full py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isAuthorizing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Key className="w-3.5 h-3.5" />
            )}
            <span>Authorize & Unlock Device</span>
          </button>
        </form>

        <p className="mt-5 text-[11px] text-zinc-500">
          Zero-Trust Device Revocation · Real-Time Security Engine
        </p>
      </div>
    </div>
  );
}
