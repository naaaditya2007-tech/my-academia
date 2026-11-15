import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateWithAcademia,
  authenticateWithSRMPortal,
  verifySRMSessionCookie,
} from '@/lib/srmAuth';
import { getGlobalAcademicCalendar } from '@/lib/globalCalendar';
import { encryptSession } from '@/lib/crypto';
import { CampusData } from '@/types/campus';
import { checkIsDeviceRevoked } from '@/app/api/admin/devices/route';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      netId,
      password,
      sessionCookie,
      captcha,
      jsessionId,
      domainField,
      domainValue,
      captchaField,
      captchaValue,
      rememberMe,
      portalMode,
    } = body;

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

    // 1. Authenticate based on provided credentials
    let authResult;

    if (sessionCookie && sessionCookie.trim()) {
      // Direct session cookie / JSESSIONID verification
      authResult = await verifySRMSessionCookie(sessionCookie.trim());
    } else if (cleanNetId && password) {
      // If portalMode is explicitly 'student_portal' or user entered a Register Number with captcha:
      if (portalMode === 'student_portal' || (/^RA\d+/i.test(cleanNetId) && captcha)) {
        authResult = await authenticateWithSRMPortal(
          cleanNetId,
          password,
          captcha,
          jsessionId,
          domainField,
          domainValue,
          captchaField,
          captchaValue
        );
      } else {
        // Campus Web Default: 1-Click NetID Authentication via SRM Academia (Zoho IAM)
        authResult = await authenticateWithAcademia(cleanNetId, password);

        // Fallback to Student Portal if user entered a Register Number and Academia rejected NetID lookup
        if (!authResult.success && authResult.statusCode === 404 && /^RA\d+/i.test(cleanNetId)) {
          authResult = await authenticateWithSRMPortal(
            cleanNetId,
            password,
            captcha,
            jsessionId
          );
        }
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter both your SRM NetID and password.',
          technicalReason: 'Missing credentials in request body',
        },
        { status: 400 }
      );
    }

    // 2. Rejection with exact technical reason
    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Invalid NetID or Password.',
          technicalReason: authResult.technicalReason || 'SRM Portal authentication rejected credentials',
        },
        { status: authResult.statusCode || 401 }
      );
    }

    // 3. Assemble validated student profile and courses
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
    const calendar = getGlobalAcademicCalendar();

    const liveData: CampusData = {
      student,
      courses,
      calendar,
      dayOrderMatrix: {},
      lastSyncedAt: new Date().toISOString(),
      dataSource: 'live_student_portal',
    };

    // 4. Encrypt session token as HttpOnly cookie
    const sessionToken = authResult.cookies || authResult.jsessionId || `user_${cleanNetId}_${Date.now()}`;
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
        error: 'Authentication failed due to an internal server error.',
        technicalReason: error?.message || 'Server exception during login handshake',
      },
      { status: 500 }
    );
  }
}
