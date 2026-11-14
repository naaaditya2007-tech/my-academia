import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyAcademia',
  description: 'Academic companion for SRMIST students',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MyAcademia',
  },
};

export const viewport: Viewport = {
  themeColor: '#080B0E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

const themeInitScript = `
(function() {
  try {
    var raw = localStorage.getItem('myacademia_theme') || localStorage.getItem('campuscore_theme_prefs');
    var themeMap = {
      blurple: {
        bgCanvas: '#0E1015',
        bgSurface: '#181920',
        bgElevated: '#22242E',
        glassSurface: 'rgba(24, 25, 32, 0.72)',
        glassBorder: 'rgba(88, 101, 242, 0.22)',
        borderSubtle: 'rgba(88, 101, 242, 0.22)',
        borderHighlight: 'rgba(88, 101, 242, 0.45)',
        accentPrimary: '#5865F2',
        accentSecondary: '#EB459E'
      },
      cyberpunk: {
        bgCanvas: '#050308',
        bgSurface: '#12091A',
        bgElevated: '#1B0F26',
        glassSurface: 'rgba(18, 9, 26, 0.78)',
        glassBorder: 'rgba(0, 240, 255, 0.28)',
        borderSubtle: 'rgba(0, 240, 255, 0.25)',
        borderHighlight: 'rgba(252, 227, 0, 0.5)',
        accentPrimary: '#FCE300',
        accentSecondary: '#00F0FF'
      },
      gta: {
        bgCanvas: '#08080C',
        bgSurface: '#14141E',
        bgElevated: '#1F1F2E',
        glassSurface: 'rgba(20, 20, 30, 0.78)',
        glassBorder: 'rgba(235, 110, 255, 0.28)',
        borderSubtle: 'rgba(235, 110, 255, 0.22)',
        borderHighlight: 'rgba(0, 255, 163, 0.5)',
        accentPrimary: '#EB6EFF',
        accentSecondary: '#00FFA3'
      },
      godofwar: {
        bgCanvas: '#0B0D13',
        bgSurface: '#151A24',
        bgElevated: '#1F2736',
        glassSurface: 'rgba(21, 26, 36, 0.78)',
        glassBorder: 'rgba(147, 197, 253, 0.25)',
        borderSubtle: 'rgba(147, 197, 253, 0.22)',
        borderHighlight: 'rgba(255, 69, 0, 0.5)',
        accentPrimary: '#93C5FD',
        accentSecondary: '#FF4500'
      },
      tlou: {
        bgCanvas: '#0A0E0C',
        bgSurface: '#131A16',
        bgElevated: '#1B2620',
        glassSurface: 'rgba(19, 26, 22, 0.78)',
        glassBorder: 'rgba(217, 119, 6, 0.28)',
        borderSubtle: 'rgba(217, 119, 6, 0.22)',
        borderHighlight: 'rgba(132, 204, 22, 0.5)',
        accentPrimary: '#D97706',
        accentSecondary: '#84CC16'
      },
      rdr2: {
        bgCanvas: '#0E0909',
        bgSurface: '#1C1212',
        bgElevated: '#2A1B1B',
        glassSurface: 'rgba(28, 18, 18, 0.78)',
        glassBorder: 'rgba(220, 38, 38, 0.28)',
        borderSubtle: 'rgba(220, 38, 38, 0.22)',
        borderHighlight: 'rgba(245, 158, 11, 0.5)',
        accentPrimary: '#DC2626',
        accentSecondary: '#F59E0B'
      },
      ghost: {
        bgCanvas: '#090B0F',
        bgSurface: '#121720',
        bgElevated: '#1A212E',
        glassSurface: 'rgba(18, 23, 32, 0.78)',
        glassBorder: 'rgba(225, 29, 72, 0.28)',
        borderSubtle: 'rgba(225, 29, 72, 0.22)',
        borderHighlight: 'rgba(56, 189, 248, 0.5)',
        accentPrimary: '#E11D48',
        accentSecondary: '#38BDF8'
      },
      crimson: {
        bgCanvas: '#0B090A',
        bgSurface: '#161215',
        bgElevated: '#221B20',
        glassSurface: 'rgba(22, 18, 21, 0.75)',
        glassBorder: 'rgba(239, 35, 60, 0.22)',
        borderSubtle: 'rgba(239, 35, 60, 0.22)',
        borderHighlight: 'rgba(239, 35, 60, 0.45)',
        accentPrimary: '#EF233C',
        accentSecondary: '#FF758F'
      },
      emerald: {
        bgCanvas: '#080B0E',
        bgSurface: '#11161C',
        bgElevated: '#182028',
        glassSurface: 'rgba(17, 22, 28, 0.68)',
        glassBorder: 'rgba(255, 255, 255, 0.1)',
        borderSubtle: 'rgba(16, 185, 129, 0.2)',
        borderHighlight: 'rgba(16, 185, 129, 0.45)',
        accentPrimary: '#10B981',
        accentSecondary: '#34D399'
      },
      chroma: {
        bgCanvas: 'linear-gradient(135deg, #090D16 0%, #120E24 50%, #091921 100%)',
        bgSurface: 'rgba(20, 22, 38, 0.85)',
        bgElevated: 'rgba(32, 35, 58, 0.9)',
        glassSurface: 'rgba(20, 22, 38, 0.78)',
        glassBorder: 'rgba(139, 92, 246, 0.28)',
        borderSubtle: 'rgba(139, 92, 246, 0.28)',
        borderHighlight: 'rgba(6, 182, 212, 0.5)',
        accentPrimary: '#8B5CF6',
        accentSecondary: '#06B6D4'
      },
      sunset: {
        bgCanvas: 'linear-gradient(135deg, #110B18 0%, #1F1124 60%, #261419 100%)',
        bgSurface: 'rgba(28, 18, 33, 0.85)',
        bgElevated: 'rgba(45, 27, 52, 0.9)',
        glassSurface: 'rgba(28, 18, 33, 0.8)',
        glassBorder: 'rgba(244, 63, 94, 0.28)',
        borderSubtle: 'rgba(244, 63, 94, 0.28)',
        borderHighlight: 'rgba(245, 158, 11, 0.5)',
        accentPrimary: '#F43F5E',
        accentSecondary: '#F59E0B'
      },
      tokyo: {
        bgCanvas: '#1A1B26',
        bgSurface: '#24283B',
        bgElevated: '#2F354F',
        glassSurface: 'rgba(36, 40, 59, 0.78)',
        glassBorder: 'rgba(122, 162, 247, 0.22)',
        borderSubtle: 'rgba(122, 162, 247, 0.2)',
        borderHighlight: 'rgba(122, 162, 247, 0.45)',
        accentPrimary: '#7AA2F7',
        accentSecondary: '#BB9AF7'
      },
      vanta: {
        bgCanvas: '#000000',
        bgSurface: '#0A0A0C',
        bgElevated: '#141418',
        glassSurface: 'rgba(10, 10, 12, 0.85)',
        glassBorder: 'rgba(255, 255, 255, 0.14)',
        borderSubtle: 'rgba(255, 255, 255, 0.12)',
        borderHighlight: 'rgba(255, 255, 255, 0.3)',
        accentPrimary: '#FFFFFF',
        accentSecondary: '#A1A1AA'
      },
      nordic: {
        bgCanvas: '#12161F',
        bgSurface: '#1B2230',
        bgElevated: '#263044',
        glassSurface: 'rgba(27, 34, 48, 0.78)',
        glassBorder: 'rgba(136, 192, 208, 0.22)',
        borderSubtle: 'rgba(136, 192, 208, 0.2)',
        borderHighlight: 'rgba(136, 192, 208, 0.45)',
        accentPrimary: '#88C0D0',
        accentSecondary: '#81A1C1'
      }
    };

    var id = 'emerald';
    var customAccent = null;
    if (raw) {
      var p = JSON.parse(raw);
      if (p.themeId && themeMap[p.themeId]) id = p.themeId;
      if (p.accent) customAccent = p.accent;
    }
    var t = themeMap[id] || themeMap.emerald;
    var root = document.documentElement;
    root.style.setProperty('--bg-canvas', t.bgCanvas);
    root.style.setProperty('--bg-surface', t.bgSurface);
    root.style.setProperty('--bg-elevated', t.bgElevated);
    root.style.setProperty('--glass-surface', t.glassSurface);
    root.style.setProperty('--glass-border', t.glassBorder);
    root.style.setProperty('--border-subtle', t.borderSubtle);
    root.style.setProperty('--border-highlight', t.borderHighlight);
    root.style.setProperty('--accent-primary', customAccent || t.accentPrimary);
    root.style.setProperty('--accent-secondary', t.accentSecondary);
    root.setAttribute('data-theme', id);
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[var(--bg-canvas)] text-[var(--foreground)] selection:bg-[var(--accent-primary)]/30 selection:text-[var(--accent-primary)]">
        {children}
      </body>
    </html>
  );
}
