import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { parseAttendanceAndMarksHtml, parseStudentProfileFromHtml } from '@/lib/scraper';
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

    // 7. Live SRM Portal Sync (Supports both SRM Academia & Student Portal)
    if (rawSession) {
      let responseHtml = '';
      let attemptedUrl = '';
      let responseStatus = 200;

      const isAcademiaSession =
        rawSession.includes('iamcsr') ||
        rawSession.includes('academia') ||
        rawSession.includes('_zcsr_tmp');

      if (isAcademiaSession) {
        attemptedUrl = 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance';
        try {
          await sleepJitter(300, 600);
          const attRes = await axios.get(attemptedUrl, {
            headers: {
              Cookie: rawSession,
              'User-Agent': getRandomUserAgent(),
              'X-Requested-With': 'XMLHttpRequest',
              Referer: 'https://academia.srmist.edu.in/',
              Accept: '*/*',
            },
            timeout: 9000,
          });
          responseHtml = attRes.data || '';
          responseStatus = attRes.status;

          // Also fetch Timetable for profile and section
          try {
            const ttUrl = 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Time_Table_2023_24';
            const ttRes = await axios.get(ttUrl, {
              headers: {
                Cookie: rawSession,
                'User-Agent': getRandomUserAgent(),
                'X-Requested-With': 'XMLHttpRequest',
                Referer: 'https://academia.srmist.edu.in/',
                Accept: '*/*',
              },
              timeout: 7000,
            });
            if (ttRes.data) {
              responseHtml += '\n' + ttRes.data;
            }
          } catch {}
        } catch (academiaErr: any) {
          responseStatus = academiaErr.response?.status || 500;
          responseHtml = academiaErr.response?.data || academiaErr.message || '';
        }
      }

      // If not academia or if academia returned empty, attempt Student Portal (sp.srmist.edu.in)
      if (!responseHtml || (!responseHtml.includes('E6E6FA') && !responseHtml.includes('FAFAD2'))) {
        try {
          attemptedUrl = 'https://sp.srmist.edu.in/srmiststudentportal/students/report/studentAttendanceDetails.jsp';
          const formattedCookie = rawSession.includes('JSESSIONID')
            ? rawSession
            : `JSESSIONID=${rawSession}`;

          await sleepJitter(400, 800);
          const chosenUserAgent = getRandomUserAgent();

          const spRes = await axios.post(
            attemptedUrl,
            {},
            {
              headers: {
                Cookie: formattedCookie,
                'User-Agent': chosenUserAgent,
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cache-Control': 'no-cache',
              },
              timeout: 7000,
            }
          );
          if (spRes.data) {
            responseHtml = spRes.data;
            responseStatus = spRes.status;
          }
        } catch (spErr: any) {
          responseStatus = spErr.response?.status || 500;
          responseHtml = spErr.response?.data || spErr.message || '';
          if (responseStatus === 403 || responseStatus === 429 || responseStatus === 503) {
            tripCircuitBreaker(responseStatus, `SRM Firewall Blocked Access (HTTP ${responseStatus})`);
          }
        }
      }

      // Parse courses and student
      const courses = parseAttendanceAndMarksHtml(responseHtml);
      const liveStudent = parseStudentProfileFromHtml(responseHtml, studentNetId || clientIdentifier);

      // STRICT REQUIREMENT 2: NEVER SILENTLY RETURN EMPTY ARRAYS [] WITH 200 OK!
      if (courses.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Scraper returned 0 courses',
            attemptedUrl,
            httpStatus: responseStatus,
            htmlPreview: (typeof responseHtml === 'string' ? responseHtml : JSON.stringify(responseHtml)).slice(0, 500),
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
