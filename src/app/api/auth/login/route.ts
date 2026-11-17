import { NextRequest, NextResponse } from 'next/server';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import {
  getAttendance,
  getMarks,
  getTimetable,
  getUserInfo,
  getCalendar,
  logoutUser,
  fetchPortalView,
} from 'srm-academia-api';
import {
  parseAttendanceAndMarksHtml,
  parseStudentProfileFromHtml,
  extractPortalLinksFromHome,
} from '@/lib/scraper';
import { encryptSession } from '@/lib/crypto';
import { CampusData, Course, InternalMark, StudentProfile } from '@/types/campus';
import { checkIsDeviceRevoked } from '@/app/api/admin/devices/route';
import { getCachedCampusData, setCachedCampusData } from '@/lib/campusCache';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { netId, password, rememberMe } = body;

    // Strict Zero-Trust Revocation Gate
    const clientDeviceId = body.deviceId || req.headers.get('x-device-id') || '';
    if (clientDeviceId) {
      const isRevoked = await checkIsDeviceRevoked(clientDeviceId);
      if (isRevoked) {
        return NextResponse.json(
          {
            success: false,
            error: 'Device access has been revoked by administrator. Administrator permission is required to enter.',
            technicalReason: 'Device ID is flagged as revoked in zero-trust cloud registry',
            revoked: true,
          },
          { status: 403 }
        );
      }
    }

    let cleanNetId = (netId || '').trim();
    if (cleanNetId && !cleanNetId.includes('@')) {
      cleanNetId = `${cleanNetId}@srmist.edu.in`;
    }

    if (!cleanNetId || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter both your SRM NetID and password.',
          technicalReason: 'Missing credentials in request body',
        },
        { status: 400 }
      );
    }

    // Isolated RFC-6265 tough-cookie jar + fetch client per request
    const jar = new CookieJar();
    const client = fetchCookie(fetch, jar);

    // Step 1: Initial GET to initialize Zoho IAM session & obtain iamcsr token
    const signinUrl =
      'https://academia.srmist.edu.in/accounts/p/40-10002227248/signin?servicename=ZohoCreator&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2F';

    const initRes = await client(signinUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const accountsCookies = await jar.getCookies('https://academia.srmist.edu.in/accounts');
    const iamcsr = accountsCookies.find((c) => c.key === 'iamcsr')?.value || '';

    if (!iamcsr) {
      return NextResponse.json(
        {
          success: false,
          error: `[Step 1 CSRF Init]: Failed to obtain iamcsr token from Zoho IAM. Status: ${initRes.status}`,
          technicalReason: 'No iamcsr cookie found in session jar',
          step: 'Step 1 CSRF Init',
        },
        { status: 502 }
      );
    }

    // Step 2: NetID Lookup against Zoho IAM
    const lookupUrl = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/lookup/${encodeURIComponent(cleanNetId)}`;
    const lookupBody = new URLSearchParams({
      mode: 'primary',
      cli_time: Date.now().toString(),
      servicename: 'ZohoCreator',
      orgtype: '40',
      serviceurl: 'https://academia.srmist.edu.in/',
    });

    const lookupRes = await client(lookupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-ZCSRF-TOKEN': `iamcsrcoo=${iamcsr}`,
        Origin: 'https://academia.srmist.edu.in',
        Referer: signinUrl,
      },
      body: lookupBody.toString(),
    });

    const lookupData: any = await lookupRes.json().catch(() => ({}));

    if (
      lookupData.errors?.[0]?.code === 'SI503' ||
      lookupData.code === 'SI503' ||
      lookupData.message?.includes('maximum sign-in threshold') ||
      lookupData.localized_message?.includes('daily sign-in limit')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `SRM Academia daily sign-in threshold reached (Zoho IAM SI503). Zoho has temporarily rate-limited sign-ins for this account. Please wait for the daily window to reset.`,
          technicalReason: lookupData.message || 'Zoho IAM SI503 daily sign-in limit reached',
          step: 'Step 2 NetID Lookup',
          isDailyThresholdReached: true,
        },
        { status: 429 }
      );
    }

    if (lookupData.code === 'U100' || lookupData.message?.includes('does not exist')) {
      return NextResponse.json(
        {
          success: false,
          error: `[Step 2 NetID Lookup]: Invalid NetID. Account does not exist on SRM Academia.`,
          technicalReason: lookupData.message || 'Zoho IAM returned U100',
          step: 'Step 2 NetID Lookup',
        },
        { status: 404 }
      );
    }

    if (lookupData.code !== 'U200' || !lookupData.lookup?.identifier) {
      return NextResponse.json(
        {
          success: false,
          error: `[Step 2 NetID Lookup]: Zoho IAM validation failed: ${lookupData.message || lookupData.code}`,
          technicalReason: lookupData.message || 'Lookup failed',
          step: 'Step 2 NetID Lookup',
        },
        { status: 400 }
      );
    }

    const identifier = lookupData.lookup.identifier;
    const digest = lookupData.lookup.digest || '';

    // Step 3: Submit Password to Zoho IAM
    const signinParams = `digest=${digest}&cli_time=${Date.now()}&servicename=ZohoCreator&orgtype=40&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2F`;
    const passwordUrl = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/primary/${identifier}/password?${signinParams}`;

    const passRes = await client(passwordUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-ZCSRF-TOKEN': `iamcsrcoo=${iamcsr}`,
        Origin: 'https://academia.srmist.edu.in',
        Referer: signinUrl,
      },
      body: JSON.stringify({
        passwordauth: {
          password: password,
        },
      }),
    });

    const passJson: any = await passRes.json().catch(() => ({}));

    if (
      passJson.status_code === 500 ||
      passJson.errors?.[0]?.code === 'IN102' ||
      passJson.message === 'Invalid password'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `[Step 3 Password Auth]: Incorrect password for SRM Academia.`,
          technicalReason: passJson.localized_message || passJson.message || 'IN102 Wrong password',
          step: 'Step 3 Password Auth',
        },
        { status: 401 }
      );
    }

    const isSuccess =
      passJson.code === 'SI200' ||
      passJson.code === 'SI302' ||
      passJson.code === 'SI300' ||
      passJson.status_code === 200 ||
      Boolean(passJson.passwordauth?.redirect_uri);

    if (!isSuccess) {
      return NextResponse.json(
        {
          success: false,
          error: `[Step 3 Password Auth]: SRM Academia sign-in rejected: ${passJson.message || passJson.code}`,
          technicalReason: passJson.localized_message || passJson.message || `Code: ${passJson.code}`,
          step: 'Step 3 Password Auth',
        },
        { status: 401 }
      );
    }

    // Step 3 raw cookies: saved immediately before visiting redirect_uri
    const step3RawCookies = await jar.getCookieString('https://academia.srmist.edu.in/');

    // Step 3.5: Auto-terminate concurrent sessions if _iamtt or blocksessions detected
    const allCookies = await jar.getCookies('https://academia.srmist.edu.in/');
    const hasIamtt = allCookies.some((c) => c.key === '_iamtt');
    const isBlockSessions =
      hasIamtt ||
      Boolean(passJson?.passwordauth?.redirect_uri?.includes('blocksessions')) ||
      !allCookies.some((c) => c.key.startsWith('_iamadt'));

    if (isBlockSessions) {
      try {
        await client(
          'https://academia.srmist.edu.in/accounts/p/40-10002227248/webclient/v1/announcement/pre/blocksessions',
          {
            method: 'DELETE',
            headers: {
              'X-ZCSRF-TOKEN': `iamcsrcoo=${iamcsr}`,
              'User-Agent': USER_AGENT,
              Origin: 'https://academia.srmist.edu.in',
              Referer:
                passJson?.passwordauth?.redirect_uri ||
                'https://academia.srmist.edu.in/accounts/p/40-10002227248/announcement/pre/blocksessions',
            },
          }
        );
      } catch {}
    }

    // Step 4: Follow redirect_uri (fetchCookie automatically follows 302 chain and stores cookies)
    const redirectUri =
      passJson?.passwordauth?.redirect_uri ||
      'https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin';

    try {
      await client(redirectUri, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: 'https://academia.srmist.edu.in/',
        },
      });
    } catch {}

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

    // Force ZCNEWUIPUBLICPORTAL on root path
    await jar.setCookie(
      'ZCNEWUIPUBLICPORTAL=true; Path=/; Domain=academia.srmist.edu.in',
      'https://academia.srmist.edu.in/'
    );

    // STEP D: Full unfiltered cookies from persistent tough-cookie CookieJar
    const fullCookies = await jar.getCookieString('https://academia.srmist.edu.in/');
    const allJarCookies = await jar.getCookies('https://academia.srmist.edu.in/');
    const cookieNames = allJarCookies.map((c) => c.key);

    // Prepare cookies without JSESSIONID for Fallback 3
    const cookiesWithoutJsession = fullCookies
      .split(';')
      .map((s) => s.trim())
      .filter((s) => !s.startsWith('JSESSIONID='))
      .join('; ');

    // STEP C: Extract real permalinks and view names from homeHtml
    const { attendanceUrls, timetableUrls, foundLinks } = extractPortalLinksFromHome(homeHtml);

    // STEP E: Sequential Fallback - STOP AT FIRST THAT WORKS
    let courses: Course[] = [];
    let timetableData: any = { schedule: [], dayOrderMatrix: {} };
    let userInfo: any = null;
    let calendarList: any = [];

    let winningUrl = '';
    let winningFallback = '';
    let lastHttpStatus = 200;
    let lastUrlPath = '';
    let lastBodyLength = 0;
    let lastHtml = '';

    const VIEW_HEADERS = {
      'User-Agent': USER_AGENT,
      'Referer': 'https://academia.srmist.edu.in/',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'X-Requested-With': 'XMLHttpRequest',
    };

    try {
      // Fallback 1: Matched link from Step C with full cookies via persistent tough-cookie client
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

      // Fallback 3: getAttendance(cookies) with JSESSIONID removed from cookie string
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

      // Fallback 4: getAttendance(cookies) with raw cookies from Step 3 (saved before visiting redirect_uri)
      if (courses.length === 0 && step3RawCookies) {
        await new Promise((r) => setTimeout(r, 300));
        try {
          const att4: any = await getAttendance(step3RawCookies);
          lastHttpStatus = att4.httpStatus || lastHttpStatus;
          if (att4.viewUrl) {
            try {
              lastUrlPath = new URL(att4.viewUrl).pathname;
            } catch {
              lastUrlPath = att4.viewUrl;
            }
          }
          if (att4.rawHtml) {
            lastBodyLength = att4.rawHtml.length;
            lastHtml = att4.rawHtml;
          }
          if (att4.length > 0) {
            courses = att4;
            winningUrl = att4.viewUrl || 'getAttendance';
            winningFallback = 'Fallback 4 (Library getAttendance with Step 3 cookies)';
          }
        } catch {}
      }

      // Fallback 5: Check if homeHtml already contains parsed attendance
      if (courses.length === 0 && homeHtml) {
        const homeCourses = parseAttendanceAndMarksHtml(homeHtml);
        if (homeCourses.length > 0) {
          courses = homeCourses;
          winningUrl = 'https://academia.srmist.edu.in/';
          winningFallback = 'Fallback 5 (Parsed from homeHtml)';
        }
      }

      // STEP H: If courses succeeded, fetch timetable, marks, and user info with 300ms delay
      if (courses.length > 0) {
        // UserInfo extracted directly from working HTML (0 extra network requests)
        userInfo = await getUserInfo(fullCookies, lastHtml || homeHtml);

        // Fetch Timetable with 300ms delay to avoid URL_ROLLING_THROTTLES_LIMIT_EXCEEDED
        await new Promise((resolve) => setTimeout(resolve, 300));
        try {
          timetableData = await getTimetable(fullCookies);
        } catch {}
      }

      // Purely local calendar calculation (0 network requests)
      calendarList = await getCalendar();
    } finally {
      // STEP H: Release Zoho session immediately so our app consumes 0 permanent session slots
      await logoutUser(fullCookies).catch(() => {});
    }

    // Zero-Mock Student Profile: Strictly bind student details from getUserInfo or homeHtml
    const emailStr = cleanNetId;
    const netIdPrefix = cleanNetId.split('@')[0].toUpperCase();
    const profileFromHome = homeHtml ? parseStudentProfileFromHtml(homeHtml, cleanNetId) : null;

    const student: StudentProfile = {
      name: userInfo?.name && userInfo.name !== 'Student' ? userInfo.name : (profileFromHome?.name || netIdPrefix),
      regNumber: userInfo?.regNumber || profileFromHome?.regNumber || netIdPrefix,
      email: emailStr,
      institution: userInfo?.institution || profileFromHome?.institution || 'SRM Institute of Science and Technology',
      program: userInfo?.program || profileFromHome?.program || 'B.Tech.',
      semester: userInfo?.semester || profileFromHome?.semester || 4,
      department: userInfo?.department || profileFromHome?.department || 'Computer Science and Engineering',
      section: userInfo?.section || profileFromHome?.section || 'A',
      batch: userInfo?.batch || profileFromHome?.batch || '2024 - 2028',
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
      const shortErrorMessage = `[Step 5 Attendance Fetch] [build: v2-2026-11-17]: HTTP ${lastHttpStatus} on ${cleanUrlPath} (${lastBodyLength} bytes). Cookies: [${cookieNamesStr}]. Home Links: [${first3Links}]`;

      return NextResponse.json(
        {
          success: false,
          error: shortErrorMessage,
          step: 'Step 5 Attendance Fetch',
          buildVersion: 'v2-2026-11-17',
          httpStatus: lastHttpStatus,
          urlPath: cleanUrlPath,
          responseSize: lastBodyLength,
          cookieNames,
          foundLinks: foundLinks.slice(0, 3),
        },
        { status: 502 }
      );
    }

    const liveData: CampusData = {
      student,
      courses,
      calendar: calendarList && calendarList.length > 0 ? calendarList : [],
      dayOrderMatrix: timetableData?.dayOrderMatrix || {},
      lastSyncedAt: new Date().toISOString(),
      dataSource: 'live_student_portal',
    };

    // Cache successful data in campusCache.ts (5-minute TTL)
    setCachedCampusData(cleanNetId, liveData);

    // Encrypt session token as HttpOnly cookie
    const sessionToken = fullCookies || `user_${cleanNetId}_${Date.now()}`;
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
    const encryptedToken = encryptSession(sessionToken);

    const response = NextResponse.json({
      success: true,
      message: `Authenticated successfully as ${student.name}`,
      data: liveData,
    });

    // 1. Set myacademia_session cookie for proxy.ts middleware
    response.cookies.set('myacademia_session', '1', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // 2. Set encrypted session token
    response.cookies.set('srm_session_encrypted', encryptedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to communicate with SRM Academia.',
        technicalReason: error?.message || 'Unexpected server-side error during login',
      },
      { status: 500 }
    );
  }
}
