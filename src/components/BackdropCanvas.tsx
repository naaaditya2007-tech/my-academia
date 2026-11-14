'use client';

import React, { useEffect, useRef, useState } from 'react';

export type BackdropMode =
  | 'default'
  | 'shape-waves'
  | 'aero-shards'
  | 'ferrofluid'
  | 'gradient-waves'
  | 'molten-metal';

export interface WallpaperConfig {
  name: string;
  desktop: string;
  mobile: string;
}

export const THEME_WALLPAPERS: Record<string, WallpaperConfig> = {
  cyberpunk: {
    name: 'Night City Rain & Neon',
    desktop: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=3840&q=85&auto=format&fit=crop',
    mobile: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1080&h=1920&q=85&auto=format&fit=crop',
  },
  gta: {
    name: 'Vinewood Sunset & Neon',
    desktop: 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=3840&q=85&auto=format&fit=crop',
    mobile: 'https://images.unsplash.com/photo-1580655653885-65763b2597d0?w=1080&h=1920&q=85&auto=format&fit=crop',
  },
  godofwar: {
    name: 'Midgard Peaks & Frost',
    desktop: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?w=3840&q=85&auto=format&fit=crop',
    mobile: 'https://images.unsplash.com/photo-1491555103944-7c647fd857e6?w=1080&h=1920&q=85&auto=format&fit=crop',
  },
  tlou: {
    name: 'Seattle Overgrowth Spores',
    desktop: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=3840&q=85&auto=format&fit=crop',
    mobile: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1080&h=1920&q=85&auto=format&fit=crop',
  },
  rdr2: {
    name: 'Valentine Prairie Campfire',
    desktop: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=3840&q=85&auto=format&fit=crop',
    mobile: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1080&h=1920&q=85&auto=format&fit=crop',
  },
  ghost: {
    name: 'Tsushima Autumn Leaves',
    desktop: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=3840&q=85&auto=format&fit=crop',
    mobile: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1080&h=1920&q=85&auto=format&fit=crop',
  },
};

interface BackdropCanvasProps {
  mode: BackdropMode;
  theme?: string;
  accentHex?: string;
}

export function BackdropCanvas({
  mode,
  theme = 'emerald',
  accentHex = '#10B981',
}: BackdropCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimmer, setDimmer] = useState<number>(0.65);
  const [blur, setBlur] = useState<number>(0);
  const [wallpapersEnabled, setWallpapersEnabled] = useState<boolean>(true);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  // Load and listen for wallpaper settings changes
  useEffect(() => {
    const loadSettings = () => {
      try {
        const storedDimmer = localStorage.getItem('myacademia_wallpaper_dimmer');
        if (storedDimmer !== null) setDimmer(parseFloat(storedDimmer));

        const storedBlur = localStorage.getItem('myacademia_wallpaper_blur');
        if (storedBlur !== null) setBlur(parseFloat(storedBlur));

        const storedEnabled = localStorage.getItem('myacademia_wallpaper_enabled');
        if (storedEnabled !== null) setWallpapersEnabled(storedEnabled !== 'false');
      } catch {
        // Ignore localStorage restrictions
      }
    };

    loadSettings();

    const handleUpdate = () => loadSettings();
    window.addEventListener('myacademia_wallpaper_update', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('myacademia_wallpaper_update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Subtle 3D mouse parallax tracking
  useEffect(() => {
    let ticking = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const x = (e.clientX / window.innerWidth - 0.5) * 12;
          const y = (e.clientY / window.innerHeight - 0.5) * 12;
          setMouseOffset({ x, y });
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Particle & Atmospheric Canvas Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    let isPaused = document.hidden;
    const handleVisibility = () => {
      isPaused = document.hidden;
      if (!isPaused) {
        lastFrameTime = performance.now();
        render(lastFrameTime);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let time = 0;
    let lastFrameTime = performance.now();

    const hexToRgb = (hex: string) => {
      const sanitized = hex.replace('#', '');
      const num = parseInt(sanitized, 16);
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
      };
    };

    const { r: ar, g: ag, b: ab } = hexToRgb(accentHex);

    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 22 : 45;

    const gamingParticles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: Math.random() * 0.9 + 0.3,
      size: Math.random() * 4 + 1.5,
      alpha: Math.random() * 0.6 + 0.2,
      char: String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96)),
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.03,
    }));

    const blobs = [
      { x: width * 0.3, y: height * 0.3, r: 160, vx: 0.6, vy: 0.5 },
      { x: width * 0.7, y: height * 0.4, r: 200, vx: -0.5, vy: 0.7 },
      { x: width * 0.5, y: height * 0.7, r: 180, vx: 0.7, vy: -0.6 },
    ];

    const isGamingTheme = ['cyberpunk', 'gta', 'godofwar', 'tlou', 'rdr2', 'ghost'].includes(theme);

    const render = (now: number) => {
      if (isPaused) return;

      const targetInterval = isMobile ? 1000 / 30 : 1000 / 60;
      const delta = now - lastFrameTime;

      if (delta < targetInterval) {
        animId = requestAnimationFrame(render);
        return;
      }

      lastFrameTime = now - (delta % targetInterval);
      time += 0.016;

      ctx.clearRect(0, 0, width, height);

      // ==========================================
      // 1. DEDICATED GAMING ATMOSPHERIC ENGINES
      // ==========================================
      if (isGamingTheme) {
        if (theme === 'cyberpunk') {
          ctx.fillStyle = '#00F0FF';
          ctx.font = '10px monospace';
          gamingParticles.forEach((p) => {
            p.y += p.vy * 2.5;
            if (p.y > height) {
              p.y = 0;
              p.x = Math.random() * width;
              p.char = String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96));
            }
            ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha * 0.45})`;
            ctx.fillText(p.char, p.x, p.y);
          });
        } else if (theme === 'gta') {
          const beamAngle = Math.sin(time * 0.6) * 0.4 + Math.PI / 4;
          const beamGrad = ctx.createRadialGradient(width * 0.85, 0, 50, width * 0.5, height, height * 0.8);
          beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
          beamGrad.addColorStop(0.5, 'rgba(235, 110, 255, 0.04)');
          beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.save();
          ctx.translate(width * 0.85, 0);
          ctx.rotate(beamAngle);
          ctx.fillStyle = beamGrad;
          ctx.fillRect(-150, 0, 300, height * 1.5);
          ctx.restore();
        } else if (theme === 'godofwar') {
          gamingParticles.forEach((p, i) => {
            if (i % 2 === 0) {
              p.y += p.vy * 0.8;
              p.x += Math.sin(time + p.y * 0.01) * 0.5;
              if (p.y > height) p.y = 0;
              ctx.fillStyle = `rgba(224, 231, 255, ${p.alpha * 0.35})`;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
              ctx.fill();
            } else {
              p.y -= p.vy * 1.2;
              p.x += Math.sin(time * 2 + p.y * 0.02) * 0.6;
              if (p.y < 0) p.y = height;
              ctx.fillStyle = `rgba(255, 69, 0, ${p.alpha * 0.4})`;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
          });
        } else if (theme === 'tlou') {
          gamingParticles.forEach((p) => {
            p.y -= p.vy * 0.4;
            p.x += Math.sin(time * 0.8 + p.y * 0.01) * 0.6;
            if (p.y < 0) p.y = height;
            const pulse = 0.5 + Math.sin(time * 2 + p.x) * 0.3;
            ctx.fillStyle = `rgba(217, 119, 6, ${p.alpha * pulse * 0.45})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          });
        } else if (theme === 'rdr2') {
          gamingParticles.forEach((p) => {
            p.y -= p.vy * 1.4;
            p.x += Math.sin(time * 1.5 + p.y * 0.03) * 0.8;
            if (p.y < 0) {
              p.y = height;
              p.x = width * 0.3 + Math.random() * (width * 0.4);
            }
            ctx.fillStyle = `rgba(220, 38, 38, ${p.alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
            ctx.fill();
          });
        } else if (theme === 'ghost') {
          gamingParticles.forEach((p) => {
            p.y += p.vy * 0.9;
            p.x += p.vy * 1.2 + Math.sin(time + p.y * 0.01) * 0.7;
            p.rot += p.vrot;
            if (p.y > height || p.x > width) {
              p.y = 0;
              p.x = Math.random() * width * 0.7;
            }
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = `rgba(225, 29, 72, ${p.alpha * 0.4})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size * 2, p.size, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });
        }

        animId = requestAnimationFrame(render);
        return;
      }

      // ==========================================
      // 2. STANDARD BACKDROP MODES (NON-GAMING)
      // ==========================================
      if (mode === 'default') {
        const cx1 = width * 0.2 + Math.sin(time * 0.5) * 80;
        const cy1 = height * 0.25 + Math.cos(time * 0.4) * 60;
        const grad1 = ctx.createRadialGradient(cx1, cy1, 10, cx1, cy1, width * 0.45);
        grad1.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, 0.08)`);
        grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, width, height);
      } else if (mode === 'shape-waves') {
        const rings = isMobile ? 3 : 5;
        for (let r = 0; r < rings; r++) {
          ctx.beginPath();
          const baseRadius = (r + 1) * (isMobile ? 90 : 130);
          for (let theta = 0; theta <= Math.PI * 2; theta += 0.05) {
            const rad =
              baseRadius +
              Math.sin(theta * 6 + time * 1.5 + r) * 22 +
              Math.cos(theta * 3 - time) * 14;
            const x = width * 0.5 + Math.cos(theta) * rad;
            const y = height * 0.5 + Math.sin(theta) * rad;
            if (theta === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.12 - r * 0.02})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else if (mode === 'ferrofluid') {
        blobs.forEach((b) => {
          b.x += b.vx;
          b.y += b.vy;
          if (b.x - b.r < 0 || b.x + b.r > width) b.vx *= -1;
          if (b.y - b.r < 0 || b.y + b.r > height) b.vy *= -1;

          const radPulse = b.r + Math.sin(time * 1.5) * 20;
          const grad = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, radPulse);
          grad.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, 0.18)`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(b.x, b.y, radPulse, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (mode === 'gradient-waves') {
        const layers = isMobile ? 3 : 4;
        for (let layer = 0; layer < layers; layer++) {
          ctx.beginPath();
          ctx.moveTo(0, height);
          const yOffset = height * (0.35 + layer * 0.15);
          for (let x = 0; x <= width; x += isMobile ? 25 : 15) {
            const y =
              yOffset +
              Math.sin(x * 0.003 + time * (1.2 + layer * 0.4) + layer) * 45 +
              Math.cos(x * 0.006 - time * 0.8) * 25;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(width, height);
          ctx.closePath();

          const grad = ctx.createLinearGradient(0, yOffset - 50, 0, height);
          grad.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${0.08 - layer * 0.015})`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fill();
        }
      } else if (mode === 'molten-metal') {
        const bands = isMobile ? 5 : 7;
        for (let b = 0; b < bands; b++) {
          ctx.beginPath();
          const baseHeight = (height / bands) * b;
          for (let x = 0; x <= width; x += isMobile ? 30 : 20) {
            const my =
              baseHeight +
              Math.sin(x * 0.005 + time * 1.5 + b * 0.8) * 35 +
              Math.sin(time * 2 + x * 0.002) * 15;
            if (x === 0) ctx.moveTo(x, my);
            else ctx.lineTo(x, my);
          }
          ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.09 + (b % 3) * 0.04})`;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(render);
    };

    render(performance.now());

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [mode, theme, accentHex]);

  const activeWallpaper = THEME_WALLPAPERS[theme];

  return (
    <>
      {/* Responsive 4K Wallpaper Layer with Ken Burns Motion & Parallax */}
      {wallpapersEnabled && activeWallpaper && (
        <div
          className="fixed inset-0 -z-30 overflow-hidden pointer-events-none transition-transform duration-700 ease-out"
          style={{
            transform: `translate3d(${mouseOffset.x}px, ${mouseOffset.y}px, 0)`,
          }}
        >
          <picture className="w-full h-full block">
            <source
              media="(max-width: 767px)"
              srcSet={activeWallpaper.mobile}
            />
            <source
              media="(min-width: 768px)"
              srcSet={activeWallpaper.desktop}
            />
            <img
              src={activeWallpaper.desktop}
              alt={activeWallpaper.name}
              className="w-full h-full object-cover animate-ken-burns transform-gpu"
              style={{
                filter: blur > 0 ? `blur(${blur}px)` : undefined,
              }}
              loading="eager"
            />
          </picture>

          {/* User-Configurable Darkening Dimmer Layer */}
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              backgroundColor: `rgba(0, 0, 0, ${dimmer})`,
            }}
          />

          {/* Cinematic Peripheral Vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)',
            }}
          />
        </div>
      )}

      {/* Atmospheric Canvas Particles & Shaders */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10 pointer-events-none opacity-40 transition-opacity duration-500"
      />
    </>
  );
}
