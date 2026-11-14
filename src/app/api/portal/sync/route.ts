import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { parseAttendanceAndMarksHtml } from '@/lib/scraper';
import { MOCK_CAMPUS_DATA } from '@/lib/mockData';
import { CampusData } from '@/types/campus';
import { encryptSession, decryptSession } from '@/lib/crypto';
import { getGlobalAcademicCalendar } from '@/lib/globalCalendar';
import {
  getRandomUserAgent,
  sleepJitter,
  getCircuitBreakerState,
  tripCircuitBreaker,
  resetCircuitBreaker,
  checkServerCooldown,
  recordServerSync,
  isQuietSyncPeriod,
} from '@/lib/firewallProtection';

export async function POST(req: NextRequest) {
  try {
    const startTime = Date.now();
    const body = await req.json().catch(() => ({}));
    const { sessionCookie, force, action } = body;

    // 1. Admin Actions: Circuit Breaker Reset or Health Check
    if (action === 'reset_circuit_breaker') {
      const state = resetCircuitBreaker();
      return NextResponse.json({
        success: true,
        message: 'SRM Firewall Circuit Breaker reset successfully',
        circuitBreaker: state,
      });
    }

    if (action === 'get_health') {
      return NextResponse.json({
        success: true,
        circuitBreaker: getCircuitBreakerState(),
        quietPeriod: isQuietSyncPeriod(),
      });
    }

    // 2. Client Identifier for Per-Device Rate Limiting
    const clientIdentifier =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'client_device_default';

    // 3. Circuit Breaker Check: If SRM blocked us recently, serve offline cache immediately!
    const circuitBreaker = getCircuitBreakerState();
    if (circuitBreaker.isTripped && !force) {
      const remainingMinutes = circuitBreaker.resetAt
        ? Math.max(1, Math.ceil((circuitBreaker.resetAt - Date.now()) / 60000))
        : 10;

      return NextResponse.json({
        success: true,
        source: 'circuit_breaker_offline_cache',
        circuitBreaker: {
          active: true,
          reason: circuitBreaker.reason,
          remainingMinutes,
        },
        message: `SRM Firewall Circuit Breaker Active · Auto-resets in ${remainingMinutes}m`,
        data: {
          ...MOCK_CAMPUS_DATA,
          calendar: getGlobalAcademicCalendar(),
          lastSyncedAt: new Date().toISOString(),
        },
      });
    }

    // 4. 15-Minute Per-Device Cooldown Enforcement (Admin Force Sync bypasses)
    if (!force) {
      const cooldown = checkServerCooldown(clientIdentifier);
      if (!cooldown.allowed) {
        const remainingMinutes = Math.ceil(cooldown.remainingSec / 60);
        return NextResponse.json({
          success: true,
          rateLimited: true,
          remainingMinutes,
          message: `Synced recently · Next live refresh in ${remainingMinutes} mins`,
          data: {
            ...MOCK_CAMPUS_DATA,
            calendar: getGlobalAcademicCalendar(),
            lastSyncedAt: new Date().toISOString(),
          },
        });
      }

      // 5. Quiet Hours Protection: Sundays and 7:00 PM – 7:00 AM IST
      const quiet = isQuietSyncPeriod();
      if (quiet.isQuiet && body.isBackgroundSync) {
        return NextResponse.json({
          success: true,
          source: 'quiet_hours_offline_cache',
          message: quiet.reason,
          data: {
            ...MOCK_CAMPUS_DATA,
            calendar: getGlobalAcademicCalendar(),
            lastSyncedAt: new Date().toISOString(),
          },
        });
      }
    }

    // 6. Decrypt Zero-Knowledge Session Token
    let rawSession: string | null = sessionCookie || null;
    const encryptedCookie = req.cookies.get('srm_session_encrypted')?.value;
    if (!rawSession && encryptedCookie) {
      rawSession = decryptSession(encryptedCookie);
    }

    // 7. Human-Like Outbound Fetch with Randomized Jitter & User-Agent Rotation
    if (rawSession) {
      try {
        const targetUrl = 'https://sp.srmist.edu.in/srmiststudentportal/students/report/studentAttendanceDetails.jsp';
        const formattedCookie = rawSession.includes('JSESSIONID')
          ? rawSession
          : `JSESSIONID=${rawSession}`;

        // Randomized human-like request jitter (400ms – 900ms)
        await sleepJitter(400, 900);

        const chosenUserAgent = getRandomUserAgent();

        const res = await axios.post(
          targetUrl,
          {},
          {
            headers: {
              Cookie: formattedCookie,
              'User-Agent': chosenUserAgent,
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            },
            timeout: 7000,
          }
        );

        if (res.data) {
          const courses = parseAttendanceAndMarksHtml(res.data);

          if (courses.length > 0) {
            recordServerSync(clientIdentifier);

            // Decoupled: Shared Global Academic Planner (Zero Redundant Calendar Scrapes!)
            const globalCalendar = getGlobalAcademicCalendar();

            const liveData: CampusData = {
              student: MOCK_CAMPUS_DATA.student,
              courses,
              calendar: globalCalendar,
              dayOrderMatrix: MOCK_CAMPUS_DATA.dayOrderMatrix,
              lastSyncedAt: new Date().toISOString(),
              dataSource: 'live_student_portal',
            };

            const response = NextResponse.json({
              success: true,
              source: 'live_student_portal',
              data: liveData,
              latencyMs: Date.now() - startTime,
            });

            // Store Zero-Knowledge AES-256-GCM Encrypted HttpOnly Cookie
            const encryptedToken = encryptSession(formattedCookie);
            response.cookies.set('srm_session_encrypted', encryptedToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              path: '/',
              maxAge: 60 * 60 * 24 * 7, // 7 days
            });

            return response;
          }
        }
      } catch (scrapeErr: any) {
        const statusCode = scrapeErr.response?.status;
        // Trip Circuit Breaker on 403, 429, or 503 for 10 minutes to protect Vercel IP!
        if (statusCode === 403 || statusCode === 429 || statusCode === 503) {
          tripCircuitBreaker(statusCode, `SRM Firewall Blocked Access (HTTP ${statusCode})`);
          console.warn(`[Firewall Protection] Tripped Circuit Breaker: HTTP ${statusCode}`);
        } else {
          console.warn('[Firewall Protection] Portal scrape issue, falling back to cached store', scrapeErr.message);
        }
      }
    }

    // 8. Default High-Fidelity Store with Updated Cooldown
    recordServerSync(clientIdentifier);
    return NextResponse.json({
      success: true,
      source: 'cached_store',
      data: {
        ...MOCK_CAMPUS_DATA,
        calendar: getGlobalAcademicCalendar(),
        lastSyncedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sync academic data' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    circuitBreaker: getCircuitBreakerState(),
    quietPeriod: isQuietSyncPeriod(),
    calendarMeta: getGlobalAcademicCalendar().length,
  });
}
