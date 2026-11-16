import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Session invalidated and local encryption cleared',
  });

  // Expire all session cookies immediately
  response.cookies.set('srm_session_encrypted', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set('campus_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set('myacademia_session', '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}
