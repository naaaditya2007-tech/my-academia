import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { encryptSession } from '@/lib/crypto';
import { MOCK_CAMPUS_DATA } from '@/lib/mockData';
import { parseAttendanceAndMarksHtml, parseStudentProfileFromHtml } from '@/lib/scraper';
import { getGlobalAcademicCalendar } from '@/lib/globalCalendar';
import { CampusData } from '@/types/campus';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { netId, password, sessionCookie, rememberMe } = body;

    if (!sessionCookie && (!netId || !password)) {
      return NextResponse.json(
        { success: false, error: 'Please enter your SRM NetID & Password, or provide an active JSESSIONID.' },
        { status: 400 }
      );
    }

    const cleanNetId = (netId || '').trim();

    // 1. LIVE SRM SESSION HANDSHAKE (If JSESSIONID session cookie is provided)
    if (sessionCookie) {
      const cleanCookie = sessionCookie.trim();
      const formattedCookie = cleanCookie.includes('JSESSIONID')
        ? cleanCookie
        : `JSESSIONID=${cleanCookie}`;

      try {
        const portalUrl = 'https://sp.srmist.edu.in/srmiststudentportal/students/report/studentAttendanceDetails.jsp';
        const res = await axios.post(
          portalUrl,
          {},
          {
            headers: {
              Cookie: formattedCookie,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 8000,
          }
        );

        if (res.data) {
          const courses = parseAttendanceAndMarksHtml(res.data);
          const studentProfile = parseStudentProfileFromHtml(res.data, cleanNetId);
          const globalCalendar = getGlobalAcademicCalendar();

          if (courses.length > 0) {
            const liveData: CampusData = {
              student: studentProfile,
              courses,
              calendar: globalCalendar,
              dayOrderMatrix: MOCK_CAMPUS_DATA.dayOrderMatrix,
              lastSyncedAt: new Date().toISOString(),
              dataSource: 'live_student_portal',
            };

            const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
            const encryptedCookie = encryptSession(formattedCookie);

            const response = NextResponse.json({
              success: true,
              live: true,
              message: `Connected live to SRM Student Portal as ${studentProfile.name}`,
              data: liveData,
            });

            response.cookies.set('srm_session_encrypted', encryptedCookie, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              path: '/',
              maxAge,
            });

            return response;
          }
        }
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to authenticate with SRM portal using the provided JSESSIONID. Please ensure you are logged into sp.srmist.edu.in and copy a fresh JSESSIONID.',
          },
          { status: 401 }
        );
      }
    }

    // 2. NETID + PASSWORD CREDENTIALS FLOW
    // Derive dynamic, isolated student profile strictly for this user (never leak Aaditya's identity!)
    const studentProfile = parseStudentProfileFromHtml('', cleanNetId);
    const globalCalendar = getGlobalAcademicCalendar();

    const studentData: CampusData = {
      student: studentProfile,
      courses: MOCK_CAMPUS_DATA.courses, // Template course structure
      calendar: globalCalendar,
      dayOrderMatrix: MOCK_CAMPUS_DATA.dayOrderMatrix,
      lastSyncedAt: new Date().toISOString(),
      dataSource: 'demo',
    };

    const syntheticSession = `SRM_${Buffer.from(cleanNetId).toString('base64').slice(0, 10)}_${Date.now()}`;
    const encryptedCookie = encryptSession(syntheticSession);
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;

    const response = NextResponse.json({
      success: true,
      live: false,
      message: `Signed in as ${studentProfile.name}. Connect your live SRM portal session anytime to pull real attendance.`,
      data: studentData,
    });

    response.cookies.set('srm_session_encrypted', encryptedCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Login handshake failed' },
      { status: 500 }
    );
  }
}
