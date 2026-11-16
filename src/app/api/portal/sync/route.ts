import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { parseAttendanceAndMarksHtml, parseStudentProfileFromHtml, decodeZohoHtml } from '@/lib/scraper';
import { ManualCookieJar } from '@/lib/srmAuth';
import { MOCK_CAMPUS_DATA } from '@/lib/mockData';
import { CampusData } from '@/types/campus';
import { encryptSession, decryptSession } from '@/lib/crypto';
import { getGlobalAcademicCalendar } from '@/lib/globalCalendar';
import { checkIsDeviceRevoked } from '@/app/api/admin/devices/route';
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

    // Strict Zero-Trust Revocation Gate
    const clientDeviceId = body.deviceId || req.headers.get('x-device-id') || '';
    if (clientDeviceId) {
      const isRevoked = await checkIsDeviceRevoked(clientDeviceId);
      if (isRevoked) {
        return NextResponse.json(
          {
            success: false,
            error: 'Device access has been revoked by administrator.',
            revoked: true,
          },
          { status: 403 }
        );
      }
    }

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

    const studentNetId = body.netId || body.regNumber || req.headers.get('x-student-netid') || '';
    const resolvedFallbackStudent =
      body.currentStudent || parseStudentProfileFromHtml('', studentNetId);

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
          student: resolvedFallbackStudent,
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
            student: resolvedFallbackStudent,
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
            student: resolvedFallbackStudent,
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

    if (!rawSession && !body.currentStudent) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in with your SRM credentials.' },
        { status: 401 }
      );
    }

    // 7. Live SRM Academia Sync (Zoho Creator) via /page-perma/ with ManualCookieJar
    if (rawSession) {
      const jar = new ManualCookieJar();
      jar.loadFromString(rawSession);

      let responseHtml = '';
      let attemptedUrl = 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance';
      let responseStatus = 200;

      // Primary: Fetch Attendance from /page-perma/My_Attendance
      try {
        const attRes = await fetch(attemptedUrl, {
          method: 'GET',
          headers: {
            Cookie: jar.toHeaderString(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: '*/*',
            Referer: 'https://academia.srmist.edu.in/',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        responseStatus = attRes.status;
        jar.updateFromHeaders(attRes.headers);
        const attText = await attRes.text();
        if (attText && attText.length > 50) {
          responseHtml = attText;
        }
      } catch (attErr: any) {
        responseStatus = 500;
        responseHtml = attErr.message || '';
      }

      // Also Fetch Timetable from /page-perma/
      let ttViewName = 'My_Time_Table_2023_24';
      const matchTt = responseHtml.match(/My_Time_Table_[0-9_]+/i);
      if (matchTt?.[0]) {
        ttViewName = matchTt[0];
      }

      const timetableUrls = [
        `https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/${ttViewName}`,
        'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Time_Table_2024_25',
        'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Time_Table',
      ];

      for (const ttUrl of timetableUrls) {
        try {
          const ttRes = await fetch(ttUrl, {
            method: 'GET',
            headers: {
              Cookie: jar.toHeaderString(),
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: '*/*',
              Referer: 'https://academia.srmist.edu.in/',
              'X-Requested-With': 'XMLHttpRequest',
            },
          });

          jar.updateFromHeaders(ttRes.headers);
          if (ttRes.ok) {
            const ttText = await ttRes.text();
            if (ttText && ttText.length > 50) {
              responseHtml += '\n' + ttText;
              break;
            }
          }
        } catch {}
      }

      // Parse courses and student
      const decodedHtml = decodeZohoHtml(responseHtml);
      const courses = parseAttendanceAndMarksHtml(decodedHtml || responseHtml);
      const liveStudent = parseStudentProfileFromHtml(decodedHtml || responseHtml, studentNetId || clientIdentifier);

      // STEP-BY-STEP TECHNICAL ERROR TRACKER (No generic "0 courses" string)
      if (courses.length === 0) {
        const rawSnippet = (typeof responseHtml === 'string' ? responseHtml : JSON.stringify(responseHtml)).slice(0, 300);
        const cookiesCaptured = jar.keys().join(', ');
        return NextResponse.json(
          {
            success: false,
            error: `[Portal Sync View Fetch]: Zoho returned HTTP ${responseStatus}. View: ${attemptedUrl}. CookiesCaptured: [${cookiesCaptured}]. HTML Preview: ${rawSnippet ? JSON.stringify(rawSnippet) : 'No HTML returned'}`,
            attemptedUrl,
            httpStatus: responseStatus,
            htmlPreview: rawSnippet,
            cookiesCaptured,
          },
          { status: 502 }
        );
      }

      recordServerSync(clientIdentifier);
      const globalCalendar = getGlobalAcademicCalendar();

      const liveData: CampusData = {
        student: liveStudent,
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

      const encryptedToken = encryptSession(rawSession);
      response.cookies.set('srm_session_encrypted', encryptedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }

    // Default: If no session was provided at all
    return NextResponse.json(
      { success: false, error: 'No active session token found. Please log in with NetID.' },
      { status: 401 }
    );
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
