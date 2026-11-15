import { NextRequest, NextResponse } from 'next/server';
import { authenticateWithSRMPortal, verifySRMSessionCookie } from '@/lib/srmAuth';
import { parseAttendanceAndMarksHtml, parseStudentProfileFromHtml } from '@/lib/scraper';
import { getGlobalAcademicCalendar } from '@/lib/globalCalendar';
import { encryptSession } from '@/lib/crypto';
import { CampusData } from '@/types/campus';
import { checkIsDeviceRevoked } from '@/app/api/admin/devices/route';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { netId, password, sessionCookie, rememberMe } = body;

    // Strict Zero-Trust Revocation Gate
    const clientDeviceId = body.deviceId || req.headers.get('x-device-id') || '';
    if (clientDeviceId) {
      const isRevoked = await checkIsDeviceRevoked(clientDeviceId);
      if (isRevoked) {
        return NextResponse.json(
          {
            success: false,
            error: 'Device access has been revoked by administrator. Administrator permission is required to enter.',
            revoked: true,
          },
          { status: 403 }
        );
      }
    }

    const cleanNetId = (netId || '').trim();

    // 1. Authenticate with SRM Student Portal
    let authResult;

    if (sessionCookie && sessionCookie.trim()) {
      // Direct session cookie verification
      authResult = await verifySRMSessionCookie(sessionCookie.trim());
    } else if (cleanNetId && password) {
      // Live NetID & Password authentication handshake
      authResult = await authenticateWithSRMPortal(cleanNetId, password);
    } else {
      return NextResponse.json(
        { success: false, error: 'Please enter both your SRM NetID and password.' },
        { status: 400 }
      );
    }

    // 2. Strict rejection on invalid credentials
    if (!authResult.success || !authResult.jsessionId) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Invalid NetID or Password.',
        },
        { status: authResult.statusCode || 401 }
      );
    }

    // 3. Extract actual scraped student profile and courses
    const rawHtml = authResult.attendanceHtml || '';
    const courses = parseAttendanceAndMarksHtml(rawHtml);
    const student = parseStudentProfileFromHtml(rawHtml, cleanNetId);
    const calendar = getGlobalAcademicCalendar();

    const liveData: CampusData = {
      student,
      courses,
      calendar,
      dayOrderMatrix: {},
      lastSyncedAt: new Date().toISOString(),
      dataSource: 'live_student_portal',
    };

    // 4. Encrypt session cookie as HttpOnly
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
    const encryptedToken = encryptSession(authResult.jsessionId);

    const response = NextResponse.json({
      success: true,
      message: `Authenticated successfully with SRM Student Portal as ${student.name}`,
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
      { success: false, error: error.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
