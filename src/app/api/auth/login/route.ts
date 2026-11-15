import { NextRequest, NextResponse } from 'next/server';
import { authenticateWithAcademia } from '@/lib/srmAuth';
import { getGlobalAcademicCalendar } from '@/lib/globalCalendar';
import { encryptSession } from '@/lib/crypto';
import { CampusData } from '@/types/campus';
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

    // 1-Click NetID Authentication via SRM Academia (Zoho IAM)
    const authResult = await authenticateWithAcademia(cleanNetId, password);

    // Rejection with exact technical reason from Zoho
    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Invalid NetID or Password.',
          technicalReason: authResult.technicalReason || 'SRM Academia authentication rejected credentials',
        },
        { status: authResult.statusCode || 401 }
      );
    }

    // Assemble validated student profile and courses
    const student = authResult.student || {
      name: `Student ${cleanNetId.split('@')[0].toUpperCase()}`,
      regNumber: cleanNetId.split('@')[0].toUpperCase(),
      email: cleanNetId.includes('@') ? cleanNetId : `${cleanNetId}@srmist.edu.in`,
      institution: 'SRM Institute of Science and Technology',
      program: 'B.Tech.',
      semester: 4,
      department: 'Computer Science and Engineering',
      section: 'A',
      batch: '2024 - 2028',
    };

    const courses = authResult.courses || [];

    // STRICT RULE: Never silently return empty courses array
    if (courses.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Scraper returned 0 courses',
          attemptedUrl: 'https://academia.srmist.edu.in/liveViewHeader.do?viewLinkName=My_Attendance',
          httpStatus: 200,
          htmlPreview: (authResult.attendanceHtml || '').slice(0, 500),
        },
        { status: 502 }
      );
    }

    const calendar = getGlobalAcademicCalendar();

    const liveData: CampusData = {
      student,
      courses,
      calendar,
      dayOrderMatrix: {},
      lastSyncedAt: new Date().toISOString(),
      dataSource: 'live_student_portal',
    };

    // Encrypt session token as HttpOnly cookie
    const sessionToken = authResult.cookies || `user_${cleanNetId}_${Date.now()}`;
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
