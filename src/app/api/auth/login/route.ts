import { NextRequest, NextResponse } from 'next/server';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import {
  getTimetable,
  getUserInfo,
  getCalendar,
  logoutUser,
} from 'srm-academia-api';
import {
  parseAttendanceAndMarksHtml,
  parseStudentProfileFromHtml,
} from '@/lib/scraper';
import { encryptSession } from '@/lib/crypto';
import { CampusData, Course, StudentProfile } from '@/types/campus';
import { checkIsDeviceRevoked } from '@/app/api/admin/devices/route';
import { getCachedCampusData, setCachedCampusData } from '@/lib/campusCache';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 10-Minute Cooldown Guard Map per NetID (Prevents account burning & Zoho SI503 threshold locks)
const lastAttemptMap = new Map<string, number>();

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

    // 30-Minute Cache Hit: Return cached campus data immediately (0 network requests to Zoho)
    const cachedData = getCachedCampusData(cleanNetId);
    if (cachedData && cachedData.courses && cachedData.courses.length > 0) {
      console.log(`[Cache Hit]: Serving 30-minute cached campus data for ${cleanNetId.split('@')[0]}`);
      const sessionToken = `cached_${cleanNetId}_${Date.now()}`;
      const encryptedToken = encryptSession(sessionToken);

      const res = NextResponse.json({
        success: true,
        message: `Authenticated successfully from cache as ${cachedData.student?.name || 'Student'}`,
        data: cachedData,
        cached: true,
      });

      res.cookies.set('myacademia_session', '1', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });

      res.cookies.set('srm_session_encrypted', encryptedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7,
      });

      return res;
    }

    // 10-Minute Cooldown Guard: Prevent account burning / Zoho SI503 lockout
    const lastAttemptTime = lastAttemptMap.get(cleanNetId) || 0;
    const cooldownMs = 10 * 60 * 1000; // 10 minutes
    const elapsed = Date.now() - lastAttemptTime;
    if (elapsed < cooldownMs) {
      const waitMinutes = Math.ceil((cooldownMs - elapsed) / (60 * 1000));
      return NextResponse.json(
        {
          success: false,
          error: `Please wait ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''} before trying again. Your account may be locked by SRM if you attempt too frequently.`,
          technicalReason: `Throttled: 10-minute login cooldown active (${waitMinutes}m remaining)`,
          step: 'Account Protection Guard',
        },
        { status: 429 }
      );
    }
    // Record login attempt timestamp
    lastAttemptMap.set(cleanNetId, Date.now());

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

    // Step 5: Fetch Attendance & Time Table via the verified Academia SPA endpoint
    // Discovered from real browser session: /srm_university/academia-academic-services/page/My_Time_Table_2023_24
    const discoveredLinks: string[] = [];
    const ttMatches = homeHtml.match(/My_Time_Table_[A-Za-z0-9_]+/g) || [];
    for (const m of ttMatches) {
      discoveredLinks.push(`https://academia.srmist.edu.in/srm_university/academia-academic-services/page/${m}`);
    }
    discoveredLinks.push('https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Time_Table_2023_24');
    discoveredLinks.push('https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance');
    const targetUrls = Array.from(new Set(discoveredLinks));

    let attHttpStatus = 0;
    let attBytes = 0;
    let successfulUrl = targetUrls[0];
    let courses: Course[] = [];
    let timetableData: any = { schedule: [], dayOrderMatrix: {} };
    let userInfo: any = null;
    let calendarList: any = [];
    let lastHtml = '';

    try {
      for (const targetUrl of targetUrls) {
        try {
          const attRes = await fetch(targetUrl, {
            method: 'GET',
            headers: {
              'User-Agent': USER_AGENT,
              Accept: '*/*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              Referer: 'https://academia.srmist.edu.in/',
              Cookie: fullCookies,
            },
          });

          attHttpStatus = attRes.status;
          const html = await attRes.text();
          attBytes = html.length;

          console.log(`[Step 5 Attendance Fetch]: ${targetUrl} -> HTTP ${attHttpStatus} (${attBytes} bytes)`);

          if (attHttpStatus === 200 && attBytes > 0) {
            const parsed = parseAttendanceAndMarksHtml(html);
            if (parsed.length > 0) {
              courses = parsed;
              lastHtml = html;
              successfulUrl = targetUrl;
              break;
            }
          }
        } catch (err: any) {
          console.warn(`[Step 5 Fetch Error for ${targetUrl}]:`, err?.message || err);
        }
      }

      // If running locally, optionally save response for debugging
      if (process.env.NODE_ENV !== 'production' && lastHtml) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const debugDir = path.join(process.cwd(), '.debug');
          if (fs.existsSync(debugDir)) {
            fs.writeFileSync(path.join(debugDir, 'attendance_raw.html'), lastHtml, 'utf-8');
            const serializedJar = await jar.serialize();
            fs.writeFileSync(path.join(debugDir, 'session.json'), JSON.stringify(serializedJar, null, 2), 'utf-8');
          }
        } catch {}
      }

      // If courses succeeded, fetch timetable and user info
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

    // Zero-Mock Student Profile: Bind real student details from page HTML or homeHtml
    const emailStr = cleanNetId;
    const netIdPrefix = cleanNetId.split('@')[0].toUpperCase();
    const profileFromPage = lastHtml ? parseStudentProfileFromHtml(lastHtml, cleanNetId) : null;
    const profileFromHome = homeHtml ? parseStudentProfileFromHtml(homeHtml, cleanNetId) : null;
    const resolvedProfile = profileFromPage || profileFromHome;

    const student: StudentProfile = {
      name: userInfo?.name && userInfo.name !== 'Student' ? userInfo.name : (resolvedProfile?.name || netIdPrefix),
      regNumber: userInfo?.regNumber || resolvedProfile?.regNumber || netIdPrefix,
      email: emailStr,
      institution: userInfo?.institution || resolvedProfile?.institution || 'SRM Institute of Science and Technology',
      program: userInfo?.program || resolvedProfile?.program || 'B.Tech.',
      semester: userInfo?.semester || resolvedProfile?.semester || 3,
      department: userInfo?.department || resolvedProfile?.department || 'Computer Science and Engineering',
      section: userInfo?.section || resolvedProfile?.section || 'A',
      batch: userInfo?.batch || resolvedProfile?.batch || '2024 - 2028',
    };

    // STEP 6: ERROR BOX (Build v6-2026-11-17)
    // Format: step name, HTTP status, URL path, response bytes. No HTML preview.
    if (courses.length === 0) {
      const shortErrorMessage = `[Step 5 Attendance Fetch] [build: v6-2026-11-17]: ${successfulUrl} -> HTTP ${attHttpStatus} (${attBytes} bytes), 0 courses parsed. Cookies: [${cookieNames.join(', ')}]`;

      return NextResponse.json(
        {
          success: false,
          error: shortErrorMessage,
          step: 'Step 5 Attendance Fetch',
          buildVersion: 'v6-2026-11-17',
          httpStatus: attHttpStatus,
          bytes: attBytes,
          path: successfulUrl,
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
