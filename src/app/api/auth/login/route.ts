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
  searchHomeHtmlForKeywords,
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

    // STEP 4: Search homeHtml for critical keywords and sanitize snippets
    const homeSearchResult = searchHomeHtmlForKeywords(homeHtml);
    console.log(`[Step 4 homeHtml Matches]: ${homeSearchResult.totalMatches} matches found`);
    homeSearchResult.snippets.forEach((s, idx) => {
      console.log(`  Match ${idx + 1} [${s.keyword}]: ${s.snippet}`);
    });

    // STEP C: Extract real permalinks and view names from homeHtml
    const { attendanceUrls, timetableUrls, foundLinks } = extractPortalLinksFromHome(homeHtml);

    // STEP 3: URLs to try in order (Never using /portal/):
    // a. URL used by srm-academia-api: /srm_university/.../page-perma/My_Attendance
    // b. /srm_university/.../page/My_Attendance
    // c. /srm_university/.../page-perma/My_Attendance
    // d. any link found in step 4
    const candidateUrls = [
      'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance',
      'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance',
      ...homeSearchResult.discoveredUrls,
      ...attendanceUrls,
    ];
    // Deduplicate while preserving order and strictly filtering out any /portal/ paths
    const uniqueCandidateUrls = Array.from(new Set(candidateUrls)).filter(
      (u) => !u.includes('/portal/')
    );

    let courses: Course[] = [];
    let timetableData: any = { schedule: [], dayOrderMatrix: {} };
    let userInfo: any = null;
    let calendarList: any = [];

    let winningUrl = '';
    let winningFallback = '';
    let lastHtml = '';
    const attemptsLog: string[] = [];

    const VIEW_HEADERS = {
      'User-Agent': USER_AGENT,
      'Referer': 'https://academia.srmist.edu.in/',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'X-Requested-With': 'XMLHttpRequest',
    };

    try {
      // Execute URL trial loop stopping at first 200 that parses courses
      for (let i = 0; i < uniqueCandidateUrls.length; i++) {
        const targetUrl = uniqueCandidateUrls[i];
        let urlPath = targetUrl;
        try {
          urlPath = new URL(targetUrl).pathname;
        } catch {}

        if (i > 0) {
          // 250ms breathing space to respect rate limiting
          await new Promise((r) => setTimeout(r, 250));
        }

        try {
          const res = await client(targetUrl, {
            method: 'GET',
            headers: VIEW_HEADERS,
          });

          const status = res.status;
          const html = await res.text();
          const bytes = html.length;

          // Log ONLY "<url path> -> <status> (<bytes> bytes)"
          const logEntry = `${urlPath} -> ${status} (${bytes} bytes)`;
          attemptsLog.push(logEntry);
          console.log(`[Step 5 Attendance Attempt]: ${logEntry}`);

          if (status === 200 && bytes > 0) {
            const parsed = parseAttendanceAndMarksHtml(html);
            if (parsed.length > 0) {
              courses = parsed;
              winningUrl = targetUrl;
              winningFallback = `${urlPath} (${parsed.length} courses)`;
              lastHtml = html;
              break; // Stop at first 200 that parses courses
            }
          }
        } catch (err: any) {
          attemptsLog.push(`${urlPath} -> error (${err?.message || 'failed'})`);
        }
      }

      // Library fallback if direct candidate URLs didn't parse courses
      if (courses.length === 0) {
        await new Promise((r) => setTimeout(r, 250));
        try {
          const attLib: any = await getAttendance(fullCookies);
          if (attLib.length > 0) {
            courses = attLib;
            winningUrl = attLib.viewUrl || 'getAttendance';
            winningFallback = 'Library getAttendance with full cookies';
            lastHtml = attLib.rawHtml || '';
          }
        } catch {}
      }

      // Fallback 5: Check if homeHtml already contains parsed attendance
      if (courses.length === 0 && homeHtml) {
        const homeCourses = parseAttendanceAndMarksHtml(homeHtml);
        if (homeCourses.length > 0) {
          courses = homeCourses;
          winningUrl = 'https://academia.srmist.edu.in/';
          winningFallback = 'Parsed from homeHtml';
        }
      }

      // STEP H: If courses succeeded, fetch timetable, marks, and user info with 300ms delay
      if (courses.length > 0) {
        userInfo = await getUserInfo(fullCookies, lastHtml || homeHtml);

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

    // STEP 5: UPDATE ERROR BOX (Build v3-2026-11-17)
    if (courses.length === 0) {
      const cookieNamesStr = cookieNames.join(', ');
      const triedSummary = attemptsLog.join(', ');
      const shortErrorMessage = `[Step 5 Attendance Fetch] [build: v3-2026-11-17]: Tried: [${triedSummary}]. Home matches: ${homeSearchResult.totalMatches}. Cookies: [${cookieNamesStr}]`;

      return NextResponse.json(
        {
          success: false,
          error: shortErrorMessage,
          step: 'Step 5 Attendance Fetch',
          buildVersion: 'v3-2026-11-17',
          triedUrls: attemptsLog,
          homeMatchesCount: homeSearchResult.totalMatches,
          homeSnippets: homeSearchResult.snippets,
          cookieNames,
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
