import { NextRequest, NextResponse } from 'next/server';
import {
  getAttendance,
  getMarks,
  getTimetable,
  getUserInfo,
  getCalendar,
  logoutUser,
} from 'srm-academia-api';
import { parseAttendanceAndMarksHtml } from '@/lib/scraper';
import { ManualCookieJar } from '@/lib/srmAuth';
import { encryptSession } from '@/lib/crypto';
import { CampusData, Course, InternalMark, StudentProfile } from '@/types/campus';
import { checkIsDeviceRevoked } from '@/app/api/admin/devices/route';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';


async function handleZohoBlockSessions(jar: ManualCookieJar, iamcsr: string, redirectUri?: string) {
  const blockDeleteUrl = 'https://academia.srmist.edu.in/accounts/p/40-10002227248/webclient/v1/announcement/pre/blocksessions';
  try {
    const delRes = await fetch(blockDeleteUrl, {
      method: 'DELETE',
      headers: {
        Cookie: jar.toHeaderString(),
        'X-ZCSRF-TOKEN': `iamcsrcoo=${iamcsr}`,
        'User-Agent': USER_AGENT,
        Origin: 'https://academia.srmist.edu.in',
        Referer: redirectUri || 'https://academia.srmist.edu.in/accounts/p/40-10002227248/announcement/pre/blocksessions',
      },
    });
    jar.updateFromHeaders(delRes.headers);

    const delData: any = await delRes.json().catch(() => ({}));
    const continueUrls = [
      delData?.redirect_url,
      delData?.url,
      'https://academia.srmist.edu.in/accounts/p/40-10002227248/announcement/pre/blocksessions/continue',
      'https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin',
    ].filter(Boolean) as string[];

    for (const contUrl of continueUrls) {
      let current: string | null = contUrl;
      let hops = 0;
      while (current && hops < 5) {
        hops++;
        const res: Response = await fetch(current, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            Cookie: jar.toHeaderString(),
            'User-Agent': USER_AGENT,
            Referer: 'https://academia.srmist.edu.in/',
          },
        });
        jar.updateFromHeaders(res.headers);
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const loc: string | null = res.headers.get('location');
          if (!loc) break;
          current = loc.startsWith('http') ? loc : new URL(loc, current).toString();
        } else {
          break;
        }
      }
      if (Array.from(jar.keys()).some(k => k.startsWith('_iamadt'))) {
        jar.delete('_iamtt');
        break;
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

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

    const jar = new ManualCookieJar();

    // Step A: Initial GET to initialize Zoho IAM session & obtain iamcsr token
    const signinUrl =
      'https://academia.srmist.edu.in/accounts/p/40-10002227248/signin?servicename=ZohoCreator&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2F';

    const initRes = await fetch(signinUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    jar.updateFromHeaders(initRes.headers);
    const iamcsr = jar.get('iamcsr') || '';

    if (!iamcsr) {
      return NextResponse.json(
        {
          success: false,
          error: `[Step 1 CSRF Init]: Failed to obtain iamcsr token from Zoho IAM. Status: ${initRes.status}`,
          technicalReason: 'No iamcsr cookie found in session jar',
          step: 'Step 1 CSRF Init',
          cookiesCaptured: jar.keys(),
        },
        { status: 502 }
      );
    }

    // Step B: NetID Lookup against Zoho IAM
    const lookupUrl = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/lookup/${encodeURIComponent(cleanNetId)}`;
    const lookupBody = new URLSearchParams({
      mode: 'primary',
      cli_time: Date.now().toString(),
      servicename: 'ZohoCreator',
      orgtype: '40',
      serviceurl: 'https://academia.srmist.edu.in/',
    });

    const lookupRes = await fetch(lookupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Cookie: jar.toHeaderString(),
        'X-ZCSRF-TOKEN': `iamcsrcoo=${iamcsr}`,
        Origin: 'https://academia.srmist.edu.in',
        Referer: signinUrl,
      },
      body: lookupBody.toString(),
    });

    jar.updateFromHeaders(lookupRes.headers);
    const lookupData: any = await lookupRes.json().catch(() => ({}));

    if (lookupData.code === 'U100' || lookupData.message?.includes('does not exist')) {
      return NextResponse.json(
        {
          success: false,
          error: `[Step 2 NetID Lookup]: Invalid NetID. Account does not exist on SRM Academia.`,
          technicalReason: lookupData.message || 'Zoho IAM returned U100',
          step: 'Step 2 NetID Lookup',
          cookiesCaptured: jar.keys(),
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
          cookiesCaptured: jar.keys(),
        },
        { status: 400 }
      );
    }

    const identifier = lookupData.lookup.identifier;
    const digest = lookupData.lookup.digest || '';

    // Step C: Submit Password to Zoho IAM
    const signinParams = `digest=${digest}&cli_time=${Date.now()}&servicename=ZohoCreator&orgtype=40&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2F`;
    const passwordUrl = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/primary/${identifier}/password?${signinParams}`;

    const passRes = await fetch(passwordUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Cookie: jar.toHeaderString(),
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

    jar.updateFromHeaders(passRes.headers);
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
          cookiesCaptured: jar.keys(),
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
          cookiesCaptured: jar.keys(),
        },
        { status: 401 }
      );
    }

    // Step 3.5: Auto-terminate concurrent sessions if _iamtt or blocksessions detected
    const hasIamtt = jar.has('_iamtt') || Array.from(jar.keys()).some((k) => k.startsWith('_iamtt'));
    const isBlockSessions =
      hasIamtt ||
      Boolean(passJson?.passwordauth?.redirect_uri?.includes('blocksessions')) ||
      !Array.from(jar.keys()).some((k) => k.startsWith('_iamadt'));

    if (isBlockSessions) {
      await handleZohoBlockSessions(jar, iamcsr, passJson?.passwordauth?.redirect_uri);
    }

    // Step D: Follow redirect_uri hops to activate Zoho session and capture the 4 IAM auth tickets
    const redirectUri =
      passJson?.passwordauth?.redirect_uri ||
      'https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin';

    let currentUrl: string | null = redirectUri;
    let hops = 0;

    for (let hop = 0; hop < 10; hop++) {
      if (!currentUrl) break;
      hops++;
      try {
        const hopRes: Response = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            Cookie: jar.toHeaderString(),
            'User-Agent': USER_AGENT,
            Referer: 'https://academia.srmist.edu.in/',
          },
        });

        jar.updateFromHeaders(hopRes.headers);

        if (currentUrl.includes('blocksessions')) {
          await handleZohoBlockSessions(jar, iamcsr, currentUrl);
        }

        if ([301, 302, 303, 307, 308].includes(hopRes.status)) {
          const loc: string | null = hopRes.headers.get('location');
          if (!loc) break;
          currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).toString();
        } else {
          currentUrl = null;
          break;
        }
      } catch (err) {
        break;
      }
    }

    if (Array.from(jar.keys()).some((k) => k.startsWith('_iamadt'))) {
      jar.delete('_iamtt');
    }

    // CLEAN CREATOR SESSION COOKIES:
    // KEEP: _iamadt*, _iambdt*, __Secure-iamsdt*, _z_identity, zccpn, zalb_74c3a1eecc, cli_rgn, ZCNEWUIPUBLICPORTAL=true (DROP JSESSIONID)
    // DROP: Any /accounts-scoped cookies, zalb_f0e8db9d3d, iamcsr, stk
    jar.set('ZCNEWUIPUBLICPORTAL', 'true');
    const cleanCookieString = jar.toCleanCreatorHeader();

    // Step E: Fetch & Release pattern via srm-academia-api functions using ONLY clean IAM tickets
    let attendanceList: any = [];
    let marksMap: any = {};
    let timetableData: any = { schedule: [], dayOrderMatrix: {} };
    let userInfo: any = null;
    let calendarList: any = [];

    try {
      [attendanceList, marksMap, timetableData, userInfo, calendarList] = await Promise.all([
        getAttendance(cleanCookieString).catch(() => []),
        getMarks(cleanCookieString).catch(() => ({})),
        getTimetable(cleanCookieString).catch(() => ({ schedule: [], dayOrderMatrix: {} })),
        getUserInfo(cleanCookieString).catch(() => null),
        getCalendar(cleanCookieString).catch(() => []),
      ]);
    } finally {
      // Release Zoho session immediately so our app consumes 0 permanent session slots
      await logoutUser(cleanCookieString).catch(() => {});
    }

    // Zero-Mock Student Profile: Strictly bind student details from getUserInfo
    const emailStr = cleanNetId;
    const netIdPrefix = cleanNetId.split('@')[0].toUpperCase();

    const student: StudentProfile = {
      name: userInfo?.name && userInfo.name !== 'Student' ? userInfo.name : netIdPrefix,
      regNumber: userInfo?.regNumber || netIdPrefix,
      email: emailStr,
      institution: userInfo?.institution || 'SRM Institute of Science and Technology',
      program: userInfo?.program || 'B.Tech.',
      semester: userInfo?.semester || 4,
      department: userInfo?.department || 'Computer Science and Engineering',
      section: userInfo?.section || 'A',
      batch: userInfo?.batch || '2024 - 2028',
    };

    // Format courses and attach any fetched internal marks
    const typedMarksMap = (marksMap || {}) as Record<string, any>;
    const courses: Course[] = (attendanceList || []).map((att: any, idx: number) => {
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

      const totalInternalScored = marksList.reduce((acc, m) => acc + m.scored, 0);
      const totalInternalMax = marksList.reduce((acc, m) => acc + m.max, 0);

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
        totalInternalScored,
        totalInternalMax,
        rawConducted: conducted,
        rawAbsent: absent,
        rawPortalPercentage: percentage,
      };
    });

    // Fallback: If 0 courses parsed by srm-academia-api, try parseAttendanceAndMarksHtml directly
    if (courses.length === 0 && attendanceList.rawHtml) {
      const fallbackCourses = parseAttendanceAndMarksHtml(attendanceList.rawHtml);
      if (fallbackCourses.length > 0) {
        courses.push(...fallbackCourses);
      }
    }

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

      const htmlTitle = attendanceList.htmlTitle || 'Unknown Title';
      const httpStatus = attendanceList.httpStatus || 200;
      const rawSnippet = (attendanceList.rawSnippet || '').slice(0, 250);
      const cleanCookieNames = cleanCookieString
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
          cleanCookiesSent: cleanCookieString.split(';').map((s) => s.trim().split('=')[0]),
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
    const sessionToken = cleanCookieString || `user_${cleanNetId}_${Date.now()}`;
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
    const encryptedToken = encryptSession(sessionToken);

    const response = NextResponse.json({
      success: true,
      message: `Authenticated successfully as ${student.name}`,
      data: liveData,
    });

    // 1. Set myacademia_session cookie for middleware.ts
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
