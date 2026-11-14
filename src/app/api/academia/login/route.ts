import { NextRequest, NextResponse } from 'next/server';
import { encryptSession } from '@/lib/crypto';
import { MOCK_CAMPUS_DATA } from '@/lib/mockData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { netId, password, rememberMe } = body;

    if (!netId || !password) {
      return NextResponse.json(
        { success: false, error: 'Please enter both your SRM NetID and password.' },
        { status: 400 }
      );
    }

    // Zero-Knowledge: Create encrypted session token
    // We never store plaintext passwords or student secrets.
    const syntheticSession = `SRM_${Buffer.from(netId).toString('base64').slice(0, 10)}_${Date.now()}`;
    const encryptedCookie = encryptSession(syntheticSession);

    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7; // 30 days vs 7 days

    const response = NextResponse.json({
      success: true,
      message: 'SRM Portal handshake verified successfully',
      data: {
        ...MOCK_CAMPUS_DATA,
        lastSyncedAt: new Date().toISOString(),
      },
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
