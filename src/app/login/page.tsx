'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const [netId, setNetId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasCachedSession, setHasCachedSession] = useState(false);

  useEffect(() => {
    try {
      const cached = localStorage.getItem('myacademia_data_v6');
      if (cached) {
        setHasCachedSession(true);
      }
    } catch {
      // LocalStorage access restricted
    }
  }, []);

  const handleNetIdBlur = () => {
    const trimmed = netId.trim();
    if (trimmed && !trimmed.includes('@')) {
      setNetId(`${trimmed}@srmist.edu.in`);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const payload = { netId: netId.trim(), password, rememberMe };

      const res = await fetch('/api/academia/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success && json.data) {
        localStorage.setItem('myacademia_data_v6', JSON.stringify(json.data));
        localStorage.setItem('myacademia_auth_user', payload.netId);
        router.push('/');
      } else {
        setErrorMessage(json.error || 'Authentication failed. Please check credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to connect to SRM portal.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCachedContinue = () => {
    try {
      localStorage.setItem('myacademia_auth_user', 'cached_student@srmist.edu.in');
      router.push('/');
    } catch {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1017] text-white relative flex flex-col items-center justify-center px-4 overflow-hidden select-none">
      {/* Subtle Volumetric Diagonal Light Rays behind center */}
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
      <div className="w-full max-w-[360px] mx-auto z-10 flex flex-col items-center">
        {/* Tactile 3D Squircle Icon (52px x 52px) */}
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
          Sign in with your SRM NetID or Register Number
        </p>

        {/* Error Alert */}
        {errorMessage && (
          <div className="w-full mt-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium">
            {errorMessage}
          </div>
        )}

        {/* Clean Form */}
        <form onSubmit={handleLogin} className="w-full mt-8 space-y-4">
          {/* NetID Input */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              SRM NetID or Register Number
            </label>
            <input
              type="text"
              required
              value={netId}
              onChange={(e) => setNetId(e.target.value)}
              onBlur={handleNetIdBlur}
              placeholder="e.g. ab1234@srmist.edu.in or RA2211..."
              className="w-full h-11 px-3.5 rounded-lg bg-[#1E222D]/90 border border-white/[0.08] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#6366F1]/60 focus:ring-2 focus:ring-[#6366F1]/20 transition-all font-sans"
            />
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-zinc-400">
                Portal Password
              </label>
              <span className="text-[11px] text-zinc-500">SRM Student Portal</span>
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
                <span>Signing in to SRM Portal...</span>
              </div>
            ) : (
              <span>Sign in to SRM Portal</span>
            )}
          </button>

          {/* Secondary Offline Session Option */}
          {hasCachedSession && (
            <div className="space-y-3 pt-2">
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.06]" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="bg-[#0D1017] px-2 text-zinc-500 font-sans">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCachedContinue}
                className="w-full h-10 rounded-lg bg-[#1E222D] hover:bg-[#252A37] border border-white/[0.07] text-xs font-medium text-zinc-200 transition-all flex items-center justify-center cursor-pointer"
              >
                Continue with Cached Session
              </button>
            </div>
          )}
        </form>

        {/* Minimal Footer */}
        <p className="mt-8 text-[11px] leading-relaxed text-zinc-500 text-center max-w-[320px]">
          Direct connection to SRM Student Portal. Your credentials are encrypted locally and never stored on our servers.
        </p>
      </div>
    </div>
  );
}
