'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Check,
  Palette,
  Eye,
  Sliders,
  RotateCcw,
  Waves,
  Cpu,
  Layers,
  CircleDot,
  Radio,
  Gamepad2,
  Shield,
  EyeOff,
  Flame,
} from 'lucide-react';
import { BackdropMode } from './BackdropCanvas';

export interface ThemeConfig {
  id: string;
  name: string;
  badge: string;
  vibe: string;
  bgCanvas: string;
  bgSurface: string;
  bgElevated: string;
  glassSurface: string;
  glassBorder: string;
  borderSubtle: string;
  borderHighlight: string;
  accentPrimary: string;
  accentSecondary: string;
  easterEggHint?: string;
  gameTag?: string;
}

// 1. COLLECTOR'S EDITION: PC GAMING VAULT THEMES
export const GAMING_THEMES: ThemeConfig[] = [
  {
    id: 'cyberpunk',
    name: 'Night City Mercenary',
    badge: 'Cyberpunk 2077',
    gameTag: 'Cyberpunk 2077',
    vibe: 'Arasaka Obsidian with Relic Cyan and Neon Yellow HUD',
    bgCanvas: '#050308',
    bgSurface: '#12091A',
    bgElevated: '#1B0F26',
    glassSurface: 'rgba(18, 9, 26, 0.78)',
    glassBorder: 'rgba(0, 240, 255, 0.28)',
    borderSubtle: 'rgba(0, 240, 255, 0.25)',
    borderHighlight: 'rgba(252, 227, 0, 0.5)',
    accentPrimary: '#FCE300',
    accentSecondary: '#00F0FF',
    easterEggHint: '🥚 Secret: Click Samurai Oni mask for Relic Glitch & Johnny quote',
  },
  {
    id: 'gta',
    name: 'Los Santos Syndicate',
    badge: 'GTA V Online',
    gameTag: 'Grand Theft Auto V',
    vibe: 'Midnight asphalt with Vinewood fuchsia and heist neon',
    bgCanvas: '#08080C',
    bgSurface: '#14141E',
    bgElevated: '#1F1F2E',
    glassSurface: 'rgba(20, 20, 30, 0.78)',
    glassBorder: 'rgba(235, 110, 255, 0.28)',
    borderSubtle: 'rgba(235, 110, 255, 0.22)',
    borderHighlight: 'rgba(0, 255, 163, 0.5)',
    accentPrimary: '#EB6EFF',
    accentSecondary: '#00FFA3',
    easterEggHint: '🥚 Secret: Type "LAWYERUP" to clear wanted stars or "TURTLE" for armor',
  },
  {
    id: 'godofwar',
    name: 'Ghost of Sparta',
    badge: 'God of War Ragnarök',
    gameTag: 'God of War Ragnarök',
    vibe: 'Fimbulwinter Norse slate with Leviathan frost and Blades of Chaos glow',
    bgCanvas: '#0B0D13',
    bgSurface: '#151A24',
    bgElevated: '#1F2736',
    glassSurface: 'rgba(21, 26, 36, 0.78)',
    glassBorder: 'rgba(147, 197, 253, 0.25)',
    borderSubtle: 'rgba(147, 197, 253, 0.22)',
    borderHighlight: 'rgba(255, 69, 0, 0.5)',
    accentPrimary: '#93C5FD',
    accentSecondary: '#FF4500',
    easterEggHint: '🥚 Secret: Press "R" or click Ω symbol for 8s Spartan Rage',
  },
  {
    id: 'tlou',
    name: 'Firefly Overgrowth',
    badge: 'The Last of Us',
    gameTag: 'The Last of Us',
    vibe: 'Post-pandemic Seattle moss with bioluminescent fungal gold',
    bgCanvas: '#0A0E0C',
    bgSurface: '#131A16',
    bgElevated: '#1B2620',
    glassSurface: 'rgba(19, 26, 22, 0.78)',
    glassBorder: 'rgba(217, 119, 6, 0.28)',
    borderSubtle: 'rgba(217, 119, 6, 0.22)',
    borderHighlight: 'rgba(132, 204, 22, 0.5)',
    accentPrimary: '#D97706',
    accentSecondary: '#84CC16',
    easterEggHint: '🥚 Secret: Press "F" for Joel\'s Flashlight or hold "Q" for Listen Mode',
  },
  {
    id: 'rdr2',
    name: 'Outlaw Redemption',
    badge: 'Red Dead Redemption 2',
    gameTag: 'Red Dead Redemption 2',
    vibe: 'Frontier prairie twilight with campfire embers and Dead Eye sepia',
    bgCanvas: '#0E0909',
    bgSurface: '#1C1212',
    bgElevated: '#2A1B1B',
    glassSurface: 'rgba(28, 18, 18, 0.78)',
    glassBorder: 'rgba(220, 38, 38, 0.28)',
    borderSubtle: 'rgba(220, 38, 38, 0.22)',
    borderHighlight: 'rgba(245, 158, 11, 0.5)',
    accentPrimary: '#DC2626',
    accentSecondary: '#F59E0B',
    easterEggHint: '🥚 Secret: Press "X" or click Arthur for 4s Dead Eye targeting',
  },
  {
    id: 'ghost',
    name: 'Ghost of Iki',
    badge: 'Ghost of Tsushima',
    gameTag: 'Ghost of Tsushima',
    vibe: 'Sakai clan inkstone with Japanese autumn leaves and Torii vermilion',
    bgCanvas: '#090B0F',
    bgSurface: '#121720',
    bgElevated: '#1A212E',
    glassSurface: 'rgba(18, 23, 32, 0.78)',
    glassBorder: 'rgba(225, 29, 72, 0.28)',
    borderSubtle: 'rgba(225, 29, 72, 0.22)',
    borderHighlight: 'rgba(56, 189, 248, 0.5)',
    accentPrimary: '#E11D48',
    accentSecondary: '#38BDF8',
    easterEggHint: '🥚 Secret: Press "G" for Guiding Wind or click Torii for Haiku modal',
  },
];

// 2. STANDARD NITRO & DEV THEMES
export const THEMES: ThemeConfig[] = [
  {
    id: 'blurple',
    name: 'Midnight Blurple',
    badge: 'Discord Signature',
    vibe: 'Classic Discord dark slate with electric Blurple accents',
    bgCanvas: '#0E1015',
    bgSurface: '#181920',
    bgElevated: '#22242E',
    glassSurface: 'rgba(24, 25, 32, 0.72)',
    glassBorder: 'rgba(88, 101, 242, 0.22)',
    borderSubtle: 'rgba(88, 101, 242, 0.22)',
    borderHighlight: 'rgba(88, 101, 242, 0.45)',
    accentPrimary: '#5865F2',
    accentSecondary: '#EB459E',
  },
  {
    id: 'crimson',
    name: 'Crimson Overdrive',
    badge: 'AMD / ROG Inspired',
    vibe: 'Matte carbon stealth with laser-red performance accents',
    bgCanvas: '#0B090A',
    bgSurface: '#161215',
    bgElevated: '#221B20',
    glassSurface: 'rgba(22, 18, 21, 0.75)',
    glassBorder: 'rgba(239, 35, 60, 0.22)',
    borderSubtle: 'rgba(239, 35, 60, 0.22)',
    borderHighlight: 'rgba(239, 35, 60, 0.45)',
    accentPrimary: '#EF233C',
    accentSecondary: '#FF758F',
  },
  {
    id: 'emerald',
    name: 'Emerald Telemetry',
    badge: 'NVIDIA GeForce Inspired',
    vibe: 'Precision graphite hardware console with acid-emerald glow',
    bgCanvas: '#080B0E',
    bgSurface: '#11161C',
    bgElevated: '#182028',
    glassSurface: 'rgba(17, 22, 28, 0.68)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    borderSubtle: 'rgba(16, 185, 129, 0.2)',
    borderHighlight: 'rgba(16, 185, 129, 0.45)',
    accentPrimary: '#10B981',
    accentSecondary: '#34D399',
  },
  {
    id: 'chroma',
    name: 'Chroma Glow',
    badge: 'Discord Nitro Gradient',
    vibe: 'Deep indigo canvas with hyper-violet and cyan aurora mesh',
    bgCanvas: 'linear-gradient(135deg, #090D16 0%, #120E24 50%, #091921 100%)',
    bgSurface: 'rgba(20, 22, 38, 0.85)',
    bgElevated: 'rgba(32, 35, 58, 0.9)',
    glassSurface: 'rgba(20, 22, 38, 0.78)',
    glassBorder: 'rgba(139, 92, 246, 0.28)',
    borderSubtle: 'rgba(139, 92, 246, 0.28)',
    borderHighlight: 'rgba(6, 182, 212, 0.5)',
    accentPrimary: '#8B5CF6',
    accentSecondary: '#06B6D4',
  },
  {
    id: 'sunset',
    name: 'Sunset Dusk',
    badge: 'Discord Nitro Lo-Fi',
    vibe: 'Warm twilight plum fading into amber-rose horizon glow',
    bgCanvas: 'linear-gradient(135deg, #110B18 0%, #1F1124 60%, #261419 100%)',
    bgSurface: 'rgba(28, 18, 33, 0.85)',
    bgElevated: 'rgba(45, 27, 52, 0.9)',
    glassSurface: 'rgba(28, 18, 33, 0.8)',
    glassBorder: 'rgba(244, 63, 94, 0.28)',
    borderSubtle: 'rgba(244, 63, 94, 0.28)',
    borderHighlight: 'rgba(245, 158, 11, 0.5)',
    accentPrimary: '#F43F5E',
    accentSecondary: '#F59E0B',
  },
  {
    id: 'tokyo',
    name: 'Tokyo Night',
    badge: 'Iconic IDE Theme',
    vibe: 'Calm midnight storm blue with pastel neon syntax highlights',
    bgCanvas: '#1A1B26',
    bgSurface: '#24283B',
    bgElevated: '#2F354F',
    glassSurface: 'rgba(36, 40, 59, 0.78)',
    glassBorder: 'rgba(122, 162, 247, 0.22)',
    borderSubtle: 'rgba(122, 162, 247, 0.2)',
    borderHighlight: 'rgba(122, 162, 247, 0.45)',
    accentPrimary: '#7AA2F7',
    accentSecondary: '#BB9AF7',
  },
  {
    id: 'vanta',
    name: 'Vanta OLED',
    badge: 'Discord Midnight / AMOLED',
    vibe: 'True #000000 pitch black for zero eye strain and max contrast',
    bgCanvas: '#000000',
    bgSurface: '#0A0A0C',
    bgElevated: '#141418',
    glassSurface: 'rgba(10, 10, 12, 0.85)',
    glassBorder: 'rgba(255, 255, 255, 0.14)',
    borderSubtle: 'rgba(255, 255, 255, 0.12)',
    borderHighlight: 'rgba(255, 255, 255, 0.3)',
    accentPrimary: '#FFFFFF',
    accentSecondary: '#A1A1AA',
  },
  {
    id: 'nordic',
    name: 'Nordic Frost',
    badge: 'Clean Arctic Dark',
    vibe: 'Sub-zero slate blue with crisp glacier-cyan clarity',
    bgCanvas: '#12161F',
    bgSurface: '#1B2230',
    bgElevated: '#263044',
    glassSurface: 'rgba(27, 34, 48, 0.78)',
    glassBorder: 'rgba(136, 192, 208, 0.22)',
    borderSubtle: 'rgba(136, 192, 208, 0.2)',
    borderHighlight: 'rgba(136, 192, 208, 0.45)',
    accentPrimary: '#88C0D0',
    accentSecondary: '#81A1C1',
  },
];

export const ALL_THEMES: ThemeConfig[] = [...GAMING_THEMES, ...THEMES];

export const ACCENT_SWATCHES = [
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Blurple', hex: '#5865F2' },
  { name: 'Cyber Yellow', hex: '#FCE300' },
  { name: 'Crimson', hex: '#EF233C' },
  { name: 'Hyper Violet', hex: '#8B5CF6' },
  { name: 'Glitch Cyan', hex: '#00F0FF' },
  { name: 'Rose Sunset', hex: '#F43F5E' },
  { name: 'Tokyo Blue', hex: '#7AA2F7' },
];

export const BACKDROP_OPTIONS: Array<{
  id: BackdropMode;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'default',
    name: 'Default',
    description: 'Dynamic canvas engine matching theme atmosphere (Data rain, snow embers, spores, leaves).',
    icon: Sparkles,
  },
  {
    id: 'shape-waves',
    name: 'Shape Waves',
    description: 'Animated 3D dot grid with smooth sine-wave ripple movements.',
    icon: Waves,
  },
  {
    id: 'ferrofluid',
    name: 'Ferrofluid',
    description: 'Bioluminescent floating metaballs that morph and pulse in the background.',
    icon: CircleDot,
  },
  {
    id: 'gradient-waves',
    name: 'Gradient Waves',
    description: 'Multi-layer flowing color ribbons rippling gently across the canvas.',
    icon: Layers,
  },
  {
    id: 'molten-metal',
    name: 'Molten Metal',
    description: 'High-energy oscillating liquid streaks with metallic luminescence.',
    icon: Cpu,
  },
];

export function applyThemeVariables(theme: ThemeConfig, customAccent?: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const accent = customAccent || theme.accentPrimary;

  root.style.setProperty('--bg-canvas', theme.bgCanvas);
  root.style.setProperty('--bg-surface', theme.bgSurface);
  root.style.setProperty('--bg-elevated', theme.bgElevated);
  root.style.setProperty('--glass-surface', theme.glassSurface);
  root.style.setProperty('--glass-border', theme.glassBorder);
  root.style.setProperty('--border-subtle', theme.borderSubtle);
  root.style.setProperty('--border-highlight', theme.borderHighlight);

  root.style.setProperty('--accent-primary', accent);
  root.style.setProperty('--accent-secondary', theme.accentSecondary);
  root.style.setProperty('--accent-tint', `${accent}20`);
  root.style.setProperty('--accent-border', `${accent}40`);
  root.style.setProperty('--accent-glow', `${accent}35`);

  root.setAttribute('data-theme', theme.id);
}

interface AppearanceSettingsProps {
  currentTheme: string;
  currentAccent: string;
  currentBackdrop: BackdropMode;
  stealthMode: boolean;
  onSelectTheme: (themeConfig: ThemeConfig) => void;
  onSelectAccent: (accentHex: string) => void;
  onSelectBackdrop: (backdrop: BackdropMode) => void;
  onToggleStealthMode: (stealth: boolean) => void;
  onResetDefaults: () => void;
}

export function AppearanceSettings({
  currentTheme,
  currentAccent,
  currentBackdrop,
  stealthMode,
  onSelectTheme,
  onSelectAccent,
  onSelectBackdrop,
  onToggleStealthMode,
  onResetDefaults,
}: AppearanceSettingsProps) {
  const [wallpaperDimmer, setWallpaperDimmer] = useState<number>(65);
  const [wallpaperBlur, setWallpaperBlur] = useState<number>(0);
  const [wallpaperEnabled, setWallpaperEnabled] = useState<boolean>(true);

  useEffect(() => {
    try {
      const d = localStorage.getItem('myacademia_wallpaper_dimmer');
      if (d !== null) setWallpaperDimmer(Math.round(parseFloat(d) * 100));
      const b = localStorage.getItem('myacademia_wallpaper_blur');
      if (b !== null) setWallpaperBlur(parseInt(b, 10));
      const e = localStorage.getItem('myacademia_wallpaper_enabled');
      if (e !== null) setWallpaperEnabled(e !== 'false');
    } catch {}
  }, []);

  const handleDimmerChange = (val: number) => {
    setWallpaperDimmer(val);
    try {
      localStorage.setItem('myacademia_wallpaper_dimmer', (val / 100).toString());
      window.dispatchEvent(new Event('myacademia_wallpaper_update'));
    } catch {}
  };

  const handleBlurChange = (val: number) => {
    setWallpaperBlur(val);
    try {
      localStorage.setItem('myacademia_wallpaper_blur', val.toString());
      window.dispatchEvent(new Event('myacademia_wallpaper_update'));
    } catch {}
  };

  const handleToggleWallpaper = (enabled: boolean) => {
    setWallpaperEnabled(enabled);
    try {
      localStorage.setItem('myacademia_wallpaper_enabled', enabled ? 'true' : 'false');
      window.dispatchEvent(new Event('myacademia_wallpaper_update'));
    } catch {}
  };
  return (
    <div className="space-y-8 max-w-5xl">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              System Personalization
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Appearance & Theme Engine
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Featuring PC Gaming Vault themes, Discord Nitro palettes, and visionOS liquid glass.
          </p>
        </div>

        <button
          onClick={onResetDefaults}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-white/20 text-zinc-300 hover:text-white transition-all text-xs font-medium flex items-center gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* FLAGSHIP: COLLECTOR'S EDITION · PC GAMING VAULT          */}
      {/* ======================================================== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-rose-500/10 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                🎮 Collector&apos;s Edition · PC Gaming Vault
              </h3>
              <p className="text-xs text-zinc-300">
                Triple-A themes featuring animated silhouettes, canvas particle engines, and interactive Easter eggs.
              </p>
            </div>
          </div>

          {/* Classroom Stealth Toggle */}
          <button
            onClick={() => onToggleStealthMode(!stealthMode)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              stealthMode
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)]'
                : 'bg-white/[0.05] border-white/10 text-zinc-300 hover:border-white/20 hover:text-white'
            }`}
            title="Suppress character art and game audio/HUD effects during classroom presentations"
          >
            {stealthMode ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
            <span>Classroom Stealth: {stealthMode ? 'ON (Hidden)' : 'OFF (Active)'}</span>
          </button>
        </div>

        {/* 6 Gaming Themes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAMING_THEMES.map((theme) => {
            const isActive = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => onSelectTheme(theme)}
                className={`liquid-glass liquid-glass-interactive rounded-2xl p-4 text-left transition-all duration-200 relative overflow-hidden group flex flex-col justify-between ${
                  isActive
                    ? 'ring-2 ring-[var(--accent-primary)] shadow-xl'
                    : 'hover:border-white/25'
                }`}
              >
                {/* Active Top Bar with theme accent */}
                {isActive && (
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{ backgroundColor: theme.accentPrimary }}
                  />
                )}

                <div>
                  {/* Live Mini UI Preview Window */}
                  <div
                    className="w-full h-24 rounded-xl p-3 mb-3 relative overflow-hidden flex flex-col justify-between border"
                    style={{
                      background: theme.bgCanvas,
                      borderColor: theme.borderSubtle,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: theme.accentPrimary }}
                        />
                        <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-300">
                          {theme.gameTag}
                        </span>
                      </div>
                      <div
                        className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold"
                        style={{
                          backgroundColor: `${theme.accentPrimary}26`,
                          color: theme.accentPrimary,
                        }}
                      >
                        VAULT
                      </div>
                    </div>

                    <div className="flex items-end justify-between">
                      <div className="space-y-1">
                        <div
                          className="h-2 w-16 rounded"
                          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                        />
                        <div
                          className="h-1.5 w-10 rounded"
                          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                        />
                      </div>
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                        style={{
                          backgroundColor: theme.accentSecondary,
                          color: '#000',
                        }}
                      >
                        ✦
                      </div>
                    </div>
                  </div>

                  {/* Header: Title & Badges */}
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-white tracking-tight group-hover:text-[var(--accent-primary)] transition-colors">
                      {theme.name}
                    </h4>
                    {isActive && (
                      <span className="w-4 h-4 rounded-full bg-[var(--accent-primary)] text-black flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-[10px] text-amber-300 block mb-2 font-medium">
                    {theme.badge}
                  </span>

                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                    {theme.vibe}
                  </p>
                </div>

                {/* Secret Easter Egg Hint Pill */}
                {theme.easterEggHint && (
                  <div className="pt-2 border-t border-white/[0.06] text-[10px] font-mono text-zinc-400 group-hover:text-amber-300 transition-colors truncate">
                    {theme.easterEggHint}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 2: 8 STANDARD NITRO & DEV THEMES SELECTOR GRID   */}
      {/* ======================================================== */}
      <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[var(--accent-primary)]" />
            <h3 className="text-base font-semibold text-white tracking-tight">
              Standard Nitro & Developer Themes
            </h3>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            8 Dark Glass Palettes
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {THEMES.map((theme) => {
            const isActive = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => onSelectTheme(theme)}
                className={`liquid-glass liquid-glass-interactive rounded-2xl p-4 text-left transition-all duration-200 relative overflow-hidden group flex flex-col justify-between ${
                  isActive
                    ? 'ring-2 ring-[var(--accent-primary)] shadow-lg'
                    : 'hover:border-white/25'
                }`}
              >
                {isActive && (
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{ backgroundColor: theme.accentPrimary }}
                  />
                )}

                <div>
                  <div
                    className="w-full h-20 rounded-xl p-3 mb-3 relative overflow-hidden flex flex-col justify-between border"
                    style={{
                      background: theme.bgCanvas,
                      borderColor: theme.borderSubtle,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: theme.accentPrimary }}
                        />
                        <div
                          className="h-2 w-14 rounded"
                          style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
                        />
                      </div>
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: theme.accentPrimary }}
                      />
                    </div>

                    <div className="flex items-end justify-between">
                      <div className="space-y-1">
                        <div
                          className="h-2 w-20 rounded"
                          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                        />
                        <div
                          className="h-1.5 w-12 rounded"
                          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                        />
                      </div>
                      <div
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: theme.accentSecondary }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-white tracking-tight group-hover:text-[var(--accent-primary)] transition-colors">
                      {theme.name}
                    </h4>
                    {isActive && (
                      <span className="w-4 h-4 rounded-full bg-[var(--accent-primary)] text-black flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-[10px] text-zinc-400 block mb-2">
                    {theme.badge}
                  </span>

                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {theme.vibe}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 3: ACCENT COLOR SELECTOR                         */}
      {/* ======================================================== */}
      <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[var(--accent-primary)]" />
            <h3 className="text-base font-semibold text-white tracking-tight">
              Primary Accent Override
            </h3>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            Active: <strong className="text-white font-mono">{currentAccent}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
          {ACCENT_SWATCHES.map((swatch) => {
            const isSelected = currentAccent.toUpperCase() === swatch.hex.toUpperCase();
            return (
              <button
                key={swatch.hex}
                onClick={() => onSelectAccent(swatch.hex)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  isSelected
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-tint)] shadow-[0_0_15px_-3px_var(--accent-glow)]'
                    : 'bg-[var(--glass-surface)] border-[var(--glass-border)] hover:border-white/20'
                }`}
              >
                <div
                  className="w-7 h-7 rounded-full shadow-md flex items-center justify-center transition-transform hover:scale-110"
                  style={{ backgroundColor: swatch.hex }}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                </div>
                <span className="text-[11px] font-medium text-zinc-300">
                  {swatch.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 4: 4K LIVE WALLPAPERS & ATMOSPHERIC ENGINE       */}
      {/* ======================================================== */}
      <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-[var(--accent-primary)]" />
            <h3 className="text-base font-semibold text-white tracking-tight">
              Curated 4K Wallpaper & Atmosphere
            </h3>
          </div>
          <button
            onClick={() => handleToggleWallpaper(!wallpaperEnabled)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
              wallpaperEnabled
                ? 'bg-[var(--accent-tint)] text-[var(--accent-primary)] border-[var(--accent-border)]'
                : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
            }`}
          >
            {wallpaperEnabled ? 'Wallpapers Enabled' : 'Wallpapers Paused'}
          </button>
        </div>

        {wallpaperEnabled && (
          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-5">
            {/* Dimmer Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-zinc-300 font-medium">Darkening Dimmer (Opacity)</span>
                <span className="font-mono text-[var(--accent-primary)]">{wallpaperDimmer}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="90"
                step="1"
                value={wallpaperDimmer}
                onChange={(e) => handleDimmerChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                <span>20% (Vibrant)</span>
                <span>65% (Balanced)</span>
                <span>90% (Deep Focus)</span>
              </div>
            </div>

            {/* Blur Softness Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-zinc-300 font-medium">Atmospheric Glass Blur</span>
                <span className="font-mono text-[var(--accent-primary)]">{wallpaperBlur}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="16"
                step="1"
                value={wallpaperBlur}
                onChange={(e) => handleBlurChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                <span>0px (Crisp 4K)</span>
                <span>4px (Subtle)</span>
                <span>16px (Velvet Dream)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SECTION 5: HARDWARE BACKDROP CANVAS ENGINE               */}
      {/* ======================================================== */}
      <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-[var(--accent-primary)]" />
            <h3 className="text-base font-semibold text-white tracking-tight">
              Environmental Backdrop Engine
            </h3>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            Hardware Canvas Shaders
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {BACKDROP_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = currentBackdrop === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onSelectBackdrop(opt.id)}
                className={`liquid-glass liquid-glass-interactive rounded-2xl p-4 text-left transition-all duration-200 border flex flex-col justify-between ${
                  isSelected
                    ? 'border-[var(--accent-border)] bg-[var(--bg-elevated)] shadow-[0_0_20px_-5px_var(--accent-glow)]'
                    : 'hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent-tint)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
                    <Icon className="w-4 h-4" />
                  </div>
                  {isSelected && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--accent-tint)] text-[var(--accent-primary)] border border-[var(--accent-border)]">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-white tracking-tight mb-1">
                    {opt.name}
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
