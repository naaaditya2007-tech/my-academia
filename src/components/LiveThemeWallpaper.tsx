'use client';

import React from 'react';

export type SupportedThemeId = 'campus' | 'vanta' | 'cyberpunk' | 'gta' | 'godofwar' | 'vanta-oled';

interface LiveThemeWallpaperProps {
  themeId: string;
  accentPrimary?: string;
  accentSecondary?: string;
}

/**
 * Ultra-Lightweight Theme Atmosphere Background (Zero-Resource, 120fps Native)
 * 
 * Replaces heavy 4K live video/image downloads and continuous canvas particle loops
 * with GPU-composited, zero-CPU static atmospheric styling. Preserves theme aesthetics,
 * glowing accents, glass materials, and pure AMOLED black without battery or GPU drain.
 */
export function LiveThemeWallpaper({
  themeId,
  accentPrimary = '#3B82F6',
  accentSecondary = '#6366F1',
}: LiveThemeWallpaperProps) {
  const isVanta = themeId === 'vanta' || themeId === 'vanta-oled';

  if (isVanta) {
    return (
      <div
        className="fixed inset-0 -z-20 pointer-events-none bg-black"
        style={{ transform: 'translateZ(0)' }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 -z-20 pointer-events-none overflow-hidden transition-colors duration-300"
      style={{
        backgroundColor: 'var(--bg-canvas, #080B0E)',
        transform: 'translateZ(0)',
      }}
    >
      {/* Subtle, GPU-composited static ambient glows (zero main-thread CPU overhead) */}
      <div
        className="absolute -top-32 left-1/2 w-[700px] sm:w-[1100px] h-[400px] sm:h-[550px] rounded-full pointer-events-none blur-[100px] sm:blur-[130px]"
        style={{
          background: `radial-gradient(circle, ${accentPrimary}18 0%, transparent 70%)`,
          transform: 'translate3d(-50%, 0, 0)',
        }}
      />
      <div
        className="absolute -bottom-24 right-0 w-[450px] sm:w-[650px] h-[350px] sm:h-[450px] rounded-full pointer-events-none blur-[90px] sm:blur-[120px]"
        style={{
          background: `radial-gradient(circle, ${accentSecondary}12 0%, transparent 70%)`,
          transform: 'translateZ(0)',
        }}
      />
    </div>
  );
}
