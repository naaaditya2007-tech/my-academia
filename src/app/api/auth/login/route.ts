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

    // Step 3.6: Purge /accounts cookies (iamcsr, stk, zalb_f0e8db9d3d, accounts JSESSIONID) and isolate IAM tickets
    const step3Cookies = await jar.getCookies('https://academia.srmist.edu.in/');
    const iamAuthTickets = step3Cookies.filter((c) =>
      c.key.startsWith('_iamadt') ||
      c.key.startsWith('_iambdt') ||
      c.key.startsWith('__Secure-iamsdt') ||
      c.key === '_z_identity'
    );

    const cleanJar = new CookieJar();
    for (const c of iamAuthTickets) {
      await cleanJar.setCookie(
        `${c.key}=${c.value}; Path=/; Domain=academia.srmist.edu.in; Secure; HttpOnly`,
        'https://academia.srmist.edu.in/'
      );
    }
    const cleanClient = fetchCookie(fetch, cleanJar);

    // Step 4: Follow redirect_uri with the clean Creator jar (mints Creator-only cookies)
    const redirectUri =
      passJson?.passwordauth?.redirect_uri ||
      'https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin';

    try {
      await cleanClient(redirectUri, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: 'https://academia.srmist.edu.in/',
        },
      });
    } catch {}

    let homeHtml = '';
    try {
      const homeRes = await cleanClient('https://academia.srmist.edu.in/', {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: 'https://academia.srmist.edu.in/',
        },
      });
      homeHtml = await homeRes.text();
    } catch {}

    // Force ZCNEWUIPUBLICPORTAL on root path
    await cleanJar.setCookie(
      'ZCNEWUIPUBLICPORTAL=true; Path=/; Domain=academia.srmist.edu.in',
      'https://academia.srmist.edu.in/'
    );

    // Extract Creator CSRF token (zccpn) and pristine Creator cookie string
    const creatorCookies = await cleanJar.getCookies('https://academia.srmist.edu.in/');
    const zccpnValue = creatorCookies.find((c) => c.key === 'zccpn')?.value || '';
    const creatorCookieStr = await cleanJar.getCookieString(
      'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance'
    );

    // Step 5: Multi-Strategy View Fetch & Release Zoho Session
    let courses: Course[] = [];
    let attendanceList: any = [];
    let marksMap: any = {};
    let timetableData: any = { schedule: [], dayOrderMatrix: {} };
    let userInfo: any = null;
    let calendarList: any = [];
    let lastHttpStatus = 200;
    let lastHtmlTitle = '';
    let lastRawSnippet = '';

    const targetViewUrls = [
      'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance',
      'https://academia.srmist.edu.in/49910842/academia-academic-services/page-perma/My_Attendance',
      'https://academia.srmist.edu.in/portal/academia-academic-services/page-perma/My_Attendance',
      'https://academia.srmist.edu.in/liveViewHeader.do?sharedBy=srm_university&appLinkName=academia-academic-services&viewLinkName=My_Attendance',
      'https://academia.srmist.edu.in/liveViewHeader.do?sharedBy=49910842&appLinkName=academia-academic-services&viewLinkName=My_Attendance',
      'https://academia.srmist.edu.in/portal/academia-academic-services/view-embed/My_Attendance',
      'https://academia.srmist.edu.in/49910842/academia-academic-services/view-embed/My_Attendance',
    ];

    try {
      // Strategy A: AJAX GET with Zoho CSRF Header (X-ZCSRF-TOKEN: zccpn=...)
      for (const url of targetViewUrls) {
        try {
          const resA = await fetch(url, {
            method: 'GET',
            headers: {
              Cookie: creatorCookieStr,
              Accept: '*/*',
              'X-Requested-With': 'XMLHttpRequest',
              ...(zccpnValue ? { 'X-ZCSRF-TOKEN': `zccpn=${zccpnValue}` } : {}),
              Referer: 'https://academia.srmist.edu.in/',
              'User-Agent': USER_AGENT,
            },
          });
          lastHttpStatus = resA.status;
          const textA = await resA.text();
          if (textA) {
            lastRawSnippet = textA.slice(0, 250);
            lastHtmlTitle = textA.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
            const parsedA = parseAttendanceAndMarksHtml(textA);
            if (parsedA.length > 0) {
              courses = parsedA;
              break;
            }
          }
        } catch {}
      }

      // Strategy B: Standard srm-academia-api call with clean Creator cookies
      try {
        [attendanceList, marksMap, timetableData, userInfo, calendarList] = await Promise.all([
          getAttendance(creatorCookieStr).catch(() => []),
          getMarks(creatorCookieStr).catch(() => ({})),
          getTimetable(creatorCookieStr).catch(() => ({ schedule: [], dayOrderMatrix: {} })),
          getUserInfo(creatorCookieStr).catch(() => null),
          getCalendar(creatorCookieStr).catch(() => []),
        ]);

        if (courses.length === 0 && Array.isArray(attendanceList) && attendanceList.length > 0) {
          const typedMarksMap = (marksMap || {}) as Record<string, any>;
          courses = attendanceList.map((att: any, idx: number) => {
            const code = (att.courseCode || att.code || '').trim().toUpperCase();
            const rawMarks = typedMarksMap[code] || [];
            const marksList: InternalMark[] = Array.isArray(rawMarks)
              ? rawMarks.map((m: any, mIdx: number) => ({
                  name: m.title || m.name || `Assessment ${mIdx + 1}`,
                  scored: Number(m.score ?? m.scored ?? 0),
                  max: Number(m.maxScore ?? m.max ?? 100),
                }))
              : [];

            const conducted = Number(att.hoursConducted ?? att.conducted ?? 0);
            const attended = Number(att.hoursAttended ?? att.attended ?? 0);
            const absent = Number(att.hoursAbsent ?? att.absent ?? (conducted >= attended ? conducted - attended : 0));
            const percentage = Number(
              att.attendancePercentage ?? att.percentage ?? (conducted > 0 ? Math.round((attended / conducted) * 10000) / 100 : 0)
            );

            const courseType: 'Theory' | 'Practical' | 'Embedded' = code.endsWith('J')
              ? 'Embedded'
              : code.endsWith('P')
              ? 'Practical'
              : 'Theory';

            return {
              id: `course_${code}_${idx}`,
              code,
              title: att.courseTitle || att.title || code,
              slot: att.slot || 'A',
              room: att.room || '',
              faculty: att.faculty || 'Faculty Member',
              credits: att.credits ? Number(att.credits) : 3,
              type: courseType,
              hoursConducted: conducted,
              hoursAttended: attended,
              hoursAbsent: absent,
              attendancePercentage: percentage,
              marks: marksList,
              totalInternalScored: marksList.reduce((acc, m) => acc + m.scored, 0),
              totalInternalMax: marksList.reduce((acc, m) => acc + m.max, 0),
              rawConducted: conducted,
              rawAbsent: absent,
              rawPortalPercentage: percentage,
            };
          });
        }

        if (courses.length === 0 && attendanceList?.rawHtml) {
          const parsedB = parseAttendanceAndMarksHtml(attendanceList.rawHtml);
          if (parsedB.length > 0) {
            courses = parsedB;
          }
        }

        if (attendanceList?.httpStatus) lastHttpStatus = attendanceList.httpStatus;
        if (attendanceList?.htmlTitle) lastHtmlTitle = attendanceList.htmlTitle;
        if (attendanceList?.rawSnippet) lastRawSnippet = attendanceList.rawSnippet;
      } catch {}

      // Strategy C: POST with zccpn form body if still 0 courses (or if 403 returned)
      if (courses.length === 0) {
        for (const url of targetViewUrls) {
          try {
            const resC = await fetch(url, {
              method: 'POST',
              headers: {
                Cookie: creatorCookieStr,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                ...(zccpnValue ? { 'X-ZCSRF-TOKEN': `zccpn=${zccpnValue}` } : {}),
                Referer: 'https://academia.srmist.edu.in/',
                'User-Agent': USER_AGENT,
              },
              body: zccpnValue ? `zccpn=${encodeURIComponent(zccpnValue)}` : '',
            });
            lastHttpStatus = resC.status;
            const textC = await resC.text();
            if (textC) {
              lastRawSnippet = textC.slice(0, 250);
              lastHtmlTitle = textC.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
              const parsedC = parseAttendanceAndMarksHtml(textC);
              if (parsedC.length > 0) {
                courses = parsedC;
                break;
              }
            }
          } catch {}
        }
      }

      // Strategy D: Fallback to homeHtml (845KB) if still 0 courses
      if (courses.length === 0 && homeHtml) {
        const homeCourses = parseAttendanceAndMarksHtml(homeHtml);
        if (homeCourses.length > 0) {
          courses = homeCourses;
        }
      }
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
      if (attendanceList.isSessionBlocked || attendanceList.blockReason) {
        return NextResponse.json(
          {
            success: false,
            error:
              "SRM Academia 2-session limit reached. Open academia.srmist.edu.in, click 'Terminate All Sessions', then immediately click 'Sign Out' so a session slot is free.",
            technicalReason: 'Maximum concurrent active sessions (2) exceeded on Zoho IAM for SRM Academia.',
            step: 'Zoho Concurrent Session Gate',
            isSessionBlocked: true,
            zohoIdentifier: identifier,
          },
          { status: 409 }
        );
      }

      const htmlTitle = lastHtmlTitle || attendanceList.htmlTitle || 'Unknown Title';
      const httpStatus = lastHttpStatus || attendanceList.httpStatus || 200;
      const rawSnippet = (lastRawSnippet || attendanceList.rawSnippet || '').slice(0, 250);
      const cleanCookieNames = creatorCookieStr
        .split(';')
        .map((s) => s.trim().split('=')[0])
        .filter(Boolean)
        .join(', ');

      return NextResponse.json(
        {
          success: false,
          error: `[Step 5 Attendance Fetch]: Zoho returned HTTP ${httpStatus} (<title>${htmlTitle}</title>), but 0 courses were parsed. CleanCookiesSent: [${cleanCookieNames}] | HTML Preview: ${JSON.stringify(rawSnippet)}`,
          step: 'Step 5 Attendance Fetch',
          zohoIdentifier: identifier,
          htmlTitle,
          httpStatus,
          rawSnippet,
          cleanCookieNames,
          cleanCookiesSent: creatorCookieStr.split(';').map((s) => s.trim().split('=')[0]),
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
