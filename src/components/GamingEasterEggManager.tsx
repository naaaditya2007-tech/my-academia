'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Course } from '@/types/campus';
import {
  Skull,
  Flame,
  Volume2,
  Crosshair,
  Wind,
  Sparkles,
  X,
  Shield,
  Star,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface GamingEasterEggManagerProps {
  themeId: string;
  stealthMode: boolean;
  overallAttendance: number;
  courses: Course[];
  watermarkTriggerCount: number;
}

export function GamingEasterEggManager({
  themeId,
  stealthMode,
  overallAttendance,
  courses,
  watermarkTriggerCount,
}: GamingEasterEggManagerProps) {
  // Cheat Code Buffer for GTA V
  const [cheatBuffer, setCheatBuffer] = useState<string>('');
  const [gtaNotification, setGtaNotification] = useState<string | null>(null);
  const [wantedStars, setWantedStars] = useState<number>(3);
  const [showWasted, setShowWasted] = useState<boolean>(false);
  const [showMissionPassed, setShowMissionPassed] = useState<boolean>(false);

  // Cyberpunk Relic Glitch
  const [showRelicGlitch, setShowRelicGlitch] = useState<boolean>(false);
  const [johnnyQuote, setJohnnyQuote] = useState<string | null>(null);

  // God of War Spartan Rage
  const [spartanRageActive, setSpartanRageActive] = useState<boolean>(false);

  // The Last of Us Flashlight & Listen Mode
  const [flashlightActive, setFlashlightActive] = useState<boolean>(false);
  const [flashlightPos, setFlashlightPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFlickering, setIsFlickering] = useState<boolean>(false);
  const [listenModeActive, setListenModeActive] = useState<boolean>(false);

  // RDR2 Dead Eye & Targets
  const [deadEyeActive, setDeadEyeActive] = useState<boolean>(false);
  const [deadEyeTargets, setDeadEyeTargets] = useState<{ x: number; y: number }[]>([]);

  // Ghost of Tsushima Wind & Haiku
  const [guidingWindActive, setGuidingWindActive] = useState<boolean>(false);
  const [showHaikuModal, setShowHaikuModal] = useState<boolean>(false);

  // 1. Watermark Trigger Handler
  useEffect(() => {
    if (watermarkTriggerCount === 0 || stealthMode) return;

    if (themeId === 'cyberpunk') {
      triggerRelicGlitch();
    } else if (themeId === 'gta') {
      triggerGtaNotification('CHEAT ACTIVATED: Wanted Level Cleared (Dean Notified)');
      setWantedStars(0);
    } else if (themeId === 'godofwar') {
      triggerSpartanRage();
    } else if (themeId === 'tlou') {
      setFlashlightActive((prev) => !prev);
    } else if (themeId === 'rdr2') {
      triggerDeadEye();
    } else if (themeId === 'ghost') {
      setShowHaikuModal(true);
    }
  }, [watermarkTriggerCount, themeId, stealthMode]);

  // Cyberpunk Glitch Trigger
  const triggerRelicGlitch = () => {
    setShowRelicGlitch(true);
    const quote =
      overallAttendance >= 80
        ? `“Wake up, Samurai. You're sitting at ${overallAttendance.toFixed(
            1
          )}% attendance—stop acting like an Arasaka corpo rat and take a day off.” — Johnny Silverhand`
        : `“You're flatlining at ${overallAttendance.toFixed(
            1
          )}%, kid. Keep ditching class and the Dean's gonna chrome-check your hall ticket.” — Johnny Silverhand`;
    setJohnnyQuote(quote);

    setTimeout(() => {
      setShowRelicGlitch(false);
    }, 2800);
    setTimeout(() => {
      setJohnnyQuote(null);
    }, 6500);
  };

  // GTA Cheat Banner
  const triggerGtaNotification = (text: string) => {
    setGtaNotification(text);
    setTimeout(() => setGtaNotification(null), 4000);
  };

  // God of War Spartan Rage
  const triggerSpartanRage = () => {
    setSpartanRageActive(true);
    document.documentElement.style.setProperty('--accent-primary', '#FF4500');
    document.documentElement.style.setProperty('--accent-glow', 'rgba(255, 69, 0, 0.6)');

    setTimeout(() => {
      setSpartanRageActive(false);
      // Restore standard accent
      const cached = localStorage.getItem('myacademia_theme');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          document.documentElement.style.setProperty('--accent-primary', parsed.accent || '#E0E7FF');
        } catch (e) {}
      }
    }, 8000);
  };

  // RDR2 Dead Eye Mode
  const triggerDeadEye = () => {
    setDeadEyeActive(true);
    setTimeout(() => {
      setDeadEyeActive(false);
      setDeadEyeTargets([]);
    }, 4500);
  };

  // Ghost of Tsushima Guiding Wind
  const triggerGuidingWind = () => {
    setGuidingWindActive(true);
    setTimeout(() => setGuidingWindActive(false), 3000);
  };

  // 2. Global Keystroke and Cheat Code Listeners
  useEffect(() => {
    if (stealthMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const key = e.key.toUpperCase();

      // Single Key Triggers
      if (themeId === 'godofwar' && key === 'R' && !spartanRageActive) {
        triggerSpartanRage();
        return;
      }

      if (themeId === 'tlou' && key === 'F') {
        setFlashlightActive((prev) => !prev);
        return;
      }

      if (themeId === 'tlou' && key === 'Q') {
        setListenModeActive(true);
        return;
      }

      if (themeId === 'rdr2' && key === 'X' && !deadEyeActive) {
        triggerDeadEye();
        return;
      }

      if (themeId === 'ghost' && key === 'G' && !guidingWindActive) {
        triggerGuidingWind();
        return;
      }

      // Cheat Buffer for GTA V
      if (themeId === 'gta') {
        setCheatBuffer((prev) => {
          const next = (prev + key).slice(-12);
          if (next.includes('LAWYERUP') || next.includes('AEZAKMI')) {
            triggerGtaNotification('CHEAT ACTIVATED: Wanted Level Cleared (Dean Notified)');
            setWantedStars(0);
            return '';
          }
          if (next.includes('TURTLE') || next.includes('PAINKILLER')) {
            triggerGtaNotification('CHEAT ACTIVATED: Max Academic Armor & Health');
            return '';
          }
          if (next.includes('FUGITIVE')) {
            triggerGtaNotification('CHEAT ACTIVATED: 5-Star Wanted Level by Campus Security');
            setWantedStars(5);
            return '';
          }
          return next;
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (themeId === 'tlou' && e.key.toUpperCase() === 'Q') {
        setListenModeActive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [themeId, stealthMode, spartanRageActive, deadEyeActive, guidingWindActive]);

  // Flashlight Mouse Tracking (The Last of Us)
  useEffect(() => {
    if (!flashlightActive || stealthMode || themeId !== 'tlou') return;

    const handleMouseMove = (e: MouseEvent) => {
      setFlashlightPos({ x: e.clientX, y: e.clientY });
    };

    const handleDoubleClick = () => {
      setIsFlickering(true);
      setTimeout(() => setIsFlickering(false), 500);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('dblclick', handleDoubleClick);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [flashlightActive, stealthMode, themeId]);

  // Dead Eye Click Placer (RDR2)
  useEffect(() => {
    if (!deadEyeActive || stealthMode || themeId !== 'rdr2') return;

    const handleClick = (e: MouseEvent) => {
      setDeadEyeTargets((prev) => [...prev, { x: e.clientX, y: e.clientY }]);
    };

    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, [deadEyeActive, stealthMode, themeId]);

  if (stealthMode) return null;

  return (
    <>
      {/* ======================================================== */}
      {/* 1. CYBERPUNK 2077: RELIC MALFUNCTION GLITCH HUD & JOHNNY */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showRelicGlitch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 pointer-events-none overflow-hidden select-none"
          >
            {/* Red / Cyan Chromatic Aberration Scanlines */}
            <div className="absolute inset-0 bg-[#00F0FF]/10 mix-blend-screen translate-x-1" />
            <div className="absolute inset-0 bg-[#FF003C]/10 mix-blend-screen -translate-x-1" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.8)_100%)]" />

            {/* Top Warning Banner */}
            <div className="absolute top-16 inset-x-0 flex justify-center">
              <div className="px-6 py-2 bg-black/90 border-2 border-[#FF003C] text-[#FF003C] font-mono font-black text-sm tracking-widest uppercase shadow-[0_0_30px_#FF003C] animate-pulse">
                ⚠ RELIC MALFUNCTION DETECTED · NEURAL COMPATIBILITY 34%
              </div>
            </div>

            {/* Glitch Overlay Text */}
            <div className="absolute bottom-20 left-10 font-mono text-xs text-[#FCE300] tracking-widest uppercase">
              BIOMONITOR ERROR: 0xDEADBEEF // ARASAKA PROTOCOL OVERRIDE
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Johnny Silverhand Quote Toast */}
      <AnimatePresence>
        {johnnyQuote && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-xl bg-black/95 border-2 border-[#FCE300] shadow-[0_0_25px_rgba(252,227,0,0.4)] text-white select-none"
          >
            <div className="flex items-center gap-2 mb-1.5 text-[#FCE300] font-mono text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#FF003C] animate-ping" />
              Johnny Silverhand // Construct
            </div>
            <p className="text-xs text-zinc-200 leading-relaxed font-sans italic">
              {johnnyQuote}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 2. GTA V ONLINE: WANTED STARS & CHEAT NOTIFICATIONS       */}
      {/* ======================================================== */}
      {themeId === 'gta' && (
        <>
          {/* Top-Right GTA Wanted Stars */}
          <div className="fixed top-3 right-48 z-40 hidden sm:flex items-center gap-1 bg-black/75 px-3 py-1.5 rounded-lg border border-white/10 shadow-lg">
            <span className="text-[10px] font-mono text-zinc-400 mr-1 uppercase tracking-wider">Wanted</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-3.5 h-3.5 ${
                  star <= wantedStars
                    ? 'text-yellow-400 fill-yellow-400 animate-pulse'
                    : 'text-zinc-600'
                }`}
              />
            ))}
          </div>

          {/* Top-Left Authentic GTA Cheat Activated Banner */}
          <AnimatePresence>
            {gtaNotification && (
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="fixed top-4 left-4 z-50 px-4 py-2 bg-black border-l-4 border-yellow-400 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-2xl"
              >
                {gtaNotification}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ======================================================== */}
      {/* 3. GOD OF WAR: SPARTAN RAGE OVERLAY & KRATOS ADVICE       */}
      {/* ======================================================== */}
      <AnimatePresence>
        {spartanRageActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 pointer-events-none select-none overflow-hidden"
          >
            {/* Fiery Screen Edge Vignette */}
            <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(255,69,0,0.7)] animate-pulse" />

            {/* Spartan Rage Header Banner */}
            <div className="absolute top-16 inset-x-0 flex flex-col items-center">
              <div className="px-6 py-2.5 rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-600 text-white font-bold text-sm tracking-widest uppercase shadow-[0_0_35px_#FF4500] flex items-center gap-2">
                <Flame className="w-4 h-4 animate-bounce" />
                SPARTAN RAGE ACTIVATED · BLADES OF CHAOS
              </div>
              <p className="mt-2 text-xs font-mono text-orange-200 tracking-wider bg-black/80 px-4 py-1 rounded-full border border-orange-500/40">
                “BOY. Do not be sorry about your internal marks. Be better.” — Kratos
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 4. THE LAST OF US: JOEL'S FLASHLIGHT & LISTEN MODE SONAR */}
      {/* ======================================================== */}
      {themeId === 'tlou' && flashlightActive && (
        <div
          className={`fixed inset-0 z-40 pointer-events-none transition-opacity duration-150 ${
            isFlickering ? 'opacity-30' : 'opacity-100'
          }`}
          style={{
            background: `radial-gradient(circle 240px at ${flashlightPos.x}px ${flashlightPos.y}px, rgba(254, 240, 138, 0.18) 0%, rgba(13, 20, 16, 0.94) 100%)`,
          }}
        />
      )}

      {themeId === 'tlou' && listenModeActive && (
        <div className="fixed inset-0 z-40 pointer-events-none backdrop-grayscale backdrop-contrast-125 select-none">
          <div className="absolute top-16 inset-x-0 flex justify-center">
            <span className="px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 font-mono text-xs font-semibold tracking-wider animate-pulse flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5" />
              LISTEN MODE ACTIVE · ACOUSTIC TARGETING
            </span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. RED DEAD REDEMPTION 2: DEAD EYE MODE & HONOR BADGE     */}
      {/* ======================================================== */}
      <AnimatePresence>
        {deadEyeActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 pointer-events-none select-none cursor-crosshair overflow-hidden"
            style={{
              backdropFilter: 'sepia(85%) contrast(115%) brightness(85%)',
            }}
          >
            {/* Top Dead Eye Meter */}
            <div className="absolute top-16 inset-x-0 flex justify-center">
              <div className="px-5 py-1.5 rounded-xl bg-red-950/90 border border-red-500 text-red-200 font-mono text-xs font-bold tracking-widest uppercase shadow-[0_0_25px_#B91C1C] flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-red-400 animate-spin" />
                DEAD EYE LEVEL III · TAGGING SLOTS
              </div>
            </div>

            {/* Click-to-place Dead Eye Red Cross Targets */}
            {deadEyeTargets.map((target, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute text-red-600 font-black text-2xl drop-shadow-[0_0_8px_#FF0000]"
                style={{ left: target.x - 12, top: target.y - 14 }}
              >
                ✖
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 6. GHOST OF TSUSHIMA: GUIDING WIND & SAMURAI HAIKU MODAL */}
      {/* ======================================================== */}
      <AnimatePresence>
        {guidingWindActive && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed top-20 right-10 z-40 px-4 py-2 rounded-xl bg-[#0F141C]/90 border border-cyan-400/40 text-cyan-200 font-mono text-xs flex items-center gap-2 select-none shadow-lg"
          >
            <Wind className="w-4 h-4 text-cyan-300 animate-pulse" />
            <span>Guiding Wind blows toward next classroom...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Samurai Academic Haiku Modal */}
      <AnimatePresence>
        {showHaikuModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="liquid-glass rounded-2xl w-full max-w-md p-6 border border-red-500/30 text-center relative shadow-2xl"
            >
              <button
                onClick={() => setShowHaikuModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-5 h-5" />
              </div>

              <span className="text-[11px] font-mono uppercase tracking-widest text-red-400 block mb-2">
                Ghost of Tsushima · Academic Reflection
              </span>

              <h3 className="text-lg font-serif italic text-white tracking-wide mb-4">
                Haiku of the Student Samurai
              </h3>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 font-serif italic text-sm text-zinc-200 space-y-1.5 leading-relaxed">
                <p>Autumn leaves drift down,</p>
                <p>Eighty-six percent remains,</p>
                <p>Rest your tired blade.</p>
              </div>

              <div className="mt-5 text-[11px] font-mono text-zinc-400">
                Current Attendance: <strong className="text-white">{overallAttendance.toFixed(1)}%</strong> · Honor Preserved
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
