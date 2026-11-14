'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Key,
  Lock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  LockKeyhole,
  Database,
  Smartphone,
} from 'lucide-react';

interface LoginSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncSuccess: (data: any) => void;
  onPurgeComplete?: () => void;
}

export function LoginSyncModal({
  isOpen,
  onClose,
  onSyncSuccess,
  onPurgeComplete,
}: LoginSyncModalProps) {
  const [sessionCookie, setSessionCookie] = useState('');
  const [netId, setNetId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/academia/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portal: 'student_portal',
          sessionCookie: sessionCookie.trim() || undefined,
          netId: netId.trim() || undefined,
          password: password || undefined,
          force: true, // Manual portal connect bypasses 3-min cooldown
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setMessage({
          type: 'success',
          text: json.source === 'live_student_portal'
            ? 'Successfully synced from SRM Student Portal!'
            : 'Synchronized and cached locally!',
        });
        setTimeout(() => {
          onSyncSuccess(json.data);
          onClose();
        }, 800);
      } else {
        setMessage({
          type: 'error',
          text: json.message || json.error || 'Failed to authenticate with student portal',
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Network error occurred while syncing',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurgeAndDisconnect = async () => {
    if (!confirm('Are you sure you want to purge all local cached academic records and session encryption cookies?')) {
      return;
    }

    setIsPurging(true);
    try {
      // 1. Invalidate encrypted server cookies
      await fetch('/api/academia/logout', { method: 'POST' });

      // 2. Wipe client-side storage keys
      const keysToRemove = [
        'myacademia_auth_user',
        'last_sync_timestamp',
        'myacademia_data_v7',
        'myacademia_data_v6',
        'myacademia_data_v5',
        'myacademia_data_v3',
        'campuscore_data_v3',
        'myacademia_theme',
        'campuscore_theme_prefs',
        'myacademia_last_sync',
        'myacademia_stealth_mode',
        'myacademia_admin_override',
        'myacademia_campus_broadcast',
      ];
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      setMessage({
        type: 'success',
        text: 'Local device cache wiped & session cookies expired.',
      });

      setTimeout(() => {
        onPurgeComplete?.();
        window.location.reload();
      }, 900);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: 'Failed to purge session cookies.',
      });
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-white/[0.08] bg-[#0E1015]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-white tracking-tight">
                Connect Student Portal
              </h3>
              <p className="text-xs text-zinc-400">
                Direct Sync with sp.srmist.edu.in
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* ZERO-KNOWLEDGE SECURITY & PRIVACY TRUST BADGE */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <LockKeyhole className="w-3.5 h-3.5 text-emerald-400" />
                Zero-Knowledge Security Architecture
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                AES-256-GCM
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-zinc-400">
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/[0.02]">
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Encrypted Cookie</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/[0.02]">
                <Database className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Zero Server Passwords</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/[0.02]">
                <Smartphone className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Offline-First Storage</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSync} className="space-y-3.5">
            {/* Session Token / NetID fields */}
            <div>
              <label className="text-xs text-zinc-300 font-medium block mb-1">
                Option A: Fast Sync via Active JSESSIONID Cookie
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Paste JSESSIONID cookie value from browser..."
                  value={sessionCookie}
                  onChange={(e) => setSessionCookie(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition-colors font-mono"
                />
                <Key className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-2.5" />
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                DevTools &gt; Application &gt; Cookies &gt; JSESSIONID
              </span>
            </div>

            <div className="flex items-center my-1.5">
              <div className="flex-1 h-[1px] bg-white/[0.06]" />
              <span className="px-2 text-[10px] text-zinc-400 uppercase">Or</span>
              <div className="flex-1 h-[1px] bg-white/[0.06]" />
            </div>

            <div>
              <label className="text-xs text-zinc-300 font-medium block mb-1">
                Option B: NetID Credentials (Memory Only)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="NetID (e.g. an1328)"
                  value={netId}
                  onChange={(e) => setNetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition-colors"
                />
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Portal Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition-colors pr-8"
                  />
                  <Lock className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-2.5" />
                </div>
              </div>
            </div>

            {/* Feedback message */}
            {message && (
              <div
                className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-white/[0.06]">
              {/* Purge Local Cache Button */}
              <button
                type="button"
                onClick={handlePurgeAndDisconnect}
                disabled={isPurging || isLoading}
                className="py-1.5 px-3 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors text-xs font-medium flex items-center gap-1.5"
                title="Wipe cached attendance records and clear session cookies"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPurging ? 'Purging...' : 'Purge Cache'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || isPurging}
                  className="px-4 py-1.5 rounded-lg bg-white/[0.1] hover:bg-white/[0.15] border border-white/10 text-white font-medium text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <span>Sync Now</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
