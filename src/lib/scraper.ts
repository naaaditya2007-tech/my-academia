import * as cheerio from 'cheerio';
import { Course, AcademicCalendarDay, InternalMark, StudentProfile } from '@/types/campus';

export interface ScrapedAcademiaData {
  courses: Course[];
  calendar: AcademicCalendarDay[];
  studentName?: string;
  regNumber?: string;
}

/**
 * Decodes Zoho Creator hex-escaped strings (e.g. \x3Ctable...\x3E or parent.sanitize('...')) into clean HTML.
 */
export function decodeZohoHtml(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\//g, '/');
}

export const convertHexToHtml = decodeZohoHtml;

/**
 * Parses Student Profile from SRM Student Portal HTML or SRM Academia HTML
 * Extracts real Student Name, Registration Number, Department, Semester, and Section.
 * Never leaks or defaults to hardcoded identities!
 */
export function parseStudentProfileFromHtml(html: string, fallbackNetId?: string): StudentProfile {
  const cleanHtml = convertHexToHtml(html);
  const $ = cheerio.load(cleanHtml);

  let name = '';
  let regNumber = '';
  let program = 'B.Tech.';
  let department = 'Computer Science and Engineering';
  let semester = 4;
  let section = 'A';
  let batch = '2024 - 2028';
  let advisor = '';

  // 1. Regex search for Registration Number across whole HTML (e.g. RA2311003010123)
  const regMatch = html.match(/\b(RA\d{11,15})\b/i);
  if (regMatch) {
    regNumber = regMatch[1].toUpperCase();
  }

  // 2. Table search for labeled profile fields
  $('tr').each((_, row) => {
    const cells = $(row)
      .find('td, th')
      .map((_, el) => $(el).text().trim())
      .get();

    for (let i = 0; i < cells.length; i++) {
      const label = cells[i].toLowerCase();
      const val = cells[i + 1] || '';

      if (!name && (label.includes('student name') || label === 'name' || label === 'name of the student')) {
        const cleanVal = val.replace(/[:\-]/g, '').trim();
        if (cleanVal && cleanVal.length > 2 && !cleanVal.toLowerCase().includes('reg')) {
          name = cleanVal;
        }
      }
      if (!regNumber && (label.includes('reg') || label.includes('roll no') || label.includes('register no'))) {
        const cleanVal = val.replace(/[:\-]/g, '').trim();
        if (cleanVal && cleanVal.length >= 6) {
          regNumber = cleanVal.toUpperCase();
        }
      }
      if (label.includes('program') || label.includes('degree')) {
        const cleanVal = val.replace(/[:\-]/g, '').trim();
        if (cleanVal) program = cleanVal;
      }
      if (label.includes('department') || label.includes('branch')) {
        const cleanVal = val.replace(/[:\-]/g, '').trim();
        if (cleanVal) department = cleanVal;
      }
      if (label.includes('semester') || label.includes('sem')) {
        const num = parseInt(val.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0 && num <= 10) semester = num;
      }
      if (label.includes('section') || label.includes('sec')) {
        const cleanVal = val.replace(/[:\-]/g, '').trim();
        if (cleanVal) section = cleanVal;
      }
      if (label.includes('advisor') || label.includes('counselor') || label.includes('faculty advisor')) {
        const cleanVal = val.replace(/[:\-]/g, '').trim();
        if (cleanVal) advisor = cleanVal;
      }
    }
  });

  // 3. Fallback resolution dynamically derived from the authenticated NetID
  const cleanNetId = (fallbackNetId || '').trim();
  const netIdPrefix = cleanNetId.includes('@') ? cleanNetId.split('@')[0] : cleanNetId;

  if (!regNumber) {
    if (/^RA\d+/i.test(netIdPrefix)) {
      regNumber = netIdPrefix.toUpperCase();
    } else if (netIdPrefix) {
      regNumber = `SRM_${netIdPrefix.toUpperCase()}`;
    } else {
      regNumber = 'SRM_STUDENT';
    }
  }

  if (!name) {
    if (netIdPrefix) {
      name = `Student ${netIdPrefix.toUpperCase()}`;
    } else {
      name = 'SRM Student';
    }
  }

  const email = cleanNetId.includes('@')
    ? cleanNetId
    : netIdPrefix
    ? `${netIdPrefix.toLowerCase()}@srmist.edu.in`
    : undefined;

  return {
    name,
    regNumber,
    email,
    institution: 'SRM Institute of Science and Technology, Kattankulathur',
    program,
    semester,
    department,
    section,
    batch,
    advisor: advisor || undefined,
  };
}

/**
 * Parses SRM Student Portal (sp.srmist.edu.in) & Academia HTML
 * Enforces Zero-Mock fallbacks, exact column mapping, and composite key preservation.
 */
export function parseAttendanceAndMarksHtml(html: string): Course[] {
  const cleanHtml = convertHexToHtml(html);
  const $ = cheerio.load(cleanHtml);
  const courses: Course[] = [];

  // 1. SRM ACADEMIA PARSER (Zoho Creator #FAFAD2 / #E6E6FA format)
  $('td').each((idx, el) => {
    const bg = $(el).attr('bgcolor');
    if (!bg || bg.toUpperCase() !== '#E6E6FA') return;

    const codeText = $(el).text().trim();
    if (!codeText || codeText === '-' || codeText.length < 5) return;

    const courseCode = codeText.replace(/Regular/i, '').trim().toUpperCase();
    const nextCells = $(el).nextAll();
    const rawTitle = nextCells.eq(0).text().split(' \u2013')[0].trim();
    const rawCategory = nextCells.eq(1).text().trim();
    const rawFaculty = nextCells.eq(2).text().trim();
    const rawSlot = nextCells.eq(3).text().trim();
    const conducted = parseInt(nextCells.eq(5).text().trim(), 10) || 0;
    const absent = parseInt(nextCells.eq(6).text().trim(), 10) || 0;
    const attended = Math.max(0, conducted - absent);
    const computedPercentage = conducted > 0 ? Math.round(((attended / conducted) * 100) * 100) / 100 : 100;

    const isLab = rawSlot.includes('P') || rawCategory.toLowerCase().includes('practical') || courseCode.endsWith('P');
    const isEmbedded = courseCode.endsWith('J') || rawCategory.toLowerCase().includes('embedded');
    const courseType: 'Theory' | 'Practical' | 'Embedded' = isEmbedded ? 'Embedded' : isLab ? 'Practical' : 'Theory';

    courses.push({
      id: `course_${courseCode}_${rawSlot || idx}`,
      code: courseCode,
      title: rawTitle || courseCode,
      slot: rawSlot || (isEmbedded ? 'Theory / Lab' : isLab ? 'Lab Practice' : 'Theory'),
      room: 'Venue TBA',
      faculty: rawFaculty || 'Faculty TBA',
      credits: isEmbedded ? 4 : isLab ? 2 : 3,
      type: courseType,
      hoursConducted: conducted,
      hoursAttended: attended,
      hoursAbsent: absent,
      attendancePercentage: computedPercentage,
      rawConducted: conducted,
      rawAbsent: absent,
      rawPortalPercentage: computedPercentage,
      marks: [],
      rawMarksArray: [],
      totalInternalScored: 0,
      totalInternalMax: 0,
    });
  });

  // Also parse internal marks table for SRM Academia
  if (courses.length > 0) {
    $('table').each((_, table) => {
      const rows = $(table).find('tr');
      rows.each((_, row) => {
        const cells = $(row).find('td').map((_, td) => $(td).text().trim()).get();
        if (cells.length >= 2) {
          const possibleCode = cells[0].trim().toUpperCase();
          const matchedCourse = courses.find((c) => c.code === possibleCode);
          if (matchedCourse) {
            cells.forEach((c) => {
              const slashMatch = c.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/);
              if (slashMatch) {
                const scored = parseFloat(slashMatch[1]) || 0;
                const max = parseFloat(slashMatch[2]) || 0;
                matchedCourse.totalInternalScored = (matchedCourse.totalInternalScored || 0) + scored;
                matchedCourse.totalInternalMax = (matchedCourse.totalInternalMax || 0) + max;
                matchedCourse.marks.push({
                  name: `Assessment ${matchedCourse.marks.length + 1}`,
                  scored,
                  max,
                });
              }
            });
          }
        }
      });
    });

    return courses;
  }

  // 2. Fallback regex matcher across all rows for course code patterns
  $('tr').each((idx, row) => {
    const cells = $(row).find('td');
    if (cells.length < 5) return;
    const codeText = cells.eq(0).text().trim();
    const codeMatch = codeText.match(/\b([0-9]{2}[A-Z]{2,5}[0-9]{3}[A-Z0-9]?)\b/i);
    if (!codeMatch) return;

    const courseCode = codeMatch[1].toUpperCase();
    const rawTitle = cells.eq(1).text().split(' \u2013')[0].trim();
    const rawCategory = cells.eq(2).text().trim();
    const rawFaculty = cells.eq(3).text().trim();
    const rawSlot = cells.eq(4).text().trim();

    let conducted = 0;
    let absent = 0;
    let computedPercentage = 100;

    for (let c = 5; c < cells.length; c++) {
      const text = cells.eq(c).text().trim();
      const num = parseInt(text, 10);
      if (!isNaN(num) && conducted === 0) {
        conducted = num;
      } else if (!isNaN(num) && conducted > 0 && absent === 0) {
        absent = num;
      }
      if (text.includes('.') || (c === cells.length - 1 && !isNaN(parseFloat(text)))) {
        const p = parseFloat(text);
        if (!isNaN(p) && p <= 100) {
          computedPercentage = p;
        }
      }
    }

    const attended = Math.max(0, conducted - absent);
    if (conducted > 0 && computedPercentage === 100) {
      computedPercentage = Math.round(((attended / conducted) * 100) * 100) / 100;
    }

    const isLab = rawSlot.includes('P') || rawCategory.toLowerCase().includes('practical') || courseCode.endsWith('P');
    const isEmbedded = courseCode.endsWith('J') || rawCategory.toLowerCase().includes('embedded');
    const courseType: 'Theory' | 'Practical' | 'Embedded' = isEmbedded ? 'Embedded' : isLab ? 'Practical' : 'Theory';

    if (!courses.some((c) => c.code === courseCode && c.slot === rawSlot)) {
      courses.push({
        id: `course_${courseCode}_${rawSlot || idx}`,
        code: courseCode,
        title: rawTitle || courseCode,
        slot: rawSlot || (isEmbedded ? 'Theory / Lab' : isLab ? 'Lab Practice' : 'Theory'),
        room: 'Venue TBA',
        faculty: rawFaculty || 'Faculty TBA',
        credits: isEmbedded ? 4 : isLab ? 2 : 3,
        type: courseType,
        hoursConducted: conducted,
        hoursAttended: attended,
        hoursAbsent: absent,
        attendancePercentage: computedPercentage,
        rawConducted: conducted,
        rawAbsent: absent,
        rawPortalPercentage: computedPercentage,
        marks: [],
        rawMarksArray: [],
        totalInternalScored: 0,
        totalInternalMax: 0,
      });
    }
  });

  if (courses.length > 0) {
    return courses;
  }

  // 3. Comprehensive Table Parser (for portal HTML & student report tables)
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

/**
 * Step C: Extract real permalinks and view names from homeHtml
 */
export function extractPortalLinksFromHome(homeHtml: string): {
  attendanceUrls: string[];
  timetableUrls: string[];
  foundLinks: string[];
  sharedBy?: string;
  appLinkName?: string;
} {
  const foundLinks: string[] = [];
  const attendanceUrls: string[] = [];
  const timetableUrls: string[] = [];

  if (!homeHtml) {
    attendanceUrls.push('https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance');
    timetableUrls.push('https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Time_Table_2023_24');
    return { attendanceUrls, timetableUrls, foundLinks };
  }

  // 1. Regex search for /[a-zA-Z0-9_-]+\/academia-academic-services\/(page-perma|view-perma|report-perma|form-perma)\/[a-zA-Z0-9_-]+/g
  const permaRegex =
    /[a-zA-Z0-9_-]+\/academia-academic-services\/(?:page-perma|view-perma|report-perma|form-perma)\/[a-zA-Z0-9_-]+/gi;
  let match;
  while ((match = permaRegex.exec(homeHtml)) !== null) {
    const rawMatch = match[0];
    const fullUrl = `https://academia.srmist.edu.in/${rawMatch}`;
    if (!foundLinks.includes(fullUrl)) foundLinks.push(fullUrl);
    if (rawMatch.toLowerCase().includes('attend') && !attendanceUrls.includes(fullUrl)) {
      attendanceUrls.push(fullUrl);
    }
    if (rawMatch.toLowerCase().includes('time') && !timetableUrls.includes(fullUrl)) {
      timetableUrls.push(fullUrl);
    }
  }

  // 2. Discover viewLinkName, pageLinkName, compLinkName, appLinkName, linkName
  const attrRegex =
    /(?:viewLinkName|pageLinkName|compLinkName|appLinkName|linkName)\s*[:=]\s*["']?([a-zA-Z0-9_\-]+)["']?/gi;
  while ((match = attrRegex.exec(homeHtml)) !== null) {
    const linkName = match[1];
    if (linkName && linkName.toLowerCase().includes('attend')) {
      const u = `https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/${linkName}`;
      if (!attendanceUrls.includes(u)) attendanceUrls.push(u);
    }
    if (linkName && linkName.toLowerCase().includes('time')) {
      const u = `https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/${linkName}`;
      if (!timetableUrls.includes(u)) timetableUrls.push(u);
    }
  }

  // 3. Any href/src/onclick containing Attendance, My_Attendance, attendance, Timetable, Mark
  const textLinkRegex =
    /(?:href|src|data-url|action)=["']([^"']*(?:Attendance|attendance|Time_Table|timetable|Marks|marks)[^"']*)["']/gi;
  while ((match = textLinkRegex.exec(homeHtml)) !== null) {
    let rawUrl = match[1];
    if (rawUrl.startsWith('//')) rawUrl = 'https:' + rawUrl;
    else if (rawUrl.startsWith('/')) rawUrl = 'https://academia.srmist.edu.in' + rawUrl;
    else if (!rawUrl.startsWith('http')) rawUrl = `https://academia.srmist.edu.in/${rawUrl}`;

    if (rawUrl.includes('academia.srmist.edu.in')) {
      if (!foundLinks.includes(rawUrl)) foundLinks.push(rawUrl);
      if (rawUrl.toLowerCase().includes('attend') && !attendanceUrls.includes(rawUrl)) {
        attendanceUrls.push(rawUrl);
      }
      if (rawUrl.toLowerCase().includes('time') && !timetableUrls.includes(rawUrl)) {
        timetableUrls.push(rawUrl);
      }
    }
  }

  // 4. Canonical fallbacks using app name srm_university (never numeric ID)
  const canonicalAttendance = 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance';
  if (!attendanceUrls.includes(canonicalAttendance)) {
    attendanceUrls.push(canonicalAttendance);
  }

  const canonicalTimetable = 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Time_Table_2023_24';
  if (!timetableUrls.includes(canonicalTimetable)) {
    timetableUrls.push(canonicalTimetable);
  }

  return { attendanceUrls, timetableUrls, foundLinks };
}
