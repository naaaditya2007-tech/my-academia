'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { RevokedDeviceLockout } from '@/components/RevokedDeviceLockout';

export default function LoginPage() {
  const router = useRouter();

  const [netId, setNetId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [technicalReason, setTechnicalReason] = useState('');
  const [isDeviceRevoked, setIsDeviceRevoked] = useState(false);
  const [activeDeviceId, setActiveDeviceId] = useState('');
  const [activeDeviceName, setActiveDeviceName] = useState('Desktop Workstation');

  useEffect(() => {
    let active = true;
    let deviceId = '';

    try {
      if (localStorage.getItem('myacademia_device_revoked') === 'true') {
        setIsDeviceRevoked(true);
      }
    } catch {
      // LocalStorage access restricted
    }

    // Register active visitor device in Admin Console
    try {
      deviceId = localStorage.getItem('myacademia_device_id') || '';
      if (!deviceId) {
        deviceId = `dev_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
        localStorage.setItem('myacademia_device_id', deviceId);
      }
      setActiveDeviceId(deviceId);

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      let deviceName = 'Desktop Workstation';
      if (/iPhone/i.test(ua)) deviceName = 'iPhone · iOS Safari';
      else if (/iPad/i.test(ua)) deviceName = 'iPad · Safari Mobile';
      else if (/Android/i.test(ua)) deviceName = 'Android · Chrome Mobile';
      else if (/Macintosh|Mac OS X/i.test(ua)) deviceName = 'MacBook Pro · macOS Safari';
      else if (/Windows/i.test(ua)) deviceName = 'Windows 11 · Chrome/Edge';
      setActiveDeviceName(deviceName);

      fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          deviceId,
          deviceName,
          regNumber: 'Guest / Login Screen',
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.revoked) {
            localStorage.setItem('myacademia_device_revoked', 'true');
            setIsDeviceRevoked(true);
          }
        })
        .catch(() => {});
    } catch {}

    // Fast 1.5s revocation heartbeat so device is immediately locked out upon admin revocation
    const pollStatus = () => {
      if (!deviceId || !active) return;
      fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_status', deviceId }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.revoked) {
            localStorage.setItem('myacademia_device_revoked', 'true');
            setIsDeviceRevoked(true);
          } else {
            localStorage.removeItem('myacademia_device_revoked');
            setIsDeviceRevoked(false);
          }
        })
        .catch(() => {});
    };

    pollStatus();
    const interval = setInterval(pollStatus, 1500);
    window.addEventListener('focus', pollStatus);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', pollStatus);
    };
  }, []);

  const handleNetIdBlur = () => {
    const trimmed = netId.trim();
    if (trimmed && !trimmed.includes('@') && !/^RA\d+/i.test(trimmed)) {
      setNetId(`${trimmed}@srmist.edu.in`);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setTechnicalReason('');
    setIsLoading(true);

    try {
      if (!netId.trim() || !password) {
        setErrorMessage('Please enter both your SRM NetID and password.');
        setTechnicalReason('NetID and password fields are required');
        setIsLoading(false);
        return;
      }

      const payload = {
        netId: netId.trim(),
        password,
        rememberMe,
        deviceId: activeDeviceId,
      };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.status === 403 || json.revoked) {
        localStorage.setItem('myacademia_device_revoked', 'true');
        setIsDeviceRevoked(true);
        setErrorMessage('Device access has been revoked by administrator.');
        setTechnicalReason(json.technicalReason || 'Zero-trust registry revoked device ID');
        return;
      }

      if (json.success && json.data) {
        // Zero-bleed: Purge any old cached sessions from other users
        localStorage.removeItem('myacademia_data_v6');
        const resolvedUser =
          json.data.student?.regNumber ||
          json.data.student?.email ||
          payload.netId ||
          'student@srmist.edu.in';
        localStorage.setItem(`myacademia_data_${resolvedUser}`, JSON.stringify(json.data));
        localStorage.setItem('myacademia_data_v7', JSON.stringify(json.data));
        localStorage.setItem('myacademia_auth_user', resolvedUser);

        // Update device registry with real authenticated student ID
        if (activeDeviceId) {
          fetch('/api/admin/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'register',
              deviceId: activeDeviceId,
              regNumber: resolvedUser,
            }),
          }).catch(() => {});
        }

        router.push('/');
      } else {
        setErrorMessage(json.error || 'Authentication failed. Please check credentials.');
        setTechnicalReason(json.technicalReason || '');
      }
    } catch (err: any) {
      setErrorMessage('Unable to connect to SRM Academia.');
      setTechnicalReason(err?.message || 'Network communication error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isDeviceRevoked) {
    return (
      <RevokedDeviceLockout
        deviceId={activeDeviceId}
        deviceName={activeDeviceName}
        onUnlocked={() => {
          setIsDeviceRevoked(false);
          localStorage.removeItem('myacademia_device_revoked');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1017] text-white relative flex flex-col items-center justify-center px-4 overflow-hidden select-none">
      {/* Subtle Volumetric Light behind center */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full blur-[100px] opacity-70"
        style={{
          background:
            'radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.12) 0%, rgba(56, 189, 248, 0.06) 40%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[340px] opacity-40 blur-[80px]"
        style={{
          background:
            'linear-gradient(-35deg, rgba(99, 102, 241, 0.09) 0%, rgba(56, 189, 248, 0.04) 50%, transparent 100%)',
        }}
      />

      {/* Top Left Navigation Pill */}
      <div className="fixed top-5 left-5 z-20">
        <div className="inline-flex items-center gap-2 bg-[#1C202B] border border-white/[0.07] text-zinc-300 text-xs px-3.5 py-2 rounded-lg shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="font-medium tracking-tight">MyAcademia · SRM KTR</span>
        </div>
      </div>

      {/* Main Centered Column (No Outer Card Box) */}
      <div className="w-full max-w-[380px] mx-auto z-10 flex flex-col items-center">
        {/* Tactile 3D Squircle Icon */}
        <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-b from-[#252A3A] to-[#161923] border border-white/[0.1] shadow-[0_10px_25px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] flex items-center justify-center shrink-0">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white"
          >
            <path d="M4 19V5l8 7 8-7v14" />
          </svg>
        </div>

        {/* Heading & Subheading */}
        <h1 className="mt-6 text-[28px] font-semibold tracking-tight text-white text-center leading-tight">
          Welcome back
        </h1>
        <p className="mt-2 text-xs text-zinc-400 text-center leading-relaxed">
          Sign in with your SRM NetID to access your academia dashboard
        </p>

        {/* Informative Error Alert with Detailed Technical Reason */}
        {errorMessage && (
          <div className="w-full mt-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-left space-y-1">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            {technicalReason && (
              <div className="pl-6 text-[11px] font-mono text-rose-300/80 leading-relaxed break-words">
                Diagnostic: {technicalReason}
              </div>
            )}
          </div>
        )}

        {/* Clean Login Form */}
        <form onSubmit={handleLogin} className="w-full mt-6 space-y-4">
          {/* SRM NetID Input */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              SRM NetID (Email or Username)
            </label>
            <input
              type="text"
              required
              value={netId}
              onChange={(e) => setNetId(e.target.value)}
              onBlur={handleNetIdBlur}
              placeholder="e.g. ab1234 or ab1234@srmist.edu.in"
              className="w-full h-11 px-3.5 rounded-lg bg-[#1E222D]/90 border border-white/[0.08] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#6366F1]/60 focus:ring-2 focus:ring-[#6366F1]/20 transition-all font-sans"
            />
          </div>

          {/* Portal Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-zinc-400">
                Portal Password
              </label>
              <span className="text-[11px] text-zinc-500 font-mono">
                academia.srmist.edu.in
              </span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-11 px-3.5 pr-10 rounded-lg bg-[#1E222D]/90 border border-white/[0.08] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#6366F1]/60 focus:ring-2 focus:ring-[#6366F1]/20 transition-all font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-400 hover:text-zinc-300 transition-colors">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-white/20 bg-[#1E222D] text-[#6366F1] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>Remember session for 30 days</span>
            </label>
          </div>

          {/* Primary Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-lg font-medium text-xs sm:text-sm text-white bg-gradient-to-r from-[#5B6AF0] via-[#6875F5] to-[#56A8F5] hover:brightness-110 active:scale-[0.99] shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all flex items-center justify-center disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating with SRM Academia...</span>
              </div>
            ) : (
              <span>Sign in to MyAcademia</span>
            )}
          </button>
        </form>

        {/* Minimal Footer */}
        <p className="mt-8 text-[11px] leading-relaxed text-zinc-500 text-center max-w-[320px]">
          Direct Zoho IAM authentication with SRM Academia. Zero credentials stored on server.
        </p>
      </div>
    </div>
  );
}
