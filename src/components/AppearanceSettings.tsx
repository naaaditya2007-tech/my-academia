'use client';

import React from 'react';
import {
  Check,
  Palette,
  RotateCcw,
  Gamepad2,
  Sparkles,
  Zap,
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
  previewGradient: string;
}

// EXACT 5 STREAMLINED ATMOSPHERIC THEMES (VANTA OLED DEFAULT)
export const CAMPUS_5_THEMES: ThemeConfig[] = [
  {
    id: 'vanta',
    name: 'Vanta OLED',
    badge: 'Pure AMOLED Black',
    vibe: 'Pitch black canvas with crisp silver wireframes. Maximum contrast, zero battery drain.',
    bgCanvas: '#000000',
    bgSurface: '#0E0E12',
    bgElevated: '#17171C',
    glassSurface: 'rgba(14, 14, 18, 0.85)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
    borderSubtle: 'rgba(255, 255, 255, 0.10)',
    borderHighlight: 'rgba(255, 255, 255, 0.35)',
    accentPrimary: '#FFFFFF',
    accentSecondary: '#94A3B8',
    previewGradient: 'linear-gradient(135deg, #000000 0%, #0A0A0A 50%, #27272A 100%)',
  },
  {
    id: 'campus',
    name: 'Midnight Aurora',
    badge: 'Deep Indigo Glow',
    vibe: 'Atmospheric midnight indigo with electric blue accents.',
    bgCanvas: '#0B0D1E',
    bgSurface: '#121628',
    bgElevated: '#1A1F36',
    glassSurface: 'rgba(18, 22, 40, 0.75)',
    glassBorder: 'rgba(99, 102, 241, 0.22)',
    borderSubtle: 'rgba(99, 102, 241, 0.20)',
    borderHighlight: 'rgba(59, 130, 246, 0.45)',
    accentPrimary: '#3B82F6',
    accentSecondary: '#6366F1',
    previewGradient: 'linear-gradient(135deg, #0B0D1E 0%, #1E293B 50%, #3B82F6 100%)',
  },
  {
    id: 'cyberpunk',
    name: 'Night City',
    badge: 'Neon Dystopia',
    vibe: 'Arasaka obsidian background with Kiroshi cyan and neon yellow telemetry.',
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
    previewGradient: 'linear-gradient(135deg, #050308 0%, #1E1035 50%, #FCE300 100%)',
  },
  {
    id: 'gta',
    name: 'Los Santos Sunset',
    badge: 'Vinewood Boulevard',
    vibe: 'Midnight asphalt with sunset fuchsia and heist-green accents.',
    bgCanvas: '#08080C',
    bgSurface: '#14141E',
    bgElevated: '#1F1F2E',
    glassSurface: 'rgba(20, 20, 30, 0.78)',
    glassBorder: 'rgba(235, 110, 255, 0.28)',
    borderSubtle: 'rgba(235, 110, 255, 0.22)',
    borderHighlight: 'rgba(46, 204, 113, 0.5)',
    accentPrimary: '#2ECC71',
    accentSecondary: '#E84393',
    easterEggHint: '🥚 Secret: Type "LAWYERUP" to clear wanted stars or "TURTLE" for armor',
    previewGradient: 'linear-gradient(135deg, #08080C 0%, #1A0B2E 50%, #2ECC71 100%)',
  },
  {
    id: 'godofwar',
    name: 'Fimbulwinter',
    badge: 'Nordic Frost',
    vibe: 'Freezing glacier cyan with molten ember accents.',
    bgCanvas: '#0B0D13',
    bgSurface: '#151A24',
    bgElevated: '#1F2736',
    glassSurface: 'rgba(21, 26, 36, 0.78)',
    glassBorder: 'rgba(56, 189, 248, 0.28)',
    borderSubtle: 'rgba(56, 189, 248, 0.22)',
    borderHighlight: 'rgba(249, 115, 22, 0.5)',
    accentPrimary: '#38BDF8',
    accentSecondary: '#F97316',
    easterEggHint: '🥚 Secret: Press "R" or click Ω symbol for 8s Spartan Rage',
    previewGradient: 'linear-gradient(135deg, #0B0D13 0%, #152238 50%, #F97316 100%)',
  },
];

export const ALL_THEMES = CAMPUS_5_THEMES;
export const THEMES = CAMPUS_5_THEMES;

export function applyThemeVariables(theme: ThemeConfig, customAccent?: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.id);
  root.style.setProperty('--bg-canvas', theme.bgCanvas);
  root.style.setProperty('--bg-surface', theme.bgSurface);
  root.style.setProperty('--bg-elevated', theme.bgElevated);
  root.style.setProperty('--glass-surface', theme.glassSurface);
  root.style.setProperty('--glass-border', theme.glassBorder);
  root.style.setProperty('--border-subtle', theme.borderSubtle);
  root.style.setProperty('--border-highlight', theme.borderHighlight);
  root.style.setProperty('--accent-primary', customAccent || theme.accentPrimary);
  root.style.setProperty('--accent-secondary', theme.accentSecondary);
  root.style.setProperty('--accent-glow', `${customAccent || theme.accentPrimary}40`);
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
  onSelectTheme,
  onResetDefaults,
}: AppearanceSettingsProps) {
  return (
    <div className="space-y-6 max-w-4xl select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Themes & Atmosphere
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Select from the 5 official themes with live moving wallpapers and tap effects
          </p>
        </div>

        <button
          onClick={onResetDefaults}
          className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset Default</span>
        </button>
      </div>

      {/* 2-COLUMN EQUAL CARD GRID (MATCHING CAMPUS WEB 1:1) */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
        {CAMPUS_5_THEMES.map((t) => {
          const isActive = currentTheme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTheme(t)}
              className={`p-3.5 sm:p-4 rounded-2xl text-left transition-all relative flex flex-col justify-between group overflow-hidden border ${
                isActive
                  ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)] bg-white/[0.06] shadow-lg shadow-[var(--accent-primary)]/20'
                  : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
              }`}
            >
              {/* Visual Preview Box */}
              <div
                className="w-full h-24 sm:h-28 rounded-xl p-3 mb-3 relative overflow-hidden flex flex-col justify-between border border-white/[0.1] shadow-inner"
                style={{
                  background: t.previewGradient,
                }}
              >
                {/* Visual Pill Dots in Preview */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full shadow-sm"
                      style={{ backgroundColor: t.accentPrimary }}
                    />
                    <div
                      className="w-2 h-2 rounded-full opacity-60"
                      style={{ backgroundColor: t.accentSecondary }}
                    />
                  </div>

                  {isActive && (
                    <span className="w-4 h-4 rounded-full bg-[var(--accent-primary)] text-black flex items-center justify-center font-bold">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="w-16 h-1.5 rounded-full bg-white/30" />
                  <div className="w-10 h-1.5 rounded-full bg-white/20" />
                </div>
              </div>

              {/* Theme Name & Badge */}
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm sm:text-base text-white tracking-tight group-hover:text-[var(--accent-primary)] transition-colors">
                    {t.name}
                  </h3>
                </div>
                <span className="text-[11px] font-medium text-zinc-400 block mt-0.5">
                  {t.badge}
                </span>
                <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-normal hidden sm:block">
                  {t.vibe}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
