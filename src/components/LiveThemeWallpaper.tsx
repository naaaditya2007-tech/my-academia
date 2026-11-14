'use client';

import React, { useEffect, useRef } from 'react';

export type SupportedThemeId = 'campus' | 'vanta' | 'cyberpunk' | 'gta' | 'godofwar';

interface LiveThemeWallpaperProps {
  themeId: string;
  accentPrimary?: string;
  accentSecondary?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  char?: string;
  color?: string;
  rot?: number;
  vrot?: number;
  life?: number;
  maxLife?: number;
}

interface TapBurst {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  type: string;
  particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    color: string;
  }>;
}

const THEME_WALLPAPERS: Record<string, { desktop: string; mobile: string; name: string }> = {
  campus: {
    name: 'Campus Midnight Aurora',
    desktop: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=3840&q=85&auto=format&fit=crop',
    mobile: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1080&h=1920&q=85&auto=format&fit=crop',
  },
  cyberpunk: {
    name: 'Night City Samurai Neon',
    desktop: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=3840&q=85&auto=format&fit=crop',
    mobile: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1080&h=1920&q=85&auto=format&fit=crop',
  },
  gta: {
    name: 'Los Santos Sunset Palms',
    desktop: 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=3840&q=85&auto=format&fit=crop',
    mobile: 'https://images.unsplash.com/photo-1580655653885-65763b2597d0?w=1080&h=1920&q=85&auto=format&fit=crop',
  },
  godofwar: {
    name: 'Midgard Leviathan Frost',
    desktop: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?w=3840&q=85&auto=format&fit=crop',
    mobile: 'https://images.unsplash.com/photo-1491555103944-7c647fd857e6?w=1080&h=1920&q=85&auto=format&fit=crop',
  },
};

export function LiveThemeWallpaper({
  themeId,
  accentPrimary = '#3B82F6',
  accentSecondary = '#6366F1',
}: LiveThemeWallpaperProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const burstsRef = useRef<TapBurst[]>([]);

  // Setup Global Pointer Down Listener for Theme-Specific Micro-Burst Animations
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      // Don't spawn on form inputs directly to avoid distraction
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      const x = e.clientX;
      const y = e.clientY;
      const currentTheme = themeId;

      if (currentTheme === 'cyberpunk') {
        // Cyberpunk: Digital glitch sparks + hex ring ripple
        const particles = Array.from({ length: 14 }, () => {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5 + 2;
          return {
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 3 + 1.5,
            alpha: 1,
            color: Math.random() > 0.5 ? '#FCE300' : '#00F0FF',
          };
        });

        burstsRef.current.push({
          x,
          y,
          radius: 10,
          maxRadius: 75,
          alpha: 1,
          color: '#00F0FF',
          type: 'cyberpunk',
          particles,
        });
      } else if (currentTheme === 'gta') {
        // GTA V: Cash green/gold star burst + radar ring
        const particles = Array.from({ length: 12 }, () => {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 4 + 1.5;
          return {
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 3 + 2,
            alpha: 1,
            color: Math.random() > 0.5 ? '#2ECC71' : '#F39C12',
          };
        });

        burstsRef.current.push({
          x,
          y,
          radius: 8,
          maxRadius: 65,
          alpha: 1,
          color: '#2ECC71',
          type: 'gta',
          particles,
        });
      } else if (currentTheme === 'godofwar') {
        // God of War: Frost crystal shatter + fiery Chaos ember burst
        const particles = Array.from({ length: 16 }, () => {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 6 + 2;
          return {
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 4 + 1.5,
            alpha: 1,
            color: Math.random() > 0.4 ? '#38BDF8' : '#F97316',
          };
        });

        burstsRef.current.push({
          x,
          y,
          radius: 10,
          maxRadius: 85,
          alpha: 1,
          color: '#38BDF8',
          type: 'godofwar',
          particles,
        });
      } else {
        // Default / OLED: Subtle liquid glass shockwave ring
        burstsRef.current.push({
          x,
          y,
          radius: 6,
          maxRadius: 55,
          alpha: 0.8,
          color: accentPrimary || '#3B82F6',
          type: 'default',
          particles: [],
        });
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [themeId, accentPrimary]);

  // Ambient Particles & Canvas Animation Loop
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

    const isMobile = window.innerWidth < 768;
    const ambientCount = isMobile ? 18 : 36;

    // Ambient Particles setup based on theme
    const ambientParticles: Particle[] = Array.from({ length: ambientCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.7,
      vy: Math.random() * 0.8 + 0.3,
      size: Math.random() * 3.5 + 1.5,
      alpha: Math.random() * 0.5 + 0.2,
      char: String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96)),
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.02,
    }));

    let time = 0;
    let lastFrame = performance.now();

    const render = (now: number) => {
      const delta = now - lastFrame;
      const targetDelta = isMobile ? 1000 / 30 : 1000 / 60;
      if (delta < targetDelta) {
        animId = requestAnimationFrame(render);
        return;
      }
      lastFrame = now - (delta % targetDelta);
      time += 0.016;

      ctx.clearRect(0, 0, width, height);

      // 1. Ambient Background Particle FX
      if (themeId === 'cyberpunk') {
        // Digital data rain & neon cyan sparks
        ctx.font = '10px monospace';
        ambientParticles.forEach((p) => {
          p.y += p.vy * 2.2;
          if (p.y > height) {
            p.y = 0;
            p.x = Math.random() * width;
          }
          ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha * 0.4})`;
          ctx.fillText(p.char || '0', p.x, p.y);
        });
      } else if (themeId === 'gta') {
        // Searchlight sweep beam
        const beamAngle = Math.sin(time * 0.5) * 0.35 + Math.PI / 4;
        const grad = ctx.createRadialGradient(width * 0.85, 0, 50, width * 0.5, height, height * 0.8);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
        grad.addColorStop(0.5, 'rgba(232, 67, 147, 0.03)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.translate(width * 0.85, 0);
        ctx.rotate(beamAngle);
        ctx.fillStyle = grad;
        ctx.fillRect(-120, 0, 240, height * 1.5);
        ctx.restore();
      } else if (themeId === 'godofwar') {
        // Fimbulwinter snow + fire embers
        ambientParticles.forEach((p, idx) => {
          if (idx % 2 === 0) {
            // Snow
            p.y += p.vy * 0.9;
            p.x += Math.sin(time + p.y * 0.01) * 0.5;
            if (p.y > height) p.y = 0;
            ctx.fillStyle = `rgba(224, 242, 254, ${p.alpha * 0.4})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Embers
            p.y -= p.vy * 1.2;
            p.x += Math.sin(time * 2 + p.y * 0.02) * 0.6;
            if (p.y < 0) p.y = height;
            ctx.fillStyle = `rgba(249, 115, 22, ${p.alpha * 0.45})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      } else if (themeId === 'campus') {
        // Soft aurora drifting spheres
        const cx = width * 0.5 + Math.sin(time * 0.4) * 120;
        const cy = height * 0.3 + Math.cos(time * 0.3) * 80;
        const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, width * 0.5);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.09)');
        grad.addColorStop(0.6, 'rgba(99, 102, 241, 0.04)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Interactive Tap / Click Burst Particles
      const bursts = burstsRef.current;
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.radius += (b.maxRadius - b.radius) * 0.15 + 1.2;
        b.alpha *= 0.91;

        // Draw Expanding Shockwave Ring
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = Math.max(0, b.alpha);
        ctx.lineWidth = b.type === 'cyberpunk' ? 2 : 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Update and draw burst sparks
        for (const sp of b.particles) {
          sp.x += sp.vx;
          sp.y += sp.vy;
          sp.vx *= 0.93;
          sp.vy *= 0.93;
          sp.alpha *= 0.92;

          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
          ctx.fillStyle = sp.color;
          ctx.globalAlpha = Math.max(0, sp.alpha);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (b.alpha < 0.05) {
          bursts.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(render);
    };

    render(performance.now());

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [themeId]);

  const activeWallpaper = THEME_WALLPAPERS[themeId];
  const isVanta = themeId === 'vanta';

  return (
    <>
      {/* Fixed Live Wallpaper Layer */}
      <div
        className="fixed inset-0 -z-20 overflow-hidden pointer-events-none"
        style={{
          backgroundColor: isVanta ? '#000000' : '#0B0D1E',
        }}
      >
        {!isVanta && activeWallpaper && (
          <>
            <picture className="w-full h-full block">
              <source media="(max-width: 767px)" srcSet={activeWallpaper.mobile} />
              <source media="(min-width: 768px)" srcSet={activeWallpaper.desktop} />
              <img
                src={activeWallpaper.desktop}
                alt={activeWallpaper.name}
                className="w-full h-full object-cover animate-ken-burns transform-gpu"
                loading="eager"
              />
            </picture>

            {/* Dark glass overlay to keep typography readable */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

            {/* Radial Vignette */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.85) 100%)',
              }}
            />
          </>
        )}
      </div>

      {/* Interactive Particle Canvas with Tap Bursts */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10 pointer-events-none"
      />
    </>
  );
}
