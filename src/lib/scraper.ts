import * as cheerio from 'cheerio';
import { Course, AcademicCalendarDay, InternalMark } from '@/types/campus';

export interface ScrapedAcademiaData {
  courses: Course[];
  calendar: AcademicCalendarDay[];
  studentName?: string;
  regNumber?: string;
}

/**
 * Parses SRM Student Portal (sp.srmist.edu.in) & Academia HTML
 * Enforces Zero-Mock fallbacks, exact column mapping, and composite key preservation.
 */
export function parseAttendanceAndMarksHtml(html: string): Course[] {
  const $ = cheerio.load(html);
  const courses: Course[] = [];

  // 1. Search for tables containing Attendance columns
  $('table').each((_, table) => {
    const headerTexts = $(table)
      .find('tr')
      .first()
      .find('th, td')
      .map((_, el) => $(el).text().trim().toLowerCase())
      .get();

    const hasCourseCode = headerTexts.some((h) => h === 'code' || h.includes('course code') || h.includes('subcode'));
    const hasAttendance = headerTexts.some(
      (h) =>
        h.includes('attn') ||
        h.includes('attendance') ||
        h.includes('conducted') ||
        h.includes('max. hours') ||
        h.includes('att. hours') ||
        h.includes('absent')
    );

    if (hasCourseCode && hasAttendance) {
      // Find exact column indices
      const codeIdx = headerTexts.findIndex((h) => h === 'code' || h.includes('course code'));
      const titleIdx = headerTexts.findIndex((h) => h === 'description' || h.includes('title') || h.includes('desc') || h.includes('course name'));
      const slotIdx = headerTexts.findIndex((h) => h.includes('slot'));
      const typeIdx = headerTexts.findIndex((h) => h.includes('category') || h.includes('type'));
      const roomIdx = headerTexts.findIndex((h) => h.includes('room') || h.includes('venue'));
      const facultyIdx = headerTexts.findIndex((h) => h.includes('faculty') || h.includes('staff') || h.includes('teacher'));

      // Both modern sp.srmist.edu.in ("Max. hours") and legacy ("Hours Conducted")
      const conductedIdx = headerTexts.findIndex(
        (h) => h.includes('max. hours') || h.includes('conducted') || h.includes('total hours')
      );
      // Both modern sp.srmist.edu.in ("Att. hours") and legacy ("Attended")
      const attendedIdx = headerTexts.findIndex(
        (h) => h.includes('att. hours') || h.includes('attended') || h.includes('hours present')
      );
      // Both modern sp.srmist.edu.in ("Absent hours") and legacy ("Absent")
      const absentIdx = headerTexts.findIndex(
        (h) => h.includes('absent')
      );
      // Both modern sp.srmist.edu.in ("Total Percentage") and legacy ("%")
      const pctIdx = headerTexts.findIndex(
        (h) => h.includes('total percentage') || h.includes('%') || h.includes('percent')
      );

      $(table)
        .find('tr')
        .slice(1)
        .each((rowIdx, row) => {
          const cells = $(row)
            .find('td')
            .map((_, td) => $(td).text().trim())
            .get();

          if (cells.length >= 4) {
            const rawCode = codeIdx >= 0 ? cells[codeIdx] : cells[0];
            const rawTitle = titleIdx >= 0 ? cells[titleIdx] : cells[1];
            const rawSlot = slotIdx >= 0 ? cells[slotIdx] : '';
            const rawType = typeIdx >= 0 ? cells[typeIdx] : '';
            const rawRoom = roomIdx >= 0 ? cells[roomIdx] : '';
            const rawFaculty = facultyIdx >= 0 ? cells[facultyIdx] : '';

            // Clean course code
            const code = rawCode.trim().toUpperCase();
            if (!code || code.length < 5) return;

            // Numerical extraction
            const conducted = conductedIdx >= 0 ? parseInt(cells[conductedIdx], 10) || 0 : 0;
            const absent = absentIdx >= 0 ? parseInt(cells[absentIdx], 10) || 0 : 0;
            
            // Rule: Attended = Conducted - Absent strictly
            let attended = attendedIdx >= 0 ? parseInt(cells[attendedIdx], 10) || (conducted - absent) : (conducted - absent);
            if (attended < 0) attended = Math.max(0, conducted - absent);

            // Raw portal percentage
            const rawPortalPct =
              pctIdx >= 0 && cells[pctIdx]
                ? parseFloat(cells[pctIdx].replace('%', '').trim()) || 0
                : conducted > 0
                ? Math.round(((attended / conducted) * 100) * 100) / 100
                : 100;

            const computedPercentage =
              conducted > 0
                ? Math.round(((attended / conducted) * 100) * 100) / 100
                : 100;

            // Determine Course Type
            const isLab = rawSlot.toUpperCase().includes('P') || rawType.toLowerCase().includes('lab') || rawType.toLowerCase().includes('practical') || code.endsWith('P');
            const isEmbedded = code.endsWith('J') || rawType.toLowerCase().includes('embedded');
            const courseType: 'Theory' | 'Practical' | 'Embedded' = isEmbedded ? 'Embedded' : isLab ? 'Practical' : 'Theory';

            // Composite Key Rule: If a course code appears twice (e.g. Theory & Lab), create distinct keyed entries
            const compositeSlot = rawSlot || (isLab ? 'Lab' : 'Theory');
            const uniqueId = `course_${code}_${compositeSlot.replace(/[^a-zA-Z0-9]/g, '_')}_${rowIdx}`;

            // Rule: Never inject fake professor names or fake room numbers! If missing, use "Venue TBA" / "Faculty TBA"
            const cleanRoom = rawRoom.trim() || 'Venue TBA';
            const cleanFaculty = rawFaculty.trim() || 'Faculty TBA';

            courses.push({
              id: uniqueId,
              code,
              title: rawTitle || code,
              slot: rawSlot || (isEmbedded ? 'Theory / Lab' : isLab ? 'Lab Practice' : 'Theory'),
              room: cleanRoom,
              faculty: cleanFaculty,
              credits: code.endsWith('J') ? 4 : isLab ? 2 : 3,
              type: courseType,
              hoursConducted: conducted,
              hoursAbsent: absent,
              hoursAttended: attended,
              attendancePercentage: rawPortalPct || computedPercentage,
              // Raw Audit Telemetry Fields
              rawConducted: conducted,
              rawAbsent: absent,
              rawPortalPercentage: rawPortalPct,
              rawMarksArray: [],
              marks: [],
              totalInternalScored: 0,
              totalInternalMax: 0,
            });
          }
        });
    }
  });

  // 2. Search for Internal Marks tables (studentInternalMarkDetails.jsp / inner tables)
  $('table').each((_, table) => {
    const headerTexts = $(table)
      .find('tr')
      .first()
      .find('th, td')
      .map((_, el) => $(el).text().trim().toLowerCase())
      .get();

    const hasMarkCol = headerTexts.some((h) => h.includes('mark') || h.includes('max. mark') || h.includes('total mark'));
    const isMarksTable = hasMarkCol || $(table).text().toLowerCase().includes('internal mark details');

    if (isMarksTable) {
      $(table)
        .find('tr')
        .slice(1)
        .each((_, row) => {
          const cells = $(row)
            .find('td')
            .map((_, td) => $(td).text().trim())
            .get();

          if (cells.length >= 2) {
            const possibleCode = cells[0].trim().toUpperCase();
            const matchedCourse = courses.find((c) => c.code.toUpperCase() === possibleCode);

            // Check if row has "Mark / Max. Mark" format (e.g. "28.74 / 37.00")
            const markCell = cells.find((c) => c.includes('/') && /\d+\.?\d*\s*\/\s*\d+\.?\d*/.test(c));
            if (matchedCourse && markCell) {
              const [scoredStr, maxStr] = markCell.split('/').map((s) => s.trim());
              const scored = parseFloat(scoredStr);
              const max = parseFloat(maxStr);

              if (!isNaN(scored) && !isNaN(max)) {
                matchedCourse.totalInternalScored = scored;
                matchedCourse.totalInternalMax = max;
              }
            }

            // Check if this is an inner component breakdown table (e.g. "Entered on", "Component", "Mark / Max. Mark")
            const componentIdx = headerTexts.findIndex((h) => h.includes('component') || h.includes('test') || h.includes('assessment'));
            if (matchedCourse && componentIdx >= 0 && markCell) {
              const componentName = cells[componentIdx] || `Assessment ${matchedCourse.marks.length + 1}`;
              const [scoredStr, maxStr] = markCell.split('/').map((s) => s.trim());
              const scored = parseFloat(scoredStr) || 0;
              const max = parseFloat(maxStr) || 0;

              const markItem: InternalMark = {
                name: componentName,
                scored,
                max,
              };

              matchedCourse.marks.push(markItem);
              if (matchedCourse.rawMarksArray) {
                matchedCourse.rawMarksArray.push(markItem);
              }
            }
          }
        });
    }
  });

  return courses;
}

/**
 * Parses Academic Calendar / Planner table
 */
export function parseAcademicPlannerHtml(html: string): AcademicCalendarDay[] {
  const $ = cheerio.load(html);
  const calendar: AcademicCalendarDay[] = [];

  $('table').each((_, table) => {
    const tableText = $(table).text().toLowerCase();
    if (tableText.includes('day order') || tableText.includes('order') || tableText.includes('academic planner') || tableText.includes('calender')) {
      $(table)
        .find('tr')
        .each((_, row) => {
          const cells = $(row)
            .find('td')
            .map((_, td) => $(td).text().trim())
            .get();

          if (cells.length >= 2) {
            const dateStr = cells[0];
            const dayOrderText = cells[1];

            // Match day order digits 1 to 5
            const doMatch = dayOrderText.match(/([1-5])/);
            const isHoliday =
              dayOrderText.toLowerCase().includes('holiday') ||
              dayOrderText.toLowerCase().includes('sunday') ||
              dayOrderText.toLowerCase().includes('leave') ||
              dayOrderText.toLowerCase().includes('sat');

            if (dateStr && dateStr.length >= 8) {
              calendar.push({
                date: dateStr,
                dayOrder: doMatch ? parseInt(doMatch[1], 10) : null,
                isHoliday: isHoliday || !doMatch,
                holidayReason: isHoliday ? dayOrderText : undefined,
              });
            }
          }
        });
    }
  });

  return calendar;
}
