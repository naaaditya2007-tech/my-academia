import { NextResponse } from 'next/server';
import { MOCK_CAMPUS_DATA } from '@/lib/mockData';

export async function GET() {
  return NextResponse.json({
    success: true,
    calendar: MOCK_CAMPUS_DATA.calendar,
  });
}
