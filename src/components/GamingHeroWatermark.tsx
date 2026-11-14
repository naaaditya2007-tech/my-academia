'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface GamingHeroWatermarkProps {
  themeId: string;
  stealthMode?: boolean;
  onTriggerEasterEgg?: () => void;
}

export function GamingHeroWatermark({
  themeId,
  stealthMode = false,
  onTriggerEasterEgg,
}: GamingHeroWatermarkProps) {
  if (stealthMode) return null;

  // Render game-specific silhouette vector watermark
  switch (themeId) {
    case 'cyberpunk':
      return (
        <div className="fixed bottom-0 right-4 z-0 pointer-events-none select-none hidden md:block">
          <div className="relative">
            {/* Interactive Hitbox */}
            <button
              onClick={onTriggerEasterEgg}
              className="pointer-events-auto cursor-pointer absolute bottom-12 right-12 w-28 h-28 rounded-full z-20 group focus:outline-none"
              title="Click: Trigger Relic Malfunction & Johnny Silverhand"
            >
              <div className="w-full h-full rounded-full border border-yellow-400/0 group-hover:border-yellow-400/40 group-hover:bg-yellow-400/10 transition-all flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 font-mono text-[9px] uppercase tracking-wider text-yellow-300 bg-black/80 px-2 py-0.5 rounded border border-yellow-400/30 transition-opacity">
                  Samurai Oni
                </span>
              </div>
            </button>

            {/* Cyberpunk Samurai Oni Mask + V Collar SVG */}
            <svg
              className="w-80 h-96 opacity-25 hover:opacity-40 transition-opacity duration-300 drop-shadow-[0_0_25px_rgba(252,227,0,0.3)]"
              viewBox="0 0 320 380"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Oni Horns */}
              <path
                d="M100 80 C80 30, 40 20, 20 40 C40 70, 70 110, 95 130 Z"
                fill="url(#cyberGlitchGrad)"
                className="animate-pulse"
              />
              <path
                d="M220 80 C240 30, 280 20, 300 40 C280 70, 250 110, 225 130 Z"
                fill="url(#cyberGlitchGrad)"
                className="animate-pulse"
              />
              {/* Mask Face Contour */}
              <path
                d="M80 120 L160 80 L240 120 L260 210 L210 270 L160 290 L110 270 L60 210 Z"
                fill="#160D24"
                stroke="#00F0FF"
                strokeWidth="2.5"
                strokeDasharray="8 4"
              />
              {/* LED Eye Slits */}
              <path
                d="M95 160 L140 175 L135 185 L90 170 Z"
                fill="#FCE300"
                className="animate-pulse"
              />
              <path
                d="M225 160 L180 175 L185 185 L230 170 Z"
                fill="#FCE300"
                className="animate-pulse"
              />
              {/* Fierce Oni Fangs */}
              <path d="M120 220 L130 250 L140 220 Z" fill="#00F0FF" />
              <path d="M200 220 L190 250 L180 220 Z" fill="#00F0FF" />
              <path d="M145 225 L160 260 L175 225 Z" fill="#FF003C" />
              {/* V's High-Collar Cyberpunk Jacket Base */}
              <path
                d="M40 380 L60 280 L110 270 L160 310 L210 270 L260 280 L280 380 Z"
                fill="#0A0814"
                stroke="#FCE300"
                strokeWidth="2"
              />
              {/* Glowing LED Collar Strip */}
              <path
                d="M75 285 L160 325 L245 285"
                stroke="#00F0FF"
                strokeWidth="4"
                strokeLinecap="round"
                className="animate-pulse"
              />
              <defs>
                <linearGradient id="cyberGlitchGrad" x1="0" y1="0" x2="320" y2="380" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FCE300" />
                  <stop offset="50%" stopColor="#FF003C" />
                  <stop offset="100%" stopColor="#00F0FF" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      );

    case 'gta':
      return (
        <div className="fixed bottom-0 right-4 z-0 pointer-events-none select-none hidden md:block">
          <div className="relative">
            {/* Interactive Hitbox */}
            <button
              onClick={onTriggerEasterEgg}
              className="pointer-events-auto cursor-pointer absolute bottom-14 right-14 w-28 h-28 rounded-full z-20 group focus:outline-none"
              title="Click: Trigger Los Santos Heist Alert"
            >
              <div className="w-full h-full rounded-full border border-emerald-400/0 group-hover:border-emerald-400/40 group-hover:bg-emerald-400/10 transition-all flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 font-mono text-[9px] uppercase tracking-wider text-emerald-300 bg-black/80 px-2 py-0.5 rounded border border-emerald-400/30 transition-opacity">
                  Vinewood
                </span>
              </div>
            </button>

            {/* GTA V Skyline & Palm Trees Vector */}
            <svg
              className="w-84 h-80 opacity-20 hover:opacity-35 transition-opacity duration-300 drop-shadow-[0_0_20px_rgba(46,204,113,0.3)]"
              viewBox="0 0 340 320"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Distant Skyscrapers */}
              <rect x="30" y="110" width="45" height="210" fill="#151D2A" />
              <rect x="90" y="70" width="55" height="250" fill="#0F1722" />
              <polygon points="117,30 90,70 145,70" fill="#0F1722" />
              <line x1="117" y1="30" x2="117" y2="10" stroke="#F39C12" strokeWidth="2" />
              <rect x="160" y="130" width="50" height="190" fill="#131B28" />
              <rect x="225" y="90" width="60" height="230" fill="#0F1722" />
              {/* Iconic Palm Trees Silhouette */}
              <path
                d="M285 320 Q290 220 280 150 Q285 100 275 80"
                stroke="#090E17"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path d="M275 80 Q240 60 210 90 Q250 80 275 80" fill="#090E17" />
              <path d="M275 80 Q260 40 240 50 Q260 65 275 80" fill="#090E17" />
              <path d="M275 80 Q310 40 330 65 Q300 70 275 80" fill="#090E17" />
              <path d="M275 80 Q320 80 340 110 Q310 95 275 80" fill="#090E17" />
              {/* Helicopter Searchlight Cone */}
              <polygon
                points="80,40 0,320 180,320"
                fill="url(#searchlightGrad)"
                opacity="0.18"
              />
              <circle cx="80" cy="40" r="4" fill="#E84393" />
              <defs>
                <linearGradient id="searchlightGrad" x1="80" y1="40" x2="90" y2="320" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2ECC71" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#2ECC71" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      );

    case 'godofwar':
      return (
        <div className="fixed bottom-0 right-4 z-0 pointer-events-none select-none hidden md:block">
          <div className="relative">
            {/* Interactive Hitbox */}
            <button
              onClick={onTriggerEasterEgg}
              className="pointer-events-auto cursor-pointer absolute bottom-16 right-16 w-28 h-28 rounded-full z-20 group focus:outline-none"
              title="Click / Press R: Ignite Spartan Rage"
            >
              <div className="w-full h-full rounded-full border border-cyan-400/0 group-hover:border-orange-500/50 group-hover:bg-orange-500/10 transition-all flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 font-mono text-[9px] uppercase tracking-wider text-orange-400 bg-black/80 px-2 py-0.5 rounded border border-orange-500/30 transition-opacity">
                  Ω Spartan Rage
                </span>
              </div>
            </button>

            {/* Kratos & Leviathan Axe Vector */}
            <svg
              className="w-80 h-96 opacity-25 hover:opacity-40 transition-opacity duration-300 drop-shadow-[0_0_25px_rgba(56,189,248,0.3)]"
              viewBox="0 0 320 380"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Crimson Omega Symbol In Background */}
              <path
                d="M160 50 C110 50, 70 90, 70 140 C70 175, 90 205, 120 220 L100 250 L140 250 C145 235, 155 230, 160 230 C165 230, 175 235, 180 250 L220 250 L200 220 C230 205, 250 175, 250 140 C250 90, 210 50, 160 50 Z"
                stroke="#DC2626"
                strokeWidth="12"
                fill="none"
                opacity="0.35"
              />
              {/* Leviathan Axe Blade (Frost Blue with Nordic Runes) */}
              <path
                d="M180 20 Q260 40 290 110 Q240 115 190 90 Z"
                fill="#162232"
                stroke="#38BDF8"
                strokeWidth="3"
              />
              <path
                d="M190 90 Q250 130 270 180 Q220 150 180 120 Z"
                fill="#162232"
                stroke="#38BDF8"
                strokeWidth="3"
              />
              {/* Axe Shaft */}
              <line x1="180" y1="15" x2="60" y2="380" stroke="#5C3D24" strokeWidth="8" strokeLinecap="round" />
              {/* Glowing Rune Inlay on Axe */}
              <path
                d="M220 70 L235 90 L225 105 M245 85 L260 100"
                stroke="#38BDF8"
                strokeWidth="2"
                strokeLinecap="round"
                className="animate-pulse"
              />
              {/* Kratos Profile Silhouette with Beard */}
              <path
                d="M40 380 C40 320, 60 280, 80 250 C85 230, 80 200, 75 180 C80 150, 110 130, 140 140 C155 145, 165 160, 170 180 C160 210, 155 240, 140 260 C125 285, 130 330, 135 380 Z"
                fill="#0C131F"
              />
              {/* Spartan Red War Paint Stripe */}
              <path
                d="M120 140 Q105 170 95 210 Q90 230 85 260"
                stroke="#DC2626"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      );

    case 'tlou':
      return (
        <div className="fixed bottom-0 right-4 z-0 pointer-events-none select-none hidden md:block">
          <div className="relative">
            {/* Interactive Hitbox */}
            <button
              onClick={onTriggerEasterEgg}
              className="pointer-events-auto cursor-pointer absolute bottom-14 right-14 w-28 h-28 rounded-full z-20 group focus:outline-none"
              title="Click / Press F: Toggle Joel's Flashlight"
            >
              <div className="w-full h-full rounded-full border border-yellow-400/0 group-hover:border-yellow-400/40 group-hover:bg-yellow-400/10 transition-all flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 font-mono text-[9px] uppercase tracking-wider text-yellow-300 bg-black/80 px-2 py-0.5 rounded border border-yellow-400/30 transition-opacity">
                  🔦 Flashlight
                </span>
              </div>
            </button>

            {/* Firefly Winged Emblem & Foliage Silhouette */}
            <svg
              className="w-80 h-84 opacity-25 hover:opacity-40 transition-opacity duration-300 drop-shadow-[0_0_20px_rgba(234,179,8,0.3)]"
              viewBox="0 0 320 340"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Firefly Winged Stencil Emblem */}
              <circle cx="160" cy="140" r="18" fill="#EAB308" opacity="0.4" className="animate-pulse" />
              {/* Upper Wings */}
              <path d="M160 130 Q110 80 60 100 Q105 120 150 135 Z" fill="#D97706" />
              <path d="M160 130 Q210 80 260 100 Q215 120 170 135 Z" fill="#D97706" />
              {/* Lower Wings */}
              <path d="M160 145 Q120 170 80 160 Q115 150 152 143 Z" fill="#B45309" />
              <path d="M160 145 Q200 170 240 160 Q205 150 168 143 Z" fill="#B45309" />
              {/* Firefly Central Tail Spine */}
              <line x1="160" y1="110" x2="160" y2="210" stroke="#EAB308" strokeWidth="4" strokeLinecap="round" />
              {/* Overgrown Fern & Foliage Silhouette */}
              <path
                d="M20 340 Q40 280 80 260 Q50 290 30 340 M260 340 Q280 270 310 250 Q290 290 270 340"
                stroke="#1B2E1E"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Joel & Ellie Silhouette (Backpack & Rifle) */}
              <path
                d="M90 340 C90 300, 110 280, 130 270 C140 250, 135 230, 130 220 C135 205, 150 195, 165 200 C175 220, 180 250, 175 270 C195 285, 205 310, 210 340 Z"
                fill="#0C140E"
              />
              <line x1="125" y1="210" x2="105" y2="160" stroke="#0C140E" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      );

    case 'rdr2':
      return (
        <div className="fixed bottom-0 right-4 z-0 pointer-events-none select-none hidden md:block">
          <div className="relative">
            {/* Interactive Hitbox */}
            <button
              onClick={onTriggerEasterEgg}
              className="pointer-events-auto cursor-pointer absolute bottom-16 right-16 w-28 h-28 rounded-full z-20 group focus:outline-none"
              title="Click / Press X: Activate Dead Eye Mode"
            >
              <div className="w-full h-full rounded-full border border-red-500/0 group-hover:border-red-500/50 group-hover:bg-red-500/10 transition-all flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 font-mono text-[9px] uppercase tracking-wider text-red-400 bg-black/80 px-2 py-0.5 rounded border border-red-500/30 transition-opacity">
                  ✖ Dead Eye
                </span>
              </div>
            </button>

            {/* Arthur Morgan on Horseback Sunset Silhouette */}
            <svg
              className="w-88 h-92 opacity-25 hover:opacity-40 transition-opacity duration-300 drop-shadow-[0_0_25px_rgba(220,38,38,0.3)]"
              viewBox="0 0 340 360"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Giant Amber Setting Sun */}
              <circle cx="170" cy="180" r="100" fill="url(#rdr2SunGrad)" opacity="0.4" />
              {/* Ridge Mountain Curve */}
              <path
                d="M0 360 Q120 300 220 280 Q290 270 340 290 L340 360 Z"
                fill="#150909"
              />
              {/* Horse Silhouette */}
              <path
                d="M120 280 Q140 240 180 230 Q220 225 240 210 Q250 200 255 180 Q265 190 260 210 Q255 235 240 250 L250 310 L235 310 L220 265 L180 270 L170 310 L155 310 L160 270 Q140 275 125 285 Z"
                fill="#0A0404"
              />
              {/* Arthur Morgan in Stetson Hat */}
              <path
                d="M175 220 Q180 180 185 165 Q180 155 170 155 Q160 155 155 160 Q150 150 170 145 Q195 145 200 155 Q205 160 195 170 Q195 185 195 220 Z"
                fill="#0A0404"
              />
              {/* Hat Brim */}
              <path d="M145 158 Q175 145 210 155" stroke="#0A0404" strokeWidth="5" strokeLinecap="round" />
              <defs>
                <radialGradient id="rdr2SunGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="60%" stopColor="#DC2626" />
                  <stop offset="100%" stopColor="#0D0606" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
          </div>
        </div>
      );

    case 'ghost':
      return (
        <div className="fixed bottom-0 right-4 z-0 pointer-events-none select-none hidden md:block">
          <div className="relative">
            {/* Interactive Hitbox */}
            <button
              onClick={onTriggerEasterEgg}
              className="pointer-events-auto cursor-pointer absolute bottom-16 right-16 w-28 h-28 rounded-full z-20 group focus:outline-none"
              title="Click: Reflect on Academics (Samurai Haiku)"
            >
              <div className="w-full h-full rounded-full border border-rose-500/0 group-hover:border-rose-500/50 group-hover:bg-rose-500/10 transition-all flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 font-mono text-[9px] uppercase tracking-wider text-rose-300 bg-black/80 px-2 py-0.5 rounded border border-rose-500/30 transition-opacity">
                  ⛩ Haiku
                </span>
              </div>
            </button>

            {/* Jin Sakai Katana Stance, Moon & Torii Gate Vector */}
            <svg
              className="w-84 h-96 opacity-25 hover:opacity-40 transition-opacity duration-300 drop-shadow-[0_0_25px_rgba(225,29,72,0.3)]"
              viewBox="0 0 330 380"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Full Tsushima Moon */}
              <circle cx="210" cy="140" r="75" fill="#E2E8F0" opacity="0.3" />
              {/* Distant Torii Gate Silhouette */}
              <rect x="175" y="110" width="8" height="90" fill="#0E1017" />
              <rect x="235" y="110" width="8" height="90" fill="#0E1017" />
              <path d="M160 115 Q210 108 260 115" stroke="#0E1017" strokeWidth="6" strokeLinecap="round" />
              <path d="M165 125 L255 125" stroke="#0E1017" strokeWidth="3" />
              {/* Jin Sakai (Ghost Armor & Cape) */}
              <path
                d="M50 380 Q70 300 90 260 Q105 230 115 190 Q125 170 140 180 Q150 190 145 220 Q160 250 170 300 L180 380 Z"
                fill="#0A0B10"
              />
              {/* Katana Blade Drawn Across Front */}
              <path
                d="M80 290 L270 170"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              />
              <line x1="65" y1="300" x2="80" y2="290" stroke="#E11D48" strokeWidth="4" strokeLinecap="round" />
              {/* Swirling Crimson Maple Leaf Accents */}
              <path d="M220 220 Q230 210 240 220 Q230 230 220 220 Z" fill="#E11D48" />
              <path d="M180 260 Q190 250 200 260 Q190 270 180 260 Z" fill="#E11D48" />
              <path d="M260 280 Q270 270 280 280 Q270 290 260 280 Z" fill="#E11D48" />
            </svg>
          </div>
        </div>
      );

    default:
      return null;
  }
}
