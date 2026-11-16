const cheerio = require('cheerio');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  updateFromHeaders(headers) {
    if (!headers) return;
    let list = [];
    if (typeof headers.getSetCookie === 'function') {
      list = headers.getSetCookie();
    } else if (typeof headers.get === 'function') {
      const s = headers.get('set-cookie');
      if (s) list = [s];
    } else if (Array.isArray(headers['set-cookie'])) {
      list = headers['set-cookie'];
    } else if (typeof headers['set-cookie'] === 'string') {
      list = [headers['set-cookie']];
    }

    for (const str of list) {
      if (!str) continue;
      const part = str.split(';')[0].trim();
      const idx = part.indexOf('=');
      if (idx > 0) {
        const k = part.slice(0, idx).trim();
        const v = part.slice(idx + 1).trim();
        if (v && v !== 'delete' && v !== '""' && v !== 'deleted') {
          this.cookies.set(k, v);
        }
      }
    }
  }

  set(k, v) {
    this.cookies.set(k, v);
  }

  get(k) {
    return this.cookies.get(k);
  }

  has(k) {
    return this.cookies.has(k);
  }

  keys() {
    return Array.from(this.cookies.keys());
  }

  toHeaderString() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  loadFromString(headerStr) {
    if (!headerStr) return;
    const parts = headerStr.split(';');
    for (const p of parts) {
      const idx = p.indexOf('=');
      if (idx > 0) {
        const k = p.slice(0, idx).trim();
        const v = p.slice(idx + 1).trim();
        if (v && v !== 'delete' && v !== '""' && v !== 'deleted') {
          this.cookies.set(k, v);
        }
      }
    }
  }
}

function decodeZohoHtml(raw) {
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

/**
 * Step 1: verifyUser
 */
async function verifyUser(username) {
  let cleanNetId = (username || '').trim();
  if (cleanNetId && !cleanNetId.includes('@')) {
    cleanNetId = `${cleanNetId}@srmist.edu.in`;
  }

  if (!cleanNetId) {
    return {
      success: false,
      identifier: '',
      digest: '',
      error: 'Username is required',
    };
  }

  const signinPageUrl =
    'https://academia.srmist.edu.in/accounts/p/10002227248/signin?hide_fp=true&orgtype=40&service_language=&css_url=/49910842/academia-academic-services/downloadPortalCustomCss/login&dcc=true';

  const jar = new CookieJar();

  try {
    const initRes = await fetch(signinPageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    jar.updateFromHeaders(initRes.headers);
    const iamcsr = jar.get('iamcsr') || '';

    if (!iamcsr) {
      return {
        success: false,
        identifier: '',
        digest: '',
        error: `Failed to initialize session with Zoho IAM (Status: ${initRes.status})`,
      };
    }

    const lookupUrl = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/lookup/${encodeURIComponent(cleanNetId)}`;
    const lookupBody = new URLSearchParams({
      mode: 'primary',
      cli_time: Date.now().toString(),
      orgtype: '40',
      serviceurl: 'https://academia.srmist.edu.in/',
    });

    const lookupRes = await fetch(lookupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Cookie: jar.toHeaderString(),
        'X-ZCSRF-TOKEN': `iamcsrcoo=${iamcsr}`,
        Origin: 'https://academia.srmist.edu.in',
        Referer: signinPageUrl,
      },
      body: lookupBody.toString(),
    });

    jar.updateFromHeaders(lookupRes.headers);
    const lookupData = await lookupRes.json().catch(() => ({}));

    if (lookupData.code === 'U100' || lookupData.message?.includes('does not exist')) {
      return {
        success: false,
        identifier: '',
        digest: '',
        code: 'U100',
        message: 'Account does not exist on SRM Academia',
        error: 'Invalid NetID or Account does not exist',
      };
    }

    if (lookupData.code !== 'U200' || !lookupData.lookup?.identifier) {
      return {
        success: false,
        identifier: '',
        digest: '',
        code: lookupData.code,
        message: lookupData.message,
        error: lookupData.message || 'Zoho IAM validation failed',
      };
    }

    return {
      success: true,
      identifier: lookupData.lookup.identifier,
      digest: lookupData.lookup.digest || '',
      data: lookupData,
      cookies: jar.toHeaderString(),
    };
  } catch (err) {
    return {
      success: false,
      identifier: '',
      digest: '',
      error: err.message || 'Network error during user verification',
    };
  }
}

/**
 * Step 2: verifyPassword
 */
async function verifyPassword(options) {
  const { digest, identifier, password, cookies: initialCookies } = options || {};
  if (!identifier || !password) {
    return {
      success: false,
      isAuthenticated: false,
      cookies: '',
      error: 'Identifier and password are required',
    };
  }

  const jar = new CookieJar();
  if (initialCookies) {
    jar.loadFromString(initialCookies);
  }

  const signinPageUrl =
    'https://academia.srmist.edu.in/accounts/p/10002227248/signin?hide_fp=true&orgtype=40&service_language=&css_url=/49910842/academia-academic-services/downloadPortalCustomCss/login&dcc=true';

  try {
    if (!jar.get('iamcsr')) {
      const initRes = await fetch(signinPageUrl, {
        headers: { 'User-Agent': USER_AGENT },
      });
      jar.updateFromHeaders(initRes.headers);
    }

    const iamcsr = jar.get('iamcsr') || '';
    const signinParams = `digest=${digest || ''}&cli_time=${Date.now()}&orgtype=40&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2F`;
    const passwordUrl = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/primary/${identifier}/password?${signinParams}`;

    const passRes = await fetch(passwordUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Cookie: jar.toHeaderString(),
        'X-ZCSRF-TOKEN': `iamcsrcoo=${iamcsr}`,
        Origin: 'https://academia.srmist.edu.in',
        Referer: signinPageUrl,
      },
      body: JSON.stringify({
        passwordauth: {
          password: password,
        },
      }),
    });

    jar.updateFromHeaders(passRes.headers);
    const passData = await passRes.json().catch(() => ({}));

    if (
      passData.status_code === 500 ||
      passData.errors?.[0]?.code === 'IN102' ||
      passData.message === 'Invalid password'
    ) {
      return {
        success: false,
        isAuthenticated: false,
        cookies: '',
        error: 'Incorrect password for SRM Academia.',
        technicalReason: passData.localized_message || passData.message || 'IN102 Invalid password',
      };
    }

    const isSuccess =
      passData.code === 'SI200' ||
      passData.code === 'SI302' ||
      passData.code === 'SI300' ||
      passData.status_code === 200 ||
      Boolean(passData.passwordauth?.redirect_uri);

    if (!isSuccess) {
      return {
        success: false,
        isAuthenticated: false,
        cookies: '',
        error: passData.localized_message || passData.message || 'Authentication rejected by Zoho IAM',
        technicalReason: `Zoho code: ${passData.code || passRes.status}`,
      };
    }

    // Follow redirect_uri hops to acquire session cookies
    const initialRedirectUri =
      passData.passwordauth?.redirect_uri ||
      'https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin';

    let currentUrl = initialRedirectUri;
    let hops = 0;

    while (currentUrl && hops < 8) {
      hops++;
      try {
        const hopRes = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            Cookie: jar.toHeaderString(),
            'User-Agent': USER_AGENT,
          },
        });

        jar.updateFromHeaders(hopRes.headers);

        if ([301, 302, 303, 307, 308].includes(hopRes.status)) {
          const loc = hopRes.headers.get('location');
          if (!loc) break;
          if (loc.startsWith('http')) {
            currentUrl = loc;
          } else {
            currentUrl = new URL(loc, currentUrl).toString();
          }
        } else {
          break;
        }
      } catch (err) {
        break;
      }
    }

    // Lock in session at base domain
    try {
      const finalRes = await fetch('https://academia.srmist.edu.in/', {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Cookie: jar.toHeaderString(),
          'User-Agent': USER_AGENT,
        },
      });
      jar.updateFromHeaders(finalRes.headers);
    } catch {}

    const cookieString = jar.toHeaderString();

    return {
      success: true,
      isAuthenticated: true,
      cookies: cookieString,
      data: {
        cookies: cookieString,
        redirectUri: passData.passwordauth?.redirect_uri,
      },
    };
  } catch (err) {
    return {
      success: false,
      isAuthenticated: false,
      cookies: '',
      error: err.message || 'Network error during password verification',
    };
  }
}

/**
 * Fetch raw HTML views with full cookie set
 */
async function fetchPortalView(cookies, viewName) {
  const jar = new CookieJar();
  jar.loadFromString(cookies);

  const urls = [
    `https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/${viewName}`,
    `https://academia.srmist.edu.in/liveViewHeader.do?sharedBy=srm_university&appLinkName=academia-academic-services&viewLinkName=${viewName}`,
    `https://creatorexport.zoho.com/exportPermaViewHeader.do?sharedBy=srm_university&appLinkName=academia-academic-services&viewLinkName=${viewName}`,
    `https://academia.srmist.edu.in/portal/academia-academic-services/view-embed/${viewName}`,
  ];

  let combinedHtml = '';

  for (const u of urls) {
    try {
      const res = await fetch(u, {
        method: 'GET',
        headers: {
          Cookie: jar.toHeaderString(),
          'User-Agent': USER_AGENT,
          Accept: '*/*',
          Referer: 'https://academia.srmist.edu.in/',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      jar.updateFromHeaders(res.headers);
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 50) {
          combinedHtml += '\n' + text;
        }
      }
    } catch {}
  }

  return decodeZohoHtml(combinedHtml);
}

/**
 * Step 3: getAttendance
 */
async function getAttendance(cookies) {
  const html = await fetchPortalView(cookies, 'My_Attendance');
  if (!html) return [];

  const $ = cheerio.load(html);
  const courses = [];
  const seenCodes = new Set();

  $('table').each((_, table) => {
    const $table = $(table);
    const headers = [];
    $table.find('tr').first().find('th, td').each((_, cell) => {
      headers.push($(cell).text().trim().toLowerCase());
    });

    const hasCourseCode = headers.some((h) => h.includes('course code') || h.includes('subcode') || h === 'code');
    const hasAttendance = headers.some(
      (h) => h.includes('hours') || h.includes('conducted') || h.includes('attended') || h.includes('attendance %') || h.includes('%')
    );

    if (hasCourseCode || hasAttendance) {
      $table.find('tr').slice(1).each((_, row) => {
        const cells = [];
        $(row).find('td').each((_, c) => {
          cells.push($(c).text().trim());
        });

        if (cells.length >= 4) {
          let code = '';
          let title = '';
          let conducted = 0;
          let attended = 0;
          let absent = 0;
          let percentage = 0;
          let category = 'Course';
          let faculty = 'Faculty Member';
          let slot = 'A';
          let room = '';

          for (let i = 0; i < cells.length; i++) {
            const h = headers[i] || '';
            const val = cells[i];

            if (h.includes('code') || (!code && /^[A-Z0-9]{5,10}$/i.test(val) && !/^\d+$/.test(val))) {
              code = val.toUpperCase();
            } else if (h.includes('title') || h.includes('desc') || h.includes('name')) {
              title = val;
            } else if (h.includes('conducted') || h.includes('max hours')) {
              conducted = parseInt(val, 10) || 0;
            } else if (h.includes('attended') || h.includes('att. hours')) {
              attended = parseInt(val, 10) || 0;
            } else if (h.includes('absent')) {
              absent = parseInt(val, 10) || 0;
            } else if (h.includes('%') || h.includes('percent')) {
              percentage = parseFloat(val) || 0;
            } else if (h.includes('faculty') || h.includes('staff')) {
              faculty = val;
            } else if (h.includes('slot')) {
              slot = val;
            } else if (h.includes('room')) {
              room = val;
            } else if (h.includes('category') || h.includes('type')) {
              category = val;
            }
          }

          if (code && !seenCodes.has(code)) {
            seenCodes.add(code);
            if (!absent && conducted >= attended) {
              absent = conducted - attended;
            }
            if (!percentage && conducted > 0) {
              percentage = Math.round((attended / conducted) * 10000) / 100;
            }

            courses.push({
              code,
              title: title || code,
              category,
              faculty,
              slot,
              room,
              conducted,
              attended,
              absent,
              percentage,
              courseCode: code,
              courseTitle: title || code,
              hoursConducted: conducted,
              hoursAttended: attended,
              hoursAbsent: absent,
              attendancePercentage: percentage,
              type: code.endsWith('J') ? 'integrated' : code.endsWith('P') ? 'practical' : 'theory',
            });
          }
        }
      });
    }
  });

  return courses;
}

/**
 * Step 4: getMarks
 */
async function getMarks(cookies) {
  const html = await fetchPortalView(cookies, 'My_Attendance');
  const marksHtml = (await fetchPortalView(cookies, 'My_Internal_Marks')) || '';
  const combined = html + '\n' + marksHtml;

  const $ = cheerio.load(combined);
  const marksMap = {};

  $('table').each((_, table) => {
    const $table = $(table);
    const headers = [];
    $table.find('tr').first().find('th, td').each((_, cell) => {
      headers.push($(cell).text().trim().toLowerCase());
    });

    const isMarksTable = headers.some((h) => h.includes('mark') || h.includes('test') || h.includes('cla'));
    if (isMarksTable) {
      $table.find('tr').slice(1).each((_, row) => {
        const cells = [];
        $(row).find('td').each((_, c) => {
          cells.push($(c).text().trim());
        });

        const codeCell = cells.find((c) => /^[A-Z0-9]{5,10}$/i.test(c) && !/^\d+$/.test(c));
        if (codeCell) {
          const code = codeCell.toUpperCase();
          if (!marksMap[code]) marksMap[code] = [];

          // Collect marks columns
          for (let i = 0; i < cells.length; i++) {
            const h = headers[i] || '';
            const num = parseFloat(cells[i]);
            if ((h.includes('cla') || h.includes('test') || h.includes('assignment')) && !isNaN(num)) {
              marksMap[code].push({
                title: h.toUpperCase(),
                score: num,
                maxScore: 100,
              });
            }
          }
        }
      });
    }
  });

  return marksMap;
}

/**
 * Step 5: getTimetable
 */
async function getTimetable(cookies) {
  const html24 = (await fetchPortalView(cookies, 'My_Time_Table_2024_25')) || '';
  const html23 = (await fetchPortalView(cookies, 'My_Time_Table_2023_24')) || '';
  const htmlGeneral = (await fetchPortalView(cookies, 'My_Time_Table')) || '';
  const combined = html24 + '\n' + html23 + '\n' + htmlGeneral;

  const $ = cheerio.load(combined);
  const schedule = [];
  const matrix = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };

  $('table').each((_, table) => {
    $(table).find('tr').each((_, row) => {
      const cells = [];
      $(row).find('th, td').each((_, c) => {
        cells.push($(c).text().trim());
      });

      const dayMatch = cells[0]?.match(/day\s*([1-5])/i);
      if (dayMatch) {
        const dayOrder = parseInt(dayMatch[1], 10);
        for (let h = 1; h < cells.length && h <= 10; h++) {
          const slotText = cells[h];
          if (slotText && slotText !== '-' && slotText.length > 2) {
            matrix[dayOrder][h] = slotText;
            schedule.push({
              dayOrder,
              hour: h,
              courseCode: slotText.split('-')[0].trim().toUpperCase(),
              room: slotText.split('-')[1]?.trim(),
            });
          }
        }
      }
    });
  });

  return { schedule, dayOrderMatrix: matrix };
}

/**
 * Step 6: getCourse
 */
async function getCourse(cookies) {
  return getAttendance(cookies);
}

/**
 * Step 7: getUserInfo
 */
async function getUserInfo(cookies) {
  const html = await fetchPortalView(cookies, 'My_Attendance');
  const infoHtml = (await fetchPortalView(cookies, 'Student_Information')) || '';
  const combined = html + '\n' + infoHtml;

  const $ = cheerio.load(combined);

  let name = '';
  let regNumber = '';
  let department = 'Computer Science and Engineering';
  let program = 'B.Tech.';
  let semester = 4;
  let section = 'A';
  let batch = '2024 - 2028';

  const regMatch = combined.match(/\b(RA\d{11,15})\b/i);
  if (regMatch) {
    regNumber = regMatch[1].toUpperCase();
  }

  $('table tr, div').each((_, el) => {
    const text = $(el).text().trim();
    if (!name && /name\s*[:\-]/i.test(text)) {
      const m = text.match(/name\s*[:\-]\s*([A-Za-z\s\.]+)/i);
      if (m && m[1].length > 2 && !m[1].toLowerCase().includes('srm')) {
        name = m[1].trim();
      }
    }
    if (!department && /dept|department\s*[:\-]/i.test(text)) {
      const m = text.match(/(?:dept|department)\s*[:\-]\s*([A-Za-z\s]+)/i);
      if (m) department = m[1].trim();
    }
    if (/sem|semester\s*[:\-]/i.test(text)) {
      const m = text.match(/(?:sem|semester)\s*[:\-]\s*(\d+)/i);
      if (m) semester = parseInt(m[1], 10);
    }
    if (/section\s*[:\-]/i.test(text)) {
      const m = text.match(/section\s*[:\-]\s*([A-Za-z0-9]+)/i);
      if (m) section = m[1].trim();
    }
  });

  return {
    name: name || 'Student',
    regNumber: regNumber || '',
    department,
    program,
    semester,
    section,
    batch,
    institution: 'SRM Institute of Science and Technology',
  };
}

/**
 * Step 8: getCalendar
 */
async function getCalendar() {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const holidaysMap = {
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

  const calendar = [];
  let currentDO = 1;
  let workingDayCounter = 1;

  const startDate = new Date(2026, 6, 21);
  const endDate = new Date(2026, 10, 30);

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

    let holidayReason = undefined;
    if (specificHoliday) {
      holidayReason = specificHoliday;
    } else if (isSunday) {
      holidayReason = 'Sunday';
    } else if (isSaturday) {
      holidayReason = 'Saturday';
    }

    let assignedDO = null;
    let workDayNo = undefined;

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
      isHoliday: Boolean(isHoliday || isPastLastWorkingDay),
      holidayReason: isPastLastWorkingDay && !holidayReason ? 'Semester Exam Window' : holidayReason,
      workingDayNumber: workDayNo,
    });

    cur.setDate(cur.getDate() + 1);
  }

  return calendar;
}

module.exports = {
  verifyUser,
  verifyPassword,
  getAttendance,
  getMarks,
  getTimetable,
  getCourse,
  getUserInfo,
  getCalendar,
};
