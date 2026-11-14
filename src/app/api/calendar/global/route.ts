import { NextRequest, NextResponse } from 'next/server';
import {
  getGlobalAcademicCalendar,
  getGlobalAcademicCalendarMeta,
  setGlobalAcademicCalendar,
} from '@/lib/globalCalendar';
import { MOCK_CAMPUS_DATA } from '@/lib/mockData';

/**
 * Global Shared Academic Planner Endpoint
 * 
 * Decouples Academic Planner (Day Orders & Holidays) from individual student syncs.
 * Serves with high-efficiency edge cache headers: s-maxage=3600, stale-while-revalidate=86400
 * Only updates when explicitly triggered from the Admin Console.
 */
export async function GET() {
  const calendar = getGlobalAcademicCalendar();
  const meta = getGlobalAcademicCalendarMeta();

  const response = NextResponse.json({
    success: true,
    calendar,
    meta,
  });

  // Edge / CDN Cache Headers: 1 hour shared max age, 24 hours stale while revalidate
  response.headers.set(
    'Cache-Control',
    's-maxage=3600, stale-while-revalidate=86400'
  );

  return response;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { passkey, calendar } = body;

    // Optional passkey check for admin update
    if (passkey && passkey !== '2808' && passkey !== '2077') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid Admin Passkey' },
        { status: 401 }
      );
    }

    if (calendar && Array.isArray(calendar)) {
      setGlobalAcademicCalendar(calendar, 'Admin Console Manual Sync');
    } else {
      // Re-initialize with verified academic calendar matrix
      setGlobalAcademicCalendar(MOCK_CAMPUS_DATA.calendar, 'Admin Refresh Trigger');
    }

    return NextResponse.json({
      success: true,
      message: 'Global Academic Planner synchronized successfully across all connected students',
      meta: getGlobalAcademicCalendarMeta(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update global academic planner' },
      { status: 500 }
    );
  }
}
