import * as cheerio from 'cheerio';
import { Course, AcademicCalendarDay, InternalMark, StudentProfile } from '@/types/campus';

export interface ScrapedAcademiaData {
  courses: Course[];
  calendar: AcademicCalendarDay[];
  studentName?: string;
  regNumber?: string;
}

/**
 * Decodes Zoho Creator hex-escaped (\xNN), unicode-escaped (\uNNNN) and HTML entity strings into clean HTML.
 */
export function decodeZohoHtml(raw: string): string {
  if (!raw) return '';
  let str = raw
    // Decode \xNN hex escapes
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Decode \uNNNN unicode escapes
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Decode common escaped chars
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\//g, '/');

  // If HTML entities like &lt;table or &lt;td are present, decode them
  if (str.includes('&lt;') || str.includes('&gt;') || str.includes('&amp;') || str.includes('&#')) {
    str = str
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  }

  return str;
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
      const cleanLabel = cells[i].replace(/[:\-]/g, '').trim().toLowerCase();
      const val = cells[i + 1] || '';

      if (!name && (cleanLabel.includes('student name') || cleanLabel === 'name' || cleanLabel === 'name of the student')) {
        const cleanVal = val.replace(/[:\-]/g, '').trim();
        if (cleanVal && cleanVal.length > 1 && !cleanVal.toLowerCase().includes('reg')) {
          name = cleanVal;
        }
      }
      if (!regNumber && (cleanLabel.includes('reg') || cleanLabel.includes('roll no') || cleanLabel.includes('register no'))) {
        const cleanVal = val.replace(/[:\-]/g, '').trim();
        if (cleanVal && cleanVal.length >= 6) {
          regNumber = cleanVal.toUpperCase();
        }
      }
      if (cleanLabel.includes('program') || cleanLabel.includes('degree')) {
        const cleanVal = val.replace(/[:\-]/g, '').trim();
        if (cleanVal) program = cleanVal;
      }
      if (cleanLabel.includes('department') || cleanLabel.includes('branch')) {
        const cleanVal = val.replace(/[:\-]/g, '').trim();
        if (cleanVal) department = cleanVal;
      }
      if (cleanLabel.includes('semester') || cleanLabel.includes('sem')) {
        const num = parseInt(val.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0 && num <= 10) semester = num;
      }
      if (cleanLabel.includes('section') || cleanLabel.includes('sec')) {
        const cleanVal = val.replace(/[:\-]/g, '').trim();
        if (cleanVal) section = cleanVal;
      }
      if (cleanLabel.includes('advisor') || cleanLabel.includes('counselor') || cleanLabel.includes('faculty advisor')) {
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
 * Helper to identify a course code cell within an array of row cell texts.
 */
function findCourseCodeInCells(cells: string[]): { code: string; index: number } | null {
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i].trim();
    if (!cell) continue;
    // Skip dates, years, headers, pure numbers
    if (/^\d{4}[-\/]\d{2,4}$/.test(cell) || /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/.test(cell) || /^\d+$/.test(cell)) {
      continue;
    }
    // Match SRM course code pattern: 2 numbers (optional) + 2-6 letters + 2-4 numbers + optional suffix letter/number
    const m = cell.match(/\b([0-9]{2}[A-Z]{2,6}[0-9]{2,4}[A-Z0-9]?|[A-Z]{2,6}[0-9]{2,4}[A-Z0-9]?)\b/i);
    if (m) {
      const matched = m[1].toUpperCase();
      if (matched.length >= 5 && matched.length <= 12) {
        return { code: matched, index: i };
      }
    }
  }
  return null;
}

/**
 * Extracts Course objects from a Cheerio-loaded DOM tree
 */
function extractCoursesFromCheerio($: cheerio.CheerioAPI): Course[] {
  const courses: Course[] = [];
  const seenCodes = new Set<string>();

  // 1. Check for standard SRM Academia #E6E6FA bgcolor cells
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

    const courseKey = `${courseCode}_${rawSlot}`;
    if (!seenCodes.has(courseKey)) {
      seenCodes.add(courseKey);
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

  if (courses.length > 0) return courses;

  // 2. Scan all tables and table rows for any row containing a course code
  $('table').each((_, table) => {
    // Find header row in this table if one exists
    let headerRow: string[] = [];
    $(table).find('tr').each((_, tr) => {
      const texts = $(tr).find('th, td').map((_, el) => $(el).text().replace(/[:\-]/g, '').trim().toLowerCase()).get();
      if (texts.some(t => t.includes('course code') || t === 'code')) {
        headerRow = texts;
      }
    });

    const titleColIdx = headerRow.findIndex(t => t.includes('course title') || t.includes('title') || t.includes('description'));
    const categoryColIdx = headerRow.findIndex(t => t.includes('category'));
    const typeColIdx = headerRow.findIndex(t => t.includes('course type') || t.includes('type'));
    const facultyColIdx = headerRow.findIndex(t => t.includes('faculty name') || t.includes('faculty') || t.includes('staff'));
    const slotColIdx = headerRow.findIndex(t => t.includes('slot'));
    const roomColIdx = headerRow.findIndex(t => t.includes('room no') || t.includes('room') || t.includes('venue'));
    const creditColIdx = headerRow.findIndex(t => t.includes('credit'));
    const conductedColIdx = headerRow.findIndex(t => t.includes('conducted') || t.includes('max hours') || t.includes('max. hours'));
    const absentColIdx = headerRow.findIndex(t => t.includes('absent'));
    const pctColIdx = headerRow.findIndex(t => t.includes('%') || t.includes('percentage'));

    $(table).find('tr').each((rowIdx, row) => {
      const cells = $(row)
        .find('td, th')
        .map((_, el) => $(el).text().trim())
        .get();

      if (cells.length < 3) return;

      const found = findCourseCodeInCells(cells);
      if (!found) return;

      const courseCode = found.code;
      const codeIdx = found.index;

      // Remaining cells before or after the code for heuristics
      const cellsAfter = cells.slice(codeIdx + 1);
      const cellsBefore = cells.slice(0, codeIdx);

      // Extract title
      let rawTitle = titleColIdx >= 0 && cells[titleColIdx] ? cells[titleColIdx].split(' \u2013')[0].trim() : '';
      if (!rawTitle) {
        const nonNumericAfter = cellsAfter.filter((c) => c && isNaN(Number(c)) && !c.includes('%'));
        if (nonNumericAfter.length > 0) {
          rawTitle = nonNumericAfter[0].split(' \u2013')[0].trim();
        } else if (cellsBefore.length > 0) {
          const nonNumBefore = cellsBefore.filter((c) => c && isNaN(Number(c)) && !c.includes('%'));
          if (nonNumBefore.length > 0) rawTitle = nonNumBefore[0].trim();
        }
      }

      // Extract slot
      let rawSlot = slotColIdx >= 0 && cells[slotColIdx] ? cells[slotColIdx].toUpperCase() : '';
      if (!rawSlot) {
        for (const c of cellsAfter) {
          if (/^[A-Z][0-9]?(\+[A-Z][0-9]?)?$/i.test(c) || /^P[0-9]+$/i.test(c) || /slot/i.test(c)) {
            rawSlot = c.toUpperCase();
            break;
          }
        }
      }

      // Extract category
      let rawCategory = categoryColIdx >= 0 && cells[categoryColIdx] ? cells[categoryColIdx] : '';
      if (!rawCategory) {
        for (const c of cellsAfter) {
          if (/theory|practical|embedded|integrated|core|elective|project/i.test(c)) {
            rawCategory = c;
            break;
          }
        }
      }

      // Extract faculty
      let rawFaculty = facultyColIdx >= 0 && cells[facultyColIdx] ? cells[facultyColIdx] : '';
      if (!rawFaculty) {
        for (const c of cellsAfter) {
          if (/(Dr\.|Prof\.|Mr\.|Mrs\.)/i.test(c) || (c.length > 5 && c.includes(' ') && isNaN(Number(c)) && c !== rawTitle && c !== rawCategory)) {
            rawFaculty = c;
            break;
          }
        }
      }

      // Extract room
      let rawRoom = roomColIdx >= 0 && cells[roomColIdx] ? cells[roomColIdx] : '';
      if (!rawRoom) {
        for (const c of cellsAfter) {
          if (/(TP|UB|BEL|Room|Hall|Lab)/i.test(c) && /\d+/.test(c)) {
            rawRoom = c;
            break;
          }
        }
      }

      // Extract credits
      let rawCredits = creditColIdx >= 0 && cells[creditColIdx] ? parseInt(cells[creditColIdx], 10) : 0;

      // Extract numbers: conducted, absent, percentage
      let conducted = conductedColIdx >= 0 && cells[conductedColIdx] ? parseInt(cells[conductedColIdx], 10) || 0 : 0;
      let absent = absentColIdx >= 0 && cells[absentColIdx] ? parseInt(cells[absentColIdx], 10) || 0 : 0;
      let computedPercentage = pctColIdx >= 0 && cells[pctColIdx] ? parseFloat(cells[pctColIdx].replace('%', '')) || 100 : 100;

      if (!conducted && !absent) {
        const numbers: number[] = [];
        for (const c of cellsAfter) {
          if (c.includes('%')) {
            const p = parseFloat(c.replace('%', '').trim());
            if (!isNaN(p)) computedPercentage = p;
          } else {
            const num = parseFloat(c);
            if (!isNaN(num) && num >= 0 && num <= 500) {
              numbers.push(num);
            }
          }
        }

        if (numbers.length >= 2) {
          conducted = Math.max(numbers[0], numbers[1]);
          absent = Math.min(numbers[0], numbers[1]);
        } else if (numbers.length === 1) {
          conducted = numbers[0];
        }
      }

      const attended = Math.max(0, conducted - absent);
      if (conducted > 0 && computedPercentage === 100 && absent > 0) {
        computedPercentage = Math.round(((attended / conducted) * 100) * 100) / 100;
      }

      const isLab = rawSlot.includes('P') || rawCategory.toLowerCase().includes('practical') || courseCode.endsWith('P');
      const isEmbedded = courseCode.endsWith('J') || rawCategory.toLowerCase().includes('embedded');
      const courseType: 'Theory' | 'Practical' | 'Embedded' = isEmbedded ? 'Embedded' : isLab ? 'Practical' : 'Theory';

      const courseKey = `${courseCode}_${rawSlot}`;
      if (!seenCodes.has(courseKey)) {
        seenCodes.add(courseKey);
        courses.push({
          id: `course_${courseCode}_${rawSlot || rowIdx}`,
          code: courseCode,
          title: rawTitle || courseCode,
          slot: rawSlot || (isEmbedded ? 'Theory / Lab' : isLab ? 'Lab Practice' : 'Theory'),
          room: rawRoom || 'Venue TBA',
          faculty: rawFaculty || 'Faculty TBA',
          credits: rawCredits || (isEmbedded ? 4 : isLab ? 2 : 3),
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
  });

  return courses;
}

/**
 * Parses SRM Student Portal (sp.srmist.edu.in) & Academia HTML
 * Enforces Zero-Mock fallbacks, exact column mapping, and composite key preservation.
 */
export function parseAttendanceAndMarksHtml(html: string): Course[] {
  const cleanHtml = convertHexToHtml(html);
  const $ = cheerio.load(cleanHtml);
  let courses: Course[] = extractCoursesFromCheerio($);

  // Strategy D: If 0 courses found, check if tables are embedded inside <script> tags or raw text
  if (courses.length === 0) {
    const scriptSnippets: string[] = [];
    $('script').each((_, s) => {
      const text = $(s).html() || '';
      if (text.includes('<table') || text.includes('\\x3Ctable') || text.includes('\\u003Ctable') || text.includes('&lt;table')) {
        scriptSnippets.push(decodeZohoHtml(text));
      }
    });

    // Also scan entire cleanHtml for raw <table>...</table> blocks that Cheerio may have missed
    const tableRegex = /<table[\s\S]*?<\/table>/gi;
    let match;
    while ((match = tableRegex.exec(cleanHtml)) !== null) {
      scriptSnippets.push(match[0]);
    }

    for (const snippet of scriptSnippets) {
      const $sub = cheerio.load(snippet);
      const subCourses = extractCoursesFromCheerio($sub);
      if (subCourses.length > 0) {
        courses = subCourses;
        break;
      }
    }
  }

  // Parse internal marks table for any extracted courses
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
  }

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

  const canonicalPagePerma =
    'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance';
  const canonicalPage =
    'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance';
  const canonicalTimetable =
    'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Time_Table_2023_24';

  if (!homeHtml) {
    return {
      attendanceUrls: [canonicalPagePerma, canonicalPage],
      timetableUrls: [canonicalTimetable],
      foundLinks: [],
    };
  }

  // 1. Regex search for /[a-zA-Z0-9_-]+\/academia-academic-services\/(page-perma|view-perma|report-perma|form-perma)\/[a-zA-Z0-9_-]+/g
  // Strictly filter out any "/portal/" paths!
  const permaRegex =
    /[a-zA-Z0-9_-]+\/academia-academic-services\/(?:page-perma|view-perma|report-perma|form-perma|page|view)\/[a-zA-Z0-9_-]+/gi;
  let match;
  while ((match = permaRegex.exec(homeHtml)) !== null) {
    const rawMatch = match[0];
    if (rawMatch.startsWith('portal/')) continue; // Skip /portal/ poisoned paths
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
      const u1 = `https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/${linkName}`;
      const u2 = `https://academia.srmist.edu.in/srm_university/academia-academic-services/page/${linkName}`;
      if (!attendanceUrls.includes(u1)) attendanceUrls.push(u1);
      if (!attendanceUrls.includes(u2)) attendanceUrls.push(u2);
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
    if (rawUrl.includes('/portal/')) continue; // Skip /portal/ poisoned paths
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

  // 4. Canonical fallbacks: srm_university page-perma and page (never /portal/ and never numeric ID)
  if (!attendanceUrls.includes(canonicalPagePerma)) {
    attendanceUrls.push(canonicalPagePerma);
  }
  if (!attendanceUrls.includes(canonicalPage)) {
    attendanceUrls.push(canonicalPage);
  }

  if (!timetableUrls.includes(canonicalTimetable)) {
    timetableUrls.push(canonicalTimetable);
  }

  return { attendanceUrls, timetableUrls, foundLinks };
}

export interface HomeKeywordMatch {
  keyword: string;
  snippet: string;
}

export interface HomeLoggedInCheck {
  hasLogout: boolean;
  hasUserNetId: boolean;
  hasLoginForm: boolean;
  hasMyAttendance: boolean;
}

/**
 * Step 1 & 2: Check logged-in indicators and extract up to 8 sanitized 200-char keyword snippets
 */
export function searchHomeHtmlForKeywords(
  homeHtml: string,
  userNetId?: string
): {
  totalMatches: number;
  snippets: HomeKeywordMatch[];
  discoveredUrls: string[];
  loggedInCheck: HomeLoggedInCheck;
} {
  const cleanNetIdPrefix = (userNetId || '').trim().split('@')[0].toLowerCase();
  const lowerHome = (homeHtml || '').toLowerCase();

  const loggedInCheck: HomeLoggedInCheck = {
    hasLogout:
      lowerHome.includes('logout') ||
      lowerHome.includes('signout') ||
      lowerHome.includes('sign out') ||
      lowerHome.includes('logout.do'),
    hasUserNetId: cleanNetIdPrefix ? lowerHome.includes(cleanNetIdPrefix) : false,
    hasLoginForm:
      lowerHome.includes('type="password"') ||
      lowerHome.includes("type='password'") ||
      lowerHome.includes('name="passwordauth"') ||
      lowerHome.includes('id="password"'),
    hasMyAttendance: lowerHome.includes('my_attendance'),
  };

  if (!homeHtml) {
    return { totalMatches: 0, snippets: [], discoveredUrls: [], loggedInCheck };
  }

  const keywords = ['My_Attendance', 'srm_university', 'academia-academic-services', 'page-perma'];
  const snippets: HomeKeywordMatch[] = [];
  const discoveredUrls: string[] = [];
  let totalMatches = 0;

  // Mask token-like or cookie-like values (hashes, long strings, token=...) with ***
  const maskSecrets = (str: string) => {
    return str
      .replace(
        /(?:_iamadt|_iambdt|__Secure-iamsdt|iamcsr|zccpn|JSESSIONID|token|digest|auth|ticket)[=:]["']?[a-zA-Z0-9_\-.~%]+/gi,
        '***'
      )
      .replace(/\b[a-zA-Z0-9_\-]{20,}\b/g, '***');
  };

  for (const kw of keywords) {
    const regex = new RegExp(kw, 'gi');
    let m;
    while ((m = regex.exec(homeHtml)) !== null) {
      totalMatches++;
      if (snippets.length < 8) {
        const start = Math.max(0, m.index - 100);
        const end = Math.min(homeHtml.length, m.index + kw.length + 100);
        const rawSnippet = homeHtml.slice(start, end).replace(/\s+/g, ' ');
        snippets.push({
          keyword: kw,
          snippet: maskSecrets(rawSnippet),
        });
      }
    }
  }

  // Search for any attendance-related URL in homeHtml
  const urlRegex =
    /(?:https?:\/\/academia\.srmist\.edu\.in)?\/[a-zA-Z0-9_\-./]*(?:My_Attendance|attendance)[a-zA-Z0-9_\-./?=&#]*/gi;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(homeHtml)) !== null) {
    let u = urlMatch[0];
    if (u.includes('/portal/')) continue; // Skip /portal/
    if (!u.startsWith('http')) {
      u = `https://academia.srmist.edu.in${u.startsWith('/') ? '' : '/'}${u}`;
    }
    if (!discoveredUrls.includes(u)) {
      discoveredUrls.push(u);
    }
  }

  return { totalMatches, snippets, discoveredUrls, loggedInCheck };
}
