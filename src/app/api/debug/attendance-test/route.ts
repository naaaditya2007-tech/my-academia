import { NextRequest, NextResponse } from 'next/server';
import { verifyUser, verifyPassword, getAttendance, logoutUser } from 'srm-academia-api';

export async function POST(req: NextRequest) {
  try {
    const { netId, password } = await req.json().catch(() => ({}));
    if (!netId || !password) {
      return NextResponse.json({ success: false, error: 'netId and password required' }, { status: 400 });
    }

    // Step 1: verifyUser
    const userRes = await verifyUser(netId);
    if (!userRes.success) {
      return NextResponse.json({
        success: false,
        stage: 'verifyUser',
        error: userRes.error,
      });
    }

    // Step 2: verifyPassword
    const passRes = await verifyPassword({
      digest: userRes.digest,
      identifier: userRes.identifier,
      password,
      cookies: userRes.cookies,
    });

    if (!passRes.success) {
      return NextResponse.json({
        success: false,
        stage: 'verifyPassword',
        error: passRes.error,
      });
    }

    // Step 3: getAttendance with exactly the cookies srm-academia-api verified
    const courses: any = await getAttendance(passRes.cookies);

    // Release session
    await logoutUser(passRes.cookies).catch(() => {});

    return NextResponse.json({
      success: courses.length > 0,
      coursesCount: courses.length,
      httpStatus: courses.httpStatus,
      htmlTitle: courses.htmlTitle,
      viewUrl: courses.viewUrl,
      rawSnippetLength: (courses.rawSnippet || '').length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
