import { NextResponse } from 'next/server';
import { MOCK_CAMPUS_DATA } from '@/lib/mockData';
import { calculateAttendanceMargin } from '@/lib/attendance';

export async function GET() {
  const attendanceReport = MOCK_CAMPUS_DATA.courses.map((course) => ({
    code: course.code,
    title: course.title,
    hoursConducted: course.hoursConducted,
    hoursAttended: course.hoursAttended,
    hoursAbsent: course.hoursAbsent,
    percentage: course.attendancePercentage,
    margin: calculateAttendanceMargin(course.hoursConducted, course.hoursAttended),
    marks: course.marks,
    totalInternalScored: course.totalInternalScored,
    totalInternalMax: course.totalInternalMax,
  }));

  return NextResponse.json({
    success: true,
    courses: attendanceReport,
  });
}
