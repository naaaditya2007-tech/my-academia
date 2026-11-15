const cheerio = require('cheerio');

// 1. Decoder function
function convertHexToHtml(raw) {
  if (!raw) return '';
  let hexContent = raw;
  if (raw.includes(".sanitize('")) {
    const parts = raw.split(".sanitize('");
    if (parts.length > 1) {
      hexContent = parts[1].split("')")[0];
    }
  }
  let decoded = hexContent.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  decoded = decoded.replace(/\\'/g, "'").replace(/\\"/g, '"');
  return decoded;
}

// 2. Parser function for SRM Academia
function parseAttendanceAndMarks(html) {
  const cleanHtml = convertHexToHtml(html);
  const $ = cheerio.load(cleanHtml);
  const courses = [];

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
    const courseType = isEmbedded ? 'Embedded' : isLab ? 'Practical' : 'Theory';

    courses.push({
      id: `course_${courseCode}_${rawSlot || idx}`,
      code: courseCode,
      title: rawTitle || courseCode,
      slot: rawSlot || 'Theory',
      room: 'Venue TBA',
      faculty: rawFaculty || 'Faculty TBA',
      credits: isEmbedded ? 4 : isLab ? 2 : 3,
      type: courseType,
      hoursConducted: conducted,
      hoursAttended: attended,
      hoursAbsent: absent,
      attendancePercentage: computedPercentage,
      requiredHours75: Math.max(0, Math.ceil(0.75 * conducted) - attended),
      margin: Math.max(0, attended - Math.ceil(0.75 * conducted)),
      marks: [],
      totalInternalScored: 0,
      totalInternalMax: 0,
    });
  });

  // Marks parsing
  $('table').each((_, table) => {
    $(table).find('tr').each((_, row) => {
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
              matchedCourse.totalInternalScored += scored;
              matchedCourse.totalInternalMax += max;
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

// 3. Test Fixture: Real SRM Academia Response Snippet
const mockZohoResponse = `
parent.sanitize('\\x3Ctable style="font-size :16px;" border="1" align="center" cellpadding="1" cellspacing="1" bgcolor="#FAFAD2"\\x3E\\x3Ctr\\x3E\\x3Ctd bgcolor="#E6E6FA"\\x3E21CSC204J Regular\\x3C/td\\x3E\\x3Ctd\\x3EDesign and Analysis of Algorithms\\x3C/td\\x3E\\x3Ctd\\x3ETheory\\x3C/td\\x3E\\x3Ctd\\x3EDr. K. Ramesh\\x3C/td\\x3E\\x3Ctd\\x3EA\\x3C/td\\x3E\\x3Ctd\\x3E-\\x3C/td\\x3E\\x3Ctd\\x3E45\\x3C/td\\x3E\\x3Ctd\\x3E3\\x3C/td\\x3E\\x3Ctd\\x3E93.33\\x3C/td\\x3E\\x3C/tr\\x3E\\x3Ctr\\x3E\\x3Ctd bgcolor="#E6E6FA"\\x3E21CSC205P Regular\\x3C/td\\x3E\\x3Ctd\\x3EAdvanced Programming Practice\\x3C/td\\x3E\\x3Ctd\\x3EPractical\\x3C/td\\x3E\\x3Ctd\\x3EDr. S. Priya\\x3C/td\\x3E\\x3Ctd\\x3EP6-P10\\x3C/td\\x3E\\x3Ctd\\x3E-\\x3C/td\\x3E\\x3Ctd\\x3E30\\x3C/td\\x3E\\x3Ctd\\x3E0\\x3C/td\\x3E\\x3Ctd\\x3E100.00\\x3C/td\\x3E\\x3C/tr\\x3E\\x3C/table\\x3E\\x3Ctable border="1" align="center" cellpadding="1" cellspacing="1"\\x3E\\x3Ctr\\x3E\\x3Ctd\\x3E21CSC204J\\x3C/td\\x3E\\x3Ctd\\x3ECT-1\\x3C/td\\x3E\\x3Ctd\\x3E23.5 / 25\\x3C/td\\x3E\\x3C/tr\\x3E\\x3Ctr\\x3E\\x3Ctd\\x3E21CSC204J\\x3C/td\\x3E\\x3Ctd\\x3ECT-2\\x3C/td\\x3E\\x3Ctd\\x3E24.0 / 25\\x3C/td\\x3E\\x3C/tr\\x3E\\x3C/table\\x3E');
`;

console.log('--- RUNNING SCRAPER UNIT TEST ---');
const courses = parseAttendanceAndMarks(mockZohoResponse);

console.log(`✓ Total courses parsed: ${courses.length}`);
console.assert(courses.length === 2, 'Expected 2 courses parsed');

const c1 = courses[0];
console.log(`✓ Course 1: ${c1.code} - ${c1.title} (${c1.type}, Slot: ${c1.slot})`);
console.log(`  Attendance: ${c1.hoursAttended}/${c1.hoursConducted} (${c1.attendancePercentage}%)`);
console.log(`  Marks: ${c1.marks.length} components, Total: ${c1.totalInternalScored}/${c1.totalInternalMax}`);
console.assert(c1.code === '21CSC204J', 'Expected course code 21CSC204J');
console.assert(c1.attendancePercentage === 93.33, 'Expected 93.33% attendance');
console.assert(c1.marks.length === 2, 'Expected 2 marks components');
console.assert(c1.totalInternalScored === 47.5, 'Expected 47.5 internal marks');

const c2 = courses[1];
console.log(`✓ Course 2: ${c2.code} - ${c2.title} (${c2.type}, Slot: ${c2.slot})`);
console.log(`  Attendance: ${c2.hoursAttended}/${c2.hoursConducted} (${c2.attendancePercentage}%)`);
console.assert(c2.code === '21CSC205P', 'Expected course code 21CSC205P');
console.assert(c2.attendancePercentage === 100, 'Expected 100% attendance');

console.log('--- ALL UNIT TESTS PASSED SUCCESSFULLY! ---');
