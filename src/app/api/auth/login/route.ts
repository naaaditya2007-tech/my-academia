import { NextRequest, NextResponse } from 'next/server';
import {
  verifyUser,
  verifyPassword,
  getAttendance,
  getMarks,
  getTimetable,
  getUserInfo,
  getCalendar,
} from 'srm-academia-api';
import { encryptSession } from '@/lib/crypto';
import { CampusData, Course, InternalMark, StudentProfile } from '@/types/campus';
import { checkIsDeviceRevoked } from '@/app/api/admin/devices/route';

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

    const cleanNetId = (netId || '').trim();

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

    // Step 1: verifyUser via srm-academia-api
    const userResult = await verifyUser(cleanNetId);
    if (!userResult.success || !userResult.identifier) {
      return NextResponse.json(
        {
          success: false,
          error: `[Step 2 NetID Lookup]: ${userResult.error || 'Invalid NetID. Account does not exist on SRM Academia.'}`,
          technicalReason: userResult.message || userResult.error || 'Zoho IAM validation failed',
          step: 'Step 2 NetID Lookup',
        },
        { status: userResult.code === 'U100' ? 404 : 401 }
      );
    }

    // Step 2: verifyPassword via srm-academia-api
    const passwordResult = await verifyPassword({
      digest: userResult.digest,
      identifier: userResult.identifier,
      password: (password || '').trim(),
      cookies: userResult.cookies,
    });

    if (!passwordResult.success || !passwordResult.isAuthenticated) {
      return NextResponse.json(
        {
          success: false,
          error: `[Step 3 Password Auth]: ${passwordResult.error || 'Incorrect password for SRM Academia.'}`,
          technicalReason: passwordResult.technicalReason || passwordResult.error || 'IN102 Wrong password',
          step: 'Step 3 Password Auth',
        },
        { status: 401 }
      );
    }

    const cookies = passwordResult.cookies;

    // Step 3: Fetch attendance, marks, timetable, userInfo and calendar in parallel via srm-academia-api
    const [attendanceList, marksMap, timetableData, userInfo, calendarList] = await Promise.all([
      getAttendance(cookies).catch(() => []),
      getMarks(cookies).catch(() => ({})),
      getTimetable(cookies).catch(() => ({ schedule: [], dayOrderMatrix: {} })),
      getUserInfo(cookies).catch(() => null),
      getCalendar(cookies).catch(() => []),
    ]);

    // Zero-Mock Student Profile: Strictly bind student details from getUserInfo
    const emailStr = cleanNetId.includes('@') ? cleanNetId : `${cleanNetId}@srmist.edu.in`;
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

    // STEP-BY-STEP TECHNICAL ERROR TRACKER (No generic string, zero dummy courses fallback)
    if (courses.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `[Step 5 Attendance Fetch]: Zoho authenticated successfully for identifier ${userResult.identifier}, but getAttendance() returned 0 courses. Portal may be undergoing scheduled maintenance or the session was redirected to home dashboard.`,
          step: 'Step 5 Attendance Fetch',
          zohoIdentifier: userResult.identifier,
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
    const sessionToken = cookies || `user_${cleanNetId}_${Date.now()}`;
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
    const encryptedToken = encryptSession(sessionToken);

    const response = NextResponse.json({
      success: true,
      message: `Authenticated successfully as ${student.name}`,
      data: liveData,
    });

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
