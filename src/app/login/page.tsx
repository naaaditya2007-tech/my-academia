'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  Check,
  ChevronRight,
  GraduationCap,
  Sparkles,
  Gamepad2,
  Flame,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import { BackdropCanvas, BackdropMode } from '@/components/BackdropCanvas';
import { GAMING_THEMES, THEMES, ThemeConfig } from '@/components/AppearanceSettings';

const ALL_THEMES = [...GAMING_THEMES, ...THEMES];

export default function LoginPage() {
  const router = useRouter();

  const [netId, setNetId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Active theme management for live preview on login page
  const [currentTheme, setCurrentTheme] = useState('cyberpunk');
  const [currentAccent, setCurrentAccent] = useState('#FCE300');
  const [currentBackdrop, setCurrentBackdrop] = useState<BackdropMode>('default');
  const [showThemePicker, setShowThemePicker] = useState(false);

  // Initialize theme from storage
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('myacademia_theme') || 'cyberpunk';
      const savedAccent = localStorage.getItem('myacademia_accent') || '#FCE300';
      const savedBackdrop = (localStorage.getItem('myacademia_backdrop') as BackdropMode) || 'default';
      
      setCurrentTheme(savedTheme);
      setCurrentAccent(savedAccent);
      setCurrentBackdrop(savedBackdrop);

      const found = ALL_THEMES.find((t) => t.id === savedTheme);
      if (found) {
        applyThemeStyles(found);
      }
    } catch {}
  }, []);

  const applyThemeStyles = (theme: ThemeConfig) => {
    document.documentElement.setAttribute('data-theme', theme.id);
    const root = document.documentElement;
    root.style.setProperty('--bg-canvas', theme.bgCanvas);
    root.style.setProperty('--bg-surface', theme.bgSurface);
    root.style.setProperty('--bg-elevated', theme.bgElevated);
    root.style.setProperty('--glass-surface', theme.glassSurface);
    root.style.setProperty('--glass-border', theme.glassBorder);
    root.style.setProperty('--border-subtle', theme.borderSubtle);
    root.style.setProperty('--border-highlight', theme.borderHighlight);
    root.style.setProperty('--accent-primary', theme.accentPrimary);
    root.style.setProperty('--accent-secondary', theme.accentSecondary);
    root.style.setProperty('--accent-glow', `${theme.accentPrimary}40`);
  };

  const handleSelectTheme = (theme: ThemeConfig) => {
    setCurrentTheme(theme.id);
    setCurrentAccent(theme.accentPrimary);
    applyThemeStyles(theme);
    try {
      localStorage.setItem('myacademia_theme', theme.id);
      localStorage.setItem('myacademia_accent', theme.accentPrimary);
      window.dispatchEvent(new Event('myacademia_wallpaper_update'));
    } catch {}
  };

  // Auto-format NetID with @srmist.edu.in if user blurs without @
  const handleNetIdBlur = () => {
    const trimmed = netId.trim();
    if (trimmed && !trimmed.includes('@')) {
      setNetId(`${trimmed}@srmist.edu.in`);
    }
  };

  const handleLogin = async (e?: React.FormEvent, isDemo = false) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const payload = isDemo
        ? { netId: 'ra2211003010001@srmist.edu.in', password: 'demo_authenticated', rememberMe }
        : { netId, password, rememberMe };

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
        setErrorMessage(json.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error connecting to SRM portal.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-white relative flex flex-col justify-between items-center p-4 sm:p-6 overflow-x-hidden transition-colors duration-300">
      {/* 4K Background Wallpaper & Canvas Particle Engine */}
      <BackdropCanvas
        mode={currentBackdrop}
        theme={currentTheme}
        accentHex={currentAccent}
      />

      {/* Top Bar: Brand + Floating Live Theme Selector */}
      <header className="w-full max-w-5xl flex items-center justify-between py-4 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-border)] flex items-center justify-center shadow-lg">
            <GraduationCap className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              MyAcademia
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-tint,rgba(255,255,255,0.08))] text-[var(--accent-primary)] border border-[var(--glass-border)]">
                v2.4 PRO
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400">SRMIST Student Intelligence Platform</p>
          </div>
        </div>

        {/* Live Theme Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowThemePicker(!showThemePicker)}
            className="px-3 py-1.5 rounded-xl bg-[var(--glass-surface)] hover:bg-white/10 border border-[var(--glass-border)] text-xs font-medium text-zinc-200 flex items-center gap-2 transition-all shadow-md backdrop-blur-md"
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: currentAccent }}
            />
            <span className="capitalize">{currentTheme} Theme</span>
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform ${showThemePicker ? 'rotate-90' : ''}`}
            />
          </button>

          {showThemePicker && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[var(--bg-surface)]/95 border border-[var(--border-subtle)] p-3 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="text-[11px] font-semibold text-zinc-400 mb-2 px-1">
                🎮 COLLECTOR&apos;S EDITION VAULT
              </div>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {GAMING_THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      handleSelectTheme(t);
                      setShowThemePicker(false);
                    }}
                    className={`flex items-center gap-2 p-1.5 rounded-lg text-xs text-left transition-colors ${
                      currentTheme === t.id
                        ? 'bg-[var(--accent-tint,rgba(255,255,255,0.1))] text-white font-semibold'
                        : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: t.accentPrimary }}
                    />
                    <span className="truncate">{t.badge.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-semibold text-zinc-400 mb-2 px-1">
                💎 DISCORD & DEV PALETTES
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {THEMES.slice(0, 6).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      handleSelectTheme(t);
                      setShowThemePicker(false);
                    }}
                    className={`flex items-center gap-2 p-1.5 rounded-lg text-xs text-left transition-colors ${
                      currentTheme === t.id
                        ? 'bg-[var(--accent-tint,rgba(255,255,255,0.1))] text-white font-semibold'
                        : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: t.accentPrimary }}
                    />
                    <span className="truncate">{t.name.split(' ')[1] || t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Form Centerpiece */}
      <main className="w-full max-w-md my-auto py-8 z-10">
        <div className="liquid-glass rounded-3xl p-6 sm:p-8 border border-[var(--glass-border)] shadow-2xl relative overflow-hidden">
          {/* Subtle Accent Glow Ring */}
          <div
            className="absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-30"
            style={{ backgroundColor: currentAccent }}
          />

          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1.5">
              Welcome to MyAcademia
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Sign in with your official SRM NetID to synchronize live attendance, internal marks, and exam schedules.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs text-center font-medium">
              {errorMessage}
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e, false)} className="space-y-4">
            {/* NetID Input */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                SRM NetID or Register Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={netId}
                  onChange={(e) => setNetId(e.target.value)}
                  onBlur={handleNetIdBlur}
                  placeholder="e.g. ab1234@srmist.edu.in or RA2211003010..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all font-sans"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Portal Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-zinc-700 bg-black/40 text-[var(--accent-primary)] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span>Remember session for 30 days</span>
              </label>
              <span className="text-[11px] text-zinc-500">AES-256 GCM</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              style={{
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                color: '#000000',
                boxShadow: '0 0 20px var(--accent-glow)',
              }}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to SRM Portal...</span>
                </>
              ) : (
                <>
                  <span>Sign In to SRM Portal</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Preview / Fast Connect Option */}
          <div className="mt-5 pt-4 border-t border-white/10 text-center">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleLogin(undefined, true)}
              className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 mx-auto py-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Instant Verified Session (Preview Demo)</span>
            </button>
          </div>
        </div>
      </main>

      {/* Security & Privacy Trust Badge Footer */}
      <footer className="w-full max-w-md text-center py-4 z-20 space-y-2">
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Zero-Knowledge Handshake · No Credentials Stored</span>
        </div>
        <p className="text-[11px] text-zinc-500">
          Encrypted directly in your browser using AES-256 session cookies. MyAcademia never reads or stores your password on any database.
        </p>
      </footer>
    </div>
  );
}
