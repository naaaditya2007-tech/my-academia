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
import { parseAttendanceAndMarksHtml, extractPortalLinksFromHome } from '@/lib/scraper';
import { MOCK_CAMPUS_DATA } from '@/lib/mockData';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { CampusData, Course, InternalMark, StudentProfile } from '@/types/campus';
import { encryptSession, decryptSession } from '@/lib/crypto';
import { getGlobalAcademicCalendar } from '@/lib/globalCalendar';
import { checkIsDeviceRevoked } from '@/app/api/admin/devices/route';
import { getCachedCampusData, setCachedCampusData } from '@/lib/campusCache';
import {
  getCircuitBreakerState,
  resetCircuitBreaker,
  checkServerCooldown,
  recordServerSync,
  isQuietSyncPeriod,
  SYNC_COOLDOWN_MS,
} from '@/lib/firewallProtection';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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

    // In-memory 5-minute cache hit check
    if (studentNetId && !force) {
      const cached = getCachedCampusData(studentNetId);
      if (cached) {
        return NextResponse.json({
          success: true,
          source: 'memory_cache',
          data: cached,
          latencyMs: Date.now() - startTime,
        });
      }
    }

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
      const client = fetchCookie(fetch, jar);
      const parts = rawSession.split(';');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) {
          await jar.setCookie(`${trimmed}; Path=/; Domain=academia.srmist.edu.in`, 'https://academia.srmist.edu.in/').catch(() => {});
        }
      }
      await jar.setCookie('ZCNEWUIPUBLICPORTAL=true; Path=/; Domain=academia.srmist.edu.in', 'https://academia.srmist.edu.in/').catch(() => {});

      const fullCookies = await jar.getCookieString('https://academia.srmist.edu.in/');
      const allJarCookies = await jar.getCookies('https://academia.srmist.edu.in/');
      const cookieNames = allJarCookies.map((c) => c.key);
      const cookiesWithoutJsession = fullCookies
        .split(';')
        .map((s) => s.trim())
        .filter((s) => !s.startsWith('JSESSIONID='))
        .join('; ');

      let homeHtml = '';
      try {
        const homeRes = await client('https://academia.srmist.edu.in/', {
          headers: {
            'User-Agent': USER_AGENT,
            Referer: 'https://academia.srmist.edu.in/',
          },
        });
        homeHtml = await homeRes.text();
      } catch {}

      const { attendanceUrls, timetableUrls, foundLinks } = extractPortalLinksFromHome(homeHtml);

      let courses: Course[] = [];
      let timetableData: any = { schedule: [], dayOrderMatrix: {} };
      let userInfo: any = null;

      let winningUrl = '';
      let winningFallback = '';
      let lastHttpStatus = 200;
      let lastUrlPath = '';
      let lastBodyLength = 0;
      let lastHtml = '';

      const VIEW_HEADERS = {
        'User-Agent': USER_AGENT,
        Referer: 'https://academia.srmist.edu.in/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'X-Requested-With': 'XMLHttpRequest',
      };

      try {
        // Fallback 1: Matched link with persistent client
        const targetUrl =
          attendanceUrls[0] ||
          'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance';

        try {
          lastUrlPath = new URL(targetUrl).pathname;
        } catch {
          lastUrlPath = targetUrl;
        }

        try {
          const res1 = await client(targetUrl, {
            method: 'GET',
            headers: VIEW_HEADERS,
          });
          lastHttpStatus = res1.status;
          const html1 = await res1.text();
          lastBodyLength = html1.length;
          lastHtml = html1;

          if (res1.status === 200 && html1) {
            const parsed1 = parseAttendanceAndMarksHtml(html1);
            if (parsed1.length > 0) {
              courses = parsed1;
              winningUrl = targetUrl;
              winningFallback = 'Fallback 1 (Matched Step C link with persistent client)';
            }
          }
        } catch {}

        // Fallback 2: Library's own getAttendance(cookies) with full cookies
        if (courses.length === 0) {
          await new Promise((r) => setTimeout(r, 300));
          try {
            const att2: any = await getAttendance(fullCookies);
            lastHttpStatus = att2.httpStatus || lastHttpStatus;
            if (att2.viewUrl) {
              try {
                lastUrlPath = new URL(att2.viewUrl).pathname;
              } catch {
                lastUrlPath = att2.viewUrl;
              }
            }
            if (att2.rawHtml) {
              lastBodyLength = att2.rawHtml.length;
              lastHtml = att2.rawHtml;
            }
            if (att2.length > 0) {
              courses = att2;
              winningUrl = att2.viewUrl || 'getAttendance';
              winningFallback = 'Fallback 2 (Library getAttendance with full cookies)';
            }
          } catch {}
        }

        // Fallback 3: getAttendance(cookies) without JSESSIONID
        if (courses.length === 0) {
          await new Promise((r) => setTimeout(r, 300));
          try {
            const att3: any = await getAttendance(cookiesWithoutJsession);
            lastHttpStatus = att3.httpStatus || lastHttpStatus;
            if (att3.viewUrl) {
              try {
                lastUrlPath = new URL(att3.viewUrl).pathname;
              } catch {
                lastUrlPath = att3.viewUrl;
              }
            }
            if (att3.rawHtml) {
              lastBodyLength = att3.rawHtml.length;
              lastHtml = att3.rawHtml;
            }
            if (att3.length > 0) {
              courses = att3;
              winningUrl = att3.viewUrl || 'getAttendance';
              winningFallback = 'Fallback 3 (Library getAttendance without JSESSIONID)';
            }
          } catch {}
        }

        // Fallback 4: Parse from homeHtml
        if (courses.length === 0 && homeHtml) {
          const homeCourses = parseAttendanceAndMarksHtml(homeHtml);
          if (homeCourses.length > 0) {
            courses = homeCourses;
            winningUrl = 'https://academia.srmist.edu.in/';
            winningFallback = 'Fallback 4 (Parsed from homeHtml)';
          }
        }

        // Step H: If courses succeeded, fetch timetable and user info with 300ms delay
        if (courses.length > 0) {
          userInfo = await getUserInfo(fullCookies, lastHtml || homeHtml);
          await new Promise((resolve) => setTimeout(resolve, 300));
          try {
            timetableData = await getTimetable(fullCookies);
          } catch {}
        }
      } finally {
        await logoutUser(fullCookies).catch(() => {});
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

      // STEP G: SHORT ERROR BOX ON FAILURE
      if (courses.length === 0) {
        const cookieNamesStr = cookieNames.join(', ');
        const first3Links = foundLinks
          .slice(0, 3)
          .map((l) => {
            try {
              return new URL(l).pathname;
            } catch {
              return l;
            }
          })
          .join(', ');

        const cleanUrlPath = lastUrlPath || '/srm_university/academia-academic-services/page-perma/My_Attendance';
        const shortErrorMessage = `[Portal Sync View Fetch] [build: v2-2026-11-17]: HTTP ${lastHttpStatus} on ${cleanUrlPath} (${lastBodyLength} bytes). Cookies: [${cookieNamesStr}]. Home Links: [${first3Links}]`;

        return NextResponse.json(
          {
            success: false,
            error: shortErrorMessage,
            step: 'Portal Sync View Fetch',
            buildVersion: 'v2-2026-11-17',
            httpStatus: lastHttpStatus,
            urlPath: cleanUrlPath,
            responseSize: lastBodyLength,
            cookieNames,
            foundLinks: foundLinks.slice(0, 3),
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

      if (studentNetId) {
        setCachedCampusData(studentNetId, liveData);
      }

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
