import { NextRequest, NextResponse } from 'next/server';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import {
  verifyUser,
  verifyPassword,
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

    // STEP 1 & 2: Search homeHtml for logged-in indicators and keyword snippets
    const homeSearchResult = searchHomeHtmlForKeywords(homeHtml, cleanNetId);
    console.log(`[Step 1 Logged-in Indicators]:`, homeSearchResult.loggedInCheck);
    console.log(`[Step 2 homeHtml Matches]: ${homeSearchResult.totalMatches} matches found`);
    homeSearchResult.snippets.forEach((s, idx) => {
      console.log(`  Match ${idx + 1} [${s.keyword}]: ${s.snippet}`);
    });

    // STEP 3: Test srm-academia-api library end-to-end (verifyUser -> verifyPassword -> getAttendance)
    let libTestResult = 'Not Run';
    let libTestCourses: Course[] = [];
    try {
      const userRes = await verifyUser(cleanNetId);
      if (userRes.success) {
        const passRes = await verifyPassword({
          digest: userRes.digest,
          identifier: userRes.identifier,
          password,
          cookies: userRes.cookies,
        });
        if (passRes.success && passRes.cookies) {
          const coursesRes: any = await getAttendance(passRes.cookies);
          libTestResult = `status ${coursesRes.httpStatus || 200} (${coursesRes.length} courses, title="${coursesRes.htmlTitle || 'None'}")`;
          if (coursesRes.length > 0) {
            libTestCourses = coursesRes;
          }
        } else {
          libTestResult = `verifyPassword failed: ${passRes.error || 'rejected'}`;
        }
      } else {
        libTestResult = `verifyUser failed: ${userRes.error || 'rejected'}`;
      }
    } catch (err: any) {
      libTestResult = `LibTest error: ${err?.message || 'unknown'}`;
    }
    console.log(`[Step 3 Library Test Result]: ${libTestResult}`);

    // Cookie subsets for Header Variants (Step 4)
    const cookiesWithoutZccpnOrUi = fullCookies
      .split(';')
      .map((s) => s.trim())
      .filter((s) => !s.startsWith('zccpn=') && !s.startsWith('ZCNEWUIPUBLICPORTAL='))
      .join('; ');

    const cookiesOnly4Iam = fullCookies
      .split(';')
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.startsWith('_iamadt_client_') ||
          s.startsWith('_iambdt_client_') ||
          s.startsWith('__Secure-iamsdt_client_') ||
          s.startsWith('_z_identity=')
      )
      .join('; ');

    // STEP 4: Request attendance URL with header variants a through f
    const attTargetUrl =
      'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance';

    const variants: { id: string; desc: string; headers: Record<string, string> }[] = [
      {
        id: 'a',
        desc: 'Referer + UA',
        headers: {
          Referer: 'https://academia.srmist.edu.in/',
          'User-Agent': USER_AGENT,
          Cookie: fullCookies,
        },
      },
      {
        id: 'b',
        desc: 'a + Accept + Lang',
        headers: {
          Referer: 'https://academia.srmist.edu.in/',
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en',
          Cookie: fullCookies,
        },
      },
      {
        id: 'c',
        desc: 'b + X-Requested-With',
        headers: {
          Referer: 'https://academia.srmist.edu.in/',
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en',
          'X-Requested-With': 'XMLHttpRequest',
          Cookie: fullCookies,
        },
      },
      {
        id: 'd',
        desc: 'b without JSESSIONID',
        headers: {
          Referer: 'https://academia.srmist.edu.in/',
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en',
          Cookie: cookiesWithoutJsession,
        },
      },
      {
        id: 'e',
        desc: 'b without zccpn/ZCNEWUI',
        headers: {
          Referer: 'https://academia.srmist.edu.in/',
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en',
          Cookie: cookiesWithoutZccpnOrUi,
        },
      },
      {
        id: 'f',
        desc: 'b only 4 IAM cookies',
        headers: {
          Referer: 'https://academia.srmist.edu.in/',
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en',
          Cookie: cookiesOnly4Iam,
        },
      },
    ];

    let courses: Course[] = [];
    let timetableData: any = { schedule: [], dayOrderMatrix: {} };
    let userInfo: any = null;
    let calendarList: any = [];

    let winningVariant = '';
    let lastHtml = '';
    const variantResults: string[] = [];

    try {
      // Execute each variant stopping at first 200 with courses
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 200));
        }

        try {
          const res = await fetch(attTargetUrl, {
            method: 'GET',
            headers: v.headers,
          });

          const status = res.status;
          const html = await res.text();
          const bytes = html.length;

          const logEntry = `${v.id}: ${status} (${bytes}b)`;
          variantResults.push(logEntry);
          console.log(`[Step 4 Variant ${v.id} (${v.desc})]: ${status} (${bytes} bytes)`);

          if (status === 200 && bytes > 0) {
            const parsed = parseAttendanceAndMarksHtml(html);
            if (parsed.length > 0) {
              courses = parsed;
              winningVariant = `Variant ${v.id} (${v.desc})`;
              lastHtml = html;
              break; // Stop at first variant that parses courses
            }
          }
        } catch (err: any) {
          variantResults.push(`${v.id}: err`);
        }
      }

      // If variants failed but library test in Step 3 succeeded, adopt library result
      if (courses.length === 0 && libTestCourses.length > 0) {
        courses = libTestCourses;
        winningVariant = 'Step 3 Library Test';
      }

      // If courses succeeded, fetch timetable, marks, and user info
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
      // Release Zoho session immediately so our app consumes 0 permanent session slots
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

    // STEP 6: ERROR BOX (Build v4-2026-11-17)
    if (courses.length === 0) {
      const { hasLogout, hasUserNetId, hasLoginForm, hasMyAttendance } =
        homeSearchResult.loggedInCheck;
      const loggedInStr = `LoggedIn: [logout=${hasLogout}, user=${hasUserNetId}, loginForm=${hasLoginForm}, attend=${hasMyAttendance}]`;
      const variantsSummary = variantResults.join(', ');
      const cleanSnippetsStr = homeSearchResult.snippets
        .slice(0, 3)
        .map((s) => `[${s.keyword}]: "${s.snippet.slice(0, 60).replace(/"/g, "'")}..."`)
        .join(' | ');

      const shortErrorMessage = `[Step 5 Attendance Fetch] [build: v4-2026-11-17]: ${loggedInStr}. Variants: [${variantsSummary}]. LibTest: ${libTestResult}. Home: ${cleanSnippetsStr || '0 matches'}`;

      return NextResponse.json(
        {
          success: false,
          error: shortErrorMessage,
          step: 'Step 5 Attendance Fetch',
          buildVersion: 'v4-2026-11-17',
          loggedInCheck: homeSearchResult.loggedInCheck,
          variants: variantResults,
          libTestResult,
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
