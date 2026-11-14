import { NextResponse } from 'next/server';
import { MOCK_CAMPUS_DATA } from '@/lib/mockData';

export async function GET() {
  return NextResponse.json({
    success: true,
    dayOrderMatrix: MOCK_CAMPUS_DATA.dayOrderMatrix,
    courses: MOCK_CAMPUS_DATA.courses.map((c) => ({
      code: c.code,
      title: c.title,
      slot: c.slot,
      room: c.room,
      faculty: c.faculty,
    })),
  });
}
