import { CampusData, AcademicCalendarDay } from '@/types/campus';
import { SRM_AUTHENTIC_DAY_ORDER_MATRIX } from './timetable';

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
  const endDate = new Date(2026, 10, 30); // 30 Nov 2026 - Strictly concludes at final semester exam

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

    // Strict Rule: Stop assigning regular Day Orders after the official Last Working Day (Nov 20, 2026)
    const isPastLastWorkingDay = dateStr > '2026-11-20';

    if (!isHoliday && !isPastLastWorkingDay) {
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

export const MOCK_CAMPUS_DATA: CampusData = {
  student: {
    name: 'AADITYA N A',
    studentId: '679806',
    regNumber: 'RA2511026010107',
    email: 'an1328@srmist.edu.in',
    institution: 'Faculty of Engineering and Technology, Kattankulathur',
    program: 'B.Tech. Computer Science and Engineering (AI & ML)',
    semester: 3,
    department: 'Computing Technologies',
    section: 'S1',
    batch: '1',
    advisor: 'Dr. Mithra C [mithrac@srmist.edu.in]',
  },
  courses: [
    {
      id: 'c1',
      code: '21CSC201J',
      title: 'DATA STRUCTURES AND ALGORITHMS',
      slot: 'Theory / Lab',
      room: 'TP 601 / UB 711A',
      faculty: 'Faculty TBA',
      credits: 4,
      type: 'Embedded',
      hoursConducted: 83,
      hoursAbsent: 16,
      hoursAttended: 67,
      attendancePercentage: 80.72,
      rawConducted: 83,
      rawAbsent: 16,
      rawPortalPercentage: 80.72,
      marks: [
        { name: 'FJ-I (Theory CLA 1)', scored: 7.54, max: 15 },
        { name: 'FJ-II (Theory CLA 2)', scored: 14.2, max: 15 },
        { name: 'LLJ-I (Lab Component)', scored: 7.0, max: 7 },
      ],
      rawMarksArray: [
        { name: 'FJ-I', scored: 7.54, max: 15 },
        { name: 'FJ-II', scored: 14.2, max: 15 },
        { name: 'LLJ-I', scored: 7.0, max: 7 },
      ],
      totalInternalScored: 28.74,
      totalInternalMax: 37.0,
    },
    {
      id: 'c2',
      code: '21CSC202J',
      title: 'OPERATING SYSTEMS',
      slot: 'Theory / Lab',
      room: 'TP 601 / UB 714A',
      faculty: 'Faculty TBA',
      credits: 4,
      type: 'Embedded',
      hoursConducted: 70,
      hoursAbsent: 9,
      hoursAttended: 61,
      attendancePercentage: 87.14,
      rawConducted: 70,
      rawAbsent: 9,
      rawPortalPercentage: 87.14,
      marks: [
        { name: 'FJ-I (Process & CPU)', scored: 9.6, max: 15 },
        { name: 'FJ-II (Memory Mgmt)', scored: 9.6, max: 15 },
        { name: 'LLJ-I (OS Lab)', scored: 6.76, max: 7 },
      ],
      rawMarksArray: [
        { name: 'FJ-I', scored: 9.6, max: 15 },
        { name: 'FJ-II', scored: 9.6, max: 15 },
        { name: 'LLJ-I', scored: 6.76, max: 7 },
      ],
      totalInternalScored: 25.96,
      totalInternalMax: 37.0,
    },
    {
      id: 'c3',
      code: '21CSC203P',
      title: 'ADVANCED PROGRAMMING PRACTICE',
      slot: 'Lab Practice',
      room: 'TP 601',
      faculty: 'Faculty TBA',
      credits: 2,
      type: 'Practical',
      hoursConducted: 57,
      hoursAbsent: 7,
      hoursAttended: 50,
      attendancePercentage: 87.72,
      rawConducted: 57,
      rawAbsent: 7,
      rawPortalPercentage: 87.72,
      marks: [
        { name: 'FP-I (Sprint 1)', scored: 6.8, max: 10 },
        { name: 'PBL-I (Project Sprint)', scored: 19.78, max: 20 },
      ],
      rawMarksArray: [
        { name: 'FP-I', scored: 6.8, max: 10 },
        { name: 'PBL-I', scored: 19.78, max: 20 },
      ],
      totalInternalScored: 26.58,
      totalInternalMax: 30.0,
    },
    {
      id: 'c4',
      code: '21CSS201T',
      title: 'COMPUTER ORGANIZATION AND ARCHITECTURE',
      slot: 'Theory',
      room: 'TP 601',
      faculty: 'Faculty TBA',
      credits: 3,
      type: 'Theory',
      hoursConducted: 57,
      hoursAbsent: 7,
      hoursAttended: 50,
      attendancePercentage: 87.72,
      rawConducted: 57,
      rawAbsent: 7,
      rawPortalPercentage: 87.72,
      marks: [
        { name: 'FT-I (Instruction Sets)', scored: 3.6, max: 5 },
        { name: 'FT-II (Pipelining)', scored: 11.8, max: 15 },
      ],
      rawMarksArray: [
        { name: 'FT-I', scored: 3.6, max: 5 },
        { name: 'FT-II', scored: 11.8, max: 15 },
      ],
      totalInternalScored: 15.4,
      totalInternalMax: 20.0,
    },
    {
      id: 'c5',
      code: '21LEM201T',
      title: 'PROFESSIONAL ETHICS',
      slot: 'Theory',
      room: 'Online / UB 301',
      faculty: 'Dr. Nirmala D.',
      credits: 2,
      type: 'Theory',
      hoursConducted: 14,
      hoursAbsent: 1,
      hoursAttended: 13,
      attendancePercentage: 92.86,
      rawConducted: 14,
      rawAbsent: 1,
      rawPortalPercentage: 92.86,
      marks: [
        { name: 'FML-I (Case Analysis)', scored: 17.0, max: 20 },
        { name: 'FML-II (Final Assessment)', scored: 52.0, max: 60 },
      ],
      rawMarksArray: [
        { name: 'FML-I', scored: 17.0, max: 20 },
        { name: 'FML-II', scored: 52.0, max: 60 },
      ],
      totalInternalScored: 69.0,
      totalInternalMax: 80.0,
    },
    {
      id: 'c6',
      code: '21LEM202T',
      title: 'UNIVERSAL HUMAN VALUES - II',
      slot: 'Theory',
      room: 'UB 801',
      faculty: 'Dr. M. Sangeetha',
      credits: 2,
      type: 'Theory',
      hoursConducted: 4,
      hoursAbsent: 0,
      hoursAttended: 4,
      attendancePercentage: 100.0,
      rawConducted: 4,
      rawAbsent: 0,
      rawPortalPercentage: 100.0,
      marks: [],
      rawMarksArray: [],
      totalInternalScored: 0,
      totalInternalMax: 0,
    },
    {
      id: 'c7',
      code: '21MAB201T',
      title: 'TRANSFORMS AND BOUNDARY VALUE PROBLEMS',
      slot: 'Theory',
      room: 'TP 601',
      faculty: 'Dr. K. Balasubramanian',
      credits: 4,
      type: 'Theory',
      hoursConducted: 61,
      hoursAbsent: 8,
      hoursAttended: 53,
      attendancePercentage: 86.89,
      rawConducted: 61,
      rawAbsent: 8,
      rawPortalPercentage: 86.89,
      marks: [
        { name: 'FT-I (Fourier Series)', scored: 5.0, max: 5 },
        { name: 'FT-II (PDE & Laplace)', scored: 9.0, max: 15 },
        { name: 'FT-III (Z-Transforms)', scored: 14.0, max: 15 },
        { name: 'LLT-I (Problem Solving)', scored: 10.0, max: 10 },
      ],
      rawMarksArray: [
        { name: 'FT-I', scored: 5.0, max: 5 },
        { name: 'FT-II', scored: 9.0, max: 15 },
        { name: 'FT-III', scored: 14.0, max: 15 },
        { name: 'LLT-I', scored: 10.0, max: 10 },
      ],
      totalInternalScored: 38.0,
      totalInternalMax: 45.0,
    },
  ],
  monthlyAttendance: [
    { month: 'Jul-2026', present: 45, absent: 1 },
    { month: 'Aug-2026', present: 81, absent: 8 },
    { month: 'Sep-2026', present: 69, absent: 16 },
    { month: 'Oct-2026', present: 76, absent: 13 },
    { month: 'Nov-2026', present: 27, absent: 10 },
  ],
  calendar: generateSemesterCalendar(),
  dayOrderMatrix: SRM_AUTHENTIC_DAY_ORDER_MATRIX,
  lastSyncedAt: '2026-11-14T10:00:00.000Z',
  dataSource: 'demo',
};
