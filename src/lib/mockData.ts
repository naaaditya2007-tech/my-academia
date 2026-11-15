import { CampusData, AcademicCalendarDay } from '@/types/campus';

function generateSemesterCalendar(): AcademicCalendarDay[] {
  const calendar: AcademicCalendarDay[] = [];
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const holidaysMap: Record<string, string> = {
    '2026-08-15': 'Independence Day',
    '2026-09-04': 'Krishna Jayanthi',
    '2026-09-17': 'Milad-un-Nabi',
    '2026-10-02': 'Gandhi Jayanti',
    '2026-10-20': 'Ayudha Pooja',
    '2026-10-21': 'Vijaya Dasami',
    '2026-11-08': 'Deepavali Eve',
    '2026-11-09': 'Deepavali Festival',
    '2026-11-13': 'Heavy Rain Holiday',
    '2026-11-14': 'Saturday (Weekend)',
    '2026-11-15': 'Sunday (Weekend)',
    '2026-11-20': 'Last Working Day - Odd Semester',
    '2026-12-25': 'Christmas',
  };

  let currentDO = 1;
  let workingDayCounter = 1;

  const startDate = new Date(2026, 6, 21); // 21 Jul 2026
  const endDate = new Date(2026, 10, 30); // 30 Nov 2026 - Concludes at semester exam window

  const cur = new Date(startDate);
  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = (cur.getMonth() + 1).toString().padStart(2, '0');
    const d = cur.getDate().toString().padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const dayOfWeek = daysOfWeek[cur.getDay()];
    const monthName = cur.toLocaleString('default', { month: 'long', year: 'numeric' });

    const isSunday = cur.getDay() === 0;
    const isSaturday = cur.getDay() === 6;

    const specificHoliday = holidaysMap[dateStr];
    const isHoliday = isSunday || isSaturday || (specificHoliday && !specificHoliday.includes('Last Working Day'));

    let holidayReason: string | undefined = undefined;
    if (specificHoliday) {
      holidayReason = specificHoliday;
    } else if (isSunday) {
      holidayReason = 'Sunday';
    } else if (isSaturday) {
      holidayReason = 'Saturday';
    }

    let assignedDO: number | null = null;
    let workDayNo: number | undefined = undefined;

    const isPastLastWorkingDay = dateStr > '2026-11-20';

    if (!isHoliday && !isPastLastWorkingDay) {
      if (dateStr === '2026-11-16') {
        currentDO = 3;
      }
      assignedDO = currentDO;
      workDayNo = workingDayCounter++;
      currentDO = currentDO >= 5 ? 1 : currentDO + 1;
    }

    calendar.push({
      date: dateStr,
      dayOfWeek,
      month: monthName,
      dayOrder: assignedDO,
      isHoliday: !!isHoliday || isPastLastWorkingDay,
      holidayReason: isPastLastWorkingDay && !holidayReason ? 'Semester Exam Window' : holidayReason,
      workingDayNumber: workDayNo,
    });

    cur.setDate(cur.getDate() + 1);
  }

  return calendar;
}

// Zero-Mock: Initial state strictly contains NO hardcoded student names, register numbers, or courses!
export const EMPTY_CAMPUS_DATA: CampusData = {
  student: null,
  courses: [],
  calendar: generateSemesterCalendar(),
  dayOrderMatrix: {},
  lastSyncedAt: '',
  dataSource: 'live_student_portal',
};

// Alias for backwards-compatibility across the codebase
export const MOCK_CAMPUS_DATA = EMPTY_CAMPUS_DATA;
