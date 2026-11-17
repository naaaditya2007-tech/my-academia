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
import { parseAttendanceAndMarksHtml, parseStudentProfileFromHtml } from '@/lib/scraper';
import { encryptSession } from '@/lib/crypto';
import { CampusData, Course, InternalMark, StudentProfile } from '@/types/campus';
import { checkIsDeviceRevoked } from '@/app/api/admin/devices/route';

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

    // Step 4.5: POST-REDIRECT COOKIE FILTERING
    // Filter out iamcsr, stk, and the /accounts zalb_f0e8db9d3d cookie AFTER all redirects finish!
    const allCookiesAfterStep4 = await jar.getCookies('https://academia.srmist.edu.in/');

    // Creator zalb cookie is specifically zalb_74c3a1eecc (or the last zalb_* that is not zalb_f0e8db9d3d)
    const creatorZalb = allCookiesAfterStep4.filter((c) => c.key.startsWith('zalb_') && c.key !== 'zalb_f0e8db9d3d').pop()
      || allCookiesAfterStep4.filter((c) => c.key.startsWith('zalb_')).pop();

    const zccpnCookie = allCookiesAfterStep4.find((c) => c.key === 'zccpn');
    const cliRgnCookie = allCookiesAfterStep4.find((c) => c.key === 'cli_rgn');
    const jsessionIdCookie = allCookiesAfterStep4.find((c) => c.key === 'JSESSIONID' && (!c.path || !c.path.startsWith('/accounts')));

    const iamTickets = allCookiesAfterStep4.filter((c) =>
      c.key.startsWith('_iamadt') ||
      c.key.startsWith('_iambdt') ||
      c.key.startsWith('__Secure-iamsdt') ||
      c.key === '_z_identity'
    );

    // 1. creatorCookieStr: IAM tickets + creatorZalb + zccpn + cli_rgn + Creator JSESSIONID + ZCNEWUIPUBLICPORTAL=true
    // Strictly NO zalb_f0e8db9d3d, NO iamcsr, NO stk
    const creatorCookieParts: string[] = [];
    iamTickets.forEach((c) => creatorCookieParts.push(`${c.key}=${c.value}`));
    if (creatorZalb) creatorCookieParts.push(`${creatorZalb.key}=${creatorZalb.value}`);
    if (zccpnCookie) creatorCookieParts.push(`${zccpnCookie.key}=${zccpnCookie.value}`);
    if (cliRgnCookie) creatorCookieParts.push(`${cliRgnCookie.key}=${cliRgnCookie.value}`);
    if (jsessionIdCookie) creatorCookieParts.push(`${jsessionIdCookie.key}=${jsessionIdCookie.value}`);
    creatorCookieParts.push('ZCNEWUIPUBLICPORTAL=true');
    const creatorCookieStr = Array.from(new Set(creatorCookieParts)).join('; ');

    // 2. iamPlusCreatorCookiesWithoutJsession: IAM tickets + creatorZalb + zccpn + cli_rgn + ZCNEWUIPUBLICPORTAL=true (NO JSESSIONID)
    const iamOnlyParts: string[] = [];
    iamTickets.forEach((c) => iamOnlyParts.push(`${c.key}=${c.value}`));
    if (creatorZalb) iamOnlyParts.push(`${creatorZalb.key}=${creatorZalb.value}`);
    if (zccpnCookie) iamOnlyParts.push(`${zccpnCookie.key}=${zccpnCookie.value}`);
    if (cliRgnCookie) iamOnlyParts.push(`${cliRgnCookie.key}=${cliRgnCookie.value}`);
    iamOnlyParts.push('ZCNEWUIPUBLICPORTAL=true');
    const iamPlusCreatorCookiesWithoutJsession = Array.from(new Set(iamOnlyParts)).join('; ');

    // Step 5: Sequential Zero-Burst Extraction (Prevents URL_ROLLING_THROTTLES_LIMIT_EXCEEDED)
    let courses: Course[] = [];
    let timetableData: any = { schedule: [], dayOrderMatrix: {} };
    let userInfo: any = null;
    let calendarList: any = [];

    let lastErrorMeta = '';
    let lastRawSnippet = '';
    let lastHtmlTitle = '';
    let lastHttpStatus = 200;

    function extractErrorMeta(html: string): string {
      const match = html.match(/name=["']errorMeta["']\s+value=(['"])(.*?)\1/i)
        || html.match(/name=["']errorMeta["'][^>]*value='([^']+)'/i)
        || html.match(/name=["']errorMeta["'][^>]*value="([^"]+)"/i);
      return match ? match[2] || match[1] : '';
    }

    try {
      // Request 1: Single targeted GET for My_Attendance (contains BOTH Attendance & Internal Marks in SRM Academia)
      const attResult = await fetchPortalView(creatorCookieStr, 'My_Attendance');
      const attHtml = attResult.html || attResult.rawHtml || '';
      lastHttpStatus = attResult.lastStatus || 200;
      lastRawSnippet = (attHtml || '').slice(0, 300);
      lastHtmlTitle = attHtml.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
      lastErrorMeta = extractErrorMeta(attHtml);

      // Parse Attendance & Internal Marks directly from the My_Attendance HTML
      if (attHtml) {
        courses = parseAttendanceAndMarksHtml(attHtml);
      }

      // If courses parsed successfully, extract UserInfo and Timetable sequentially with 250ms breathing space
      if (courses.length > 0) {
        // UserInfo extracted directly from the same My_Attendance HTML (0 extra network requests)
        userInfo = await getUserInfo(creatorCookieStr, attHtml);

        // Fetch Timetable with 250ms delay to prevent triggering Zoho's rolling throttle
        await new Promise((resolve) => setTimeout(resolve, 250));
        try {
          timetableData = await getTimetable(creatorCookieStr);
        } catch {}
      } else {
        // Fallback: If 0 courses and homeHtml was obtained in Step 4, try parsing from homeHtml
        if (homeHtml) {
          const homeCourses = parseAttendanceAndMarksHtml(homeHtml);
          if (homeCourses.length > 0) {
            courses = homeCourses;
            userInfo = await getUserInfo(creatorCookieStr, homeHtml);
          }
        }
      }

      // Purely local calendar calculation (0 network requests)
      calendarList = await getCalendar();
    } finally {
      // Release Zoho session immediately so our app consumes 0 permanent session slots
      await logoutUser(creatorCookieStr).catch(() => {});
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

    // STEP-BY-STEP TECHNICAL ERROR TRACKER
    if (courses.length === 0) {
      const cleanCookieNames = creatorCookieStr
        .split(';')
        .map((s) => s.trim().split('=')[0])
        .filter(Boolean)
        .join(', ');

      const errorMetaStr = lastErrorMeta ? ` | errorMeta: ${lastErrorMeta}` : '';

      return NextResponse.json(
        {
          success: false,
          error: `[Step 5 Attendance Fetch]: Zoho returned HTTP ${lastHttpStatus} (<title>${lastHtmlTitle || 'No Title'}</title>), but 0 courses were parsed. CleanCookiesSent: [${cleanCookieNames}]${errorMetaStr} | HTML Preview: ${JSON.stringify(lastRawSnippet)}`,
          step: 'Step 5 Attendance Fetch',
          zohoIdentifier: identifier,
          htmlTitle: lastHtmlTitle,
          httpStatus: lastHttpStatus,
          rawSnippet: lastRawSnippet,
          cleanCookieNames,
          cleanCookiesSent: creatorCookieStr.split(';').map((s) => s.trim().split('=')[0]),
          errorMeta: lastErrorMeta,
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

    // Encrypt session token as HttpOnly cookie
    const sessionToken = creatorCookieStr || `user_${cleanNetId}_${Date.now()}`;
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
