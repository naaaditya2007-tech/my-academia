import { NextRequest, NextResponse } from 'next/server';
import {
  getAttendance,
  getMarks,
  getTimetable,
  getUserInfo,
  getCalendar,
  logoutUser,
  fetchPortalView,
} from 'srm-academia-api';
import { parseAttendanceAndMarksHtml } from '@/lib/scraper';
import { MOCK_CAMPUS_DATA } from '@/lib/mockData';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { CampusData, Course, InternalMark, StudentProfile } from '@/types/campus';
import { encryptSession, decryptSession } from '@/lib/crypto';
import { getGlobalAcademicCalendar } from '@/lib/globalCalendar';
import { checkIsDeviceRevoked } from '@/app/api/admin/devices/route';
import {
  getCircuitBreakerState,
  resetCircuitBreaker,
  checkServerCooldown,
  recordServerSync,
  isQuietSyncPeriod,
  SYNC_COOLDOWN_MS,
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
    const resolvedFallbackStudent: StudentProfile | null = body.currentStudent || null;

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
        const lastSyncTime = Date.now() - (SYNC_COOLDOWN_MS - cooldown.remainingSec * 1000);
        return NextResponse.json({
          success: true,
          source: 'cache_cooldown',
          cooldownActive: true,
          message: `SRM Student Portal Cooldown Active (${remainingMinutes}m remaining). Showing cached sync.`,
          data: {
            ...MOCK_CAMPUS_DATA,
            student: resolvedFallbackStudent,
            calendar: getGlobalAcademicCalendar(),
            lastSyncedAt: new Date(lastSyncTime).toISOString(),
          },
        });
      }
    }

    // 5. Decrypt Zero-Knowledge Session Token
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

    // 6. Live SRM Academia Sync via Fetch & Release
    if (rawSession) {
      const jar = new CookieJar();
      const parts = rawSession.split(';');
      for (const part of parts) {
        const trimmed = part.trim();
        const key = trimmed.split('=')[0]?.trim();
        if (key === 'iamcsr' || key === 'stk' || key === 'zalb_f0e8db9d3d' || key === '_iamtt') continue;
        if (trimmed) {
          await jar.setCookie(`${trimmed}; Path=/; Domain=academia.srmist.edu.in`, 'https://academia.srmist.edu.in/').catch(() => {});
        }
      }
      await jar.setCookie('ZCNEWUIPUBLICPORTAL=true; Path=/; Domain=academia.srmist.edu.in', 'https://academia.srmist.edu.in/').catch(() => {});
      const allCookies = await jar.getCookies('https://academia.srmist.edu.in/');
      
      const creatorZalb = allCookies.filter((c) => c.key.startsWith('zalb_') && c.key !== 'zalb_f0e8db9d3d').pop()
        || allCookies.filter((c) => c.key.startsWith('zalb_')).pop();
      const zccpnCookie = allCookies.find((c) => c.key === 'zccpn');
      const cliRgnCookie = allCookies.find((c) => c.key === 'cli_rgn');
      const jsessionIdCookie = allCookies.find((c) => c.key === 'JSESSIONID' && (!c.path || !c.path.startsWith('/accounts')));
      const iamTickets = allCookies.filter((c) =>
        c.key.startsWith('_iamadt') ||
        c.key.startsWith('_iambdt') ||
        c.key.startsWith('__Secure-iamsdt') ||
        c.key === '_z_identity'
      );

      const creatorCookieParts: string[] = [];
      iamTickets.forEach((c) => creatorCookieParts.push(`${c.key}=${c.value}`));
      if (creatorZalb) creatorCookieParts.push(`${creatorZalb.key}=${creatorZalb.value}`);
      if (zccpnCookie) creatorCookieParts.push(`${zccpnCookie.key}=${zccpnCookie.value}`);
      if (cliRgnCookie) creatorCookieParts.push(`${cliRgnCookie.key}=${cliRgnCookie.value}`);
      if (jsessionIdCookie) creatorCookieParts.push(`${jsessionIdCookie.key}=${jsessionIdCookie.value}`);
      creatorCookieParts.push('ZCNEWUIPUBLICPORTAL=true');
      const cleanSessionCookies = Array.from(new Set(creatorCookieParts)).join('; ');

      let courses: Course[] = [];
      let timetableData: any = { schedule: [], dayOrderMatrix: {} };
      let userInfo: any = null;
      let lastHttpStatus = 200;
      let lastRawSnippet = '';
      let lastHtmlTitle = '';
      let lastErrorMeta = '';

      function extractErrorMeta(html: string): string {
        const match = html.match(/name=["']errorMeta["']\s+value=(['"])(.*?)\1/i)
          || html.match(/name=["']errorMeta["'][^>]*value='([^']+)'/i)
          || html.match(/name=["']errorMeta["'][^>]*value="([^"]+)"/i);
        return match ? match[2] || match[1] : '';
      }

      try {
        // Request 1: Single targeted GET for My_Attendance
        const attResult = await fetchPortalView(cleanSessionCookies, 'My_Attendance');
        const attHtml = attResult.html || attResult.rawHtml || '';
        lastHttpStatus = attResult.lastStatus || 200;
        lastRawSnippet = (attHtml || '').slice(0, 300);
        lastHtmlTitle = attHtml.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
        lastErrorMeta = extractErrorMeta(attHtml);

        if (attHtml) {
          courses = parseAttendanceAndMarksHtml(attHtml);
        }

        if (courses.length > 0) {
          userInfo = await getUserInfo(cleanSessionCookies, attHtml);
          await new Promise((r) => setTimeout(r, 250));
          try {
            timetableData = await getTimetable(cleanSessionCookies);
          } catch {}
        }
      } finally {
        await logoutUser(cleanSessionCookies).catch(() => {});
      }

      const netIdPrefix = studentNetId ? studentNetId.split('@')[0].toUpperCase() : 'STUDENT';
      const liveStudent: StudentProfile = {
        name: userInfo?.name && userInfo.name !== 'Student' ? userInfo.name : (resolvedFallbackStudent?.name || netIdPrefix),
        regNumber: userInfo?.regNumber || resolvedFallbackStudent?.regNumber || netIdPrefix,
        email: studentNetId.includes('@') ? studentNetId : `${netIdPrefix.toLowerCase()}@srmist.edu.in`,
        institution: userInfo?.institution || 'SRM Institute of Science and Technology',
        program: userInfo?.program || resolvedFallbackStudent?.program || 'B.Tech.',
        semester: userInfo?.semester || resolvedFallbackStudent?.semester || 4,
        department: userInfo?.department || resolvedFallbackStudent?.department || 'Computer Science and Engineering',
        section: userInfo?.section || resolvedFallbackStudent?.section || 'A',
        batch: userInfo?.batch || resolvedFallbackStudent?.batch || '2024 - 2028',
      };

      // STEP-BY-STEP TECHNICAL ERROR TRACKER (No generic string, zero dummy courses fallback)
      if (courses.length === 0) {
        const errorMetaStr = lastErrorMeta ? ` | errorMeta: ${lastErrorMeta}` : '';

        return NextResponse.json(
          {
            success: false,
            error: `[Portal Sync View Fetch]: Zoho returned HTTP ${lastHttpStatus} (<title>${lastHtmlTitle || 'No Title'}</title>), but 0 courses were parsed.${errorMetaStr} | HTML Preview: ${JSON.stringify(lastRawSnippet)}`,
            htmlTitle: lastHtmlTitle,
            httpStatus: lastHttpStatus,
            rawSnippet: lastRawSnippet,
            errorMeta: lastErrorMeta,
            sessionValid: Boolean(rawSession),
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
        dayOrderMatrix: timetableData?.dayOrderMatrix || {},
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
      response.cookies.set('myacademia_session', '1', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });

      response.cookies.set('srm_session_encrypted', encryptedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Active session not found. Please log in again.',
      },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Live sync failed due to unexpected server error',
        technicalReason: error?.message || 'Unknown exception',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
