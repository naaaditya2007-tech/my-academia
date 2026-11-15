export interface Course {
  id: string;
  code: string;
  title: string;
  slot: string; // e.g. "A", "B", "C", "P11-P12"
  room: string;
  faculty: string;
  credits: number;
  type: 'Theory' | 'Practical' | 'Embedded';
  hoursConducted: number;
  hoursAbsent: number;
  hoursAttended: number;
  attendancePercentage: number;
  marks: InternalMark[];
  totalInternalScored: number;
  totalInternalMax: number;
  // Raw Audit Data from SRM Portal
  rawConducted?: number;
  rawAbsent?: number;
  rawPortalPercentage?: number;
  rawMarksArray?: InternalMark[];
}

export interface InternalMark {
  name: string; // "Cycle Test 1", "Surprise Test", "Assignment", etc.
  scored: number;
  max: number;
}

export interface DayOrderSlot {
  slotCode: string;
  startTime: string; // "08:00"
  endTime: string;   // "08:50"
  periodIndex: number;
  isLab: boolean;
}

export interface ScheduledClass {
  periodIndex: number;
  startTime: string;
  endTime: string;
  course?: Course;
  isBreak?: boolean;
  breakDurationMinutes?: number;
  status: 'completed' | 'live' | 'upcoming';
}

export interface AcademicCalendarDay {
  date: string; // YYYY-MM-DD
  dayOfWeek?: string; // "Monday", "Tuesday", etc.
  month?: string; // "November 2026"
  dayOrder: number | null; // 1-5, or null if holiday
  isHoliday: boolean;
  holidayReason?: string;
  description?: string;
  workingDayNumber?: number;
}

export interface MonthlyAttendanceRecord {
  month: string;
  present: number;
  absent: number;
}

export interface StudentProfile {
  name: string;
  studentId?: string;
  regNumber: string;
  email?: string;
  institution?: string;
  program: string;
  semester: number;
  department: string;
  section: string;
  batch: string;
  advisor?: string;
}

export interface CampusData {
  student: StudentProfile | null;
  courses: Course[];
  calendar: AcademicCalendarDay[];
  monthlyAttendance?: MonthlyAttendanceRecord[];
  dayOrderMatrix: Record<number, DayOrderSlot[]>; // Day Order 1..5 -> array of slots
  lastSyncedAt: string;
  dataSource?: 'live_student_portal' | 'demo';
}
