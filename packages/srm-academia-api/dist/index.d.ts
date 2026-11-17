export interface VerifyUserResult {
  success: boolean;
  identifier: string;
  digest: string;
  code?: string;
  message?: string;
  data?: {
    lookup: {
      identifier: string;
      digest: string;
      status?: string;
    };
  };
  cookies?: string;
  error?: string;
}

export interface VerifyPasswordOptions {
  digest: string;
  identifier: string;
  password: string;
  cookies?: string;
}

export interface VerifyPasswordResult {
  success: boolean;
  isAuthenticated: boolean;
  cookies: string;
  data?: {
    cookies: string;
    redirectUri?: string;
  };
  error?: string;
  technicalReason?: string;
}

export interface CourseAttendance {
  code: string;
  title: string;
  category?: string;
  faculty?: string;
  slot?: string;
  room?: string;
  conducted: number;
  attended: number;
  absent: number;
  percentage: number;
  courseCode: string;
  courseTitle: string;
  hoursConducted: number;
  hoursAttended: number;
  hoursAbsent: number;
  attendancePercentage: number;
  type?: 'theory' | 'practical' | 'integrated';
  marks?: Array<{
    title: string;
    score: number;
    maxScore: number;
    weightage?: number;
  }>;
}

export type AttendanceList = CourseAttendance[] & {
  htmlTitle?: string;
  httpStatus?: number;
  rawSnippet?: string;
  viewUrl?: string;
  isSessionBlocked?: boolean;
  blockReason?: string;
};

export interface UserInfo {
  name: string;
  regNumber: string;
  email?: string;
  department: string;
  program: string;
  semester: number;
  section: string;
  batch: string;
  institution?: string;
}

export interface TimetableSlot {
  dayOrder: number;
  hour: number;
  courseCode: string;
  courseTitle?: string;
  room?: string;
  faculty?: string;
}

export interface TimetableData {
  schedule: TimetableSlot[];
  dayOrderMatrix: Record<number, Record<number, string>>;
}

export interface AcademicCalendarItem {
  date: string;
  dayOfWeek: string;
  month: string;
  dayOrder: number | null;
  isHoliday: boolean;
  holidayReason?: string;
  workingDayNumber?: number;
}

export interface PortalViewResult {
  html: string;
  rawHtml: string;
  lastStatus: number;
  lastUrl: string;
}

export function verifyUser(username: string): Promise<VerifyUserResult>;
export function verifyPassword(options: VerifyPasswordOptions): Promise<VerifyPasswordResult>;
export function fetchPortalView(cookies: string, viewName: string, customUrls?: string[]): Promise<PortalViewResult>;
export function getAttendance(cookies: string): Promise<AttendanceList>;
export function getMarks(cookies: string, existingHtml?: string): Promise<Record<string, any>>;
export function getTimetable(cookies: string): Promise<TimetableData>;
export function getCourse(cookies: string): Promise<AttendanceList>;
export function getUserInfo(cookies: string, existingHtml?: string): Promise<UserInfo>;
export function getCalendar(cookies?: string): Promise<AcademicCalendarItem[]>;
export function logoutUser(cookies: string): Promise<boolean>;
