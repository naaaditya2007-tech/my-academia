import axios from 'axios';
import querystring from 'querystring';
import { parseAttendanceAndMarksHtml, parseStudentProfileFromHtml } from './scraper';
import { Course, StudentProfile } from '@/types/campus';

export interface SRMAuthResult {
  success: boolean;
  portalType?: 'academia' | 'student_portal';
  jsessionId?: string;
  cookies?: string;
  attendanceHtml?: string;
  student?: StudentProfile;
  courses?: Course[];
  error?: string;
  technicalReason?: string;
  statusCode?: number;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/**
 * 1. SRM ACADEMIA (ZOHO IAM HANDSHAKE) - CAMPUS WEB 1-CLICK AUTH
 * Authenticates NetID (e.g. ab1234@srmist.edu.in) + Password via Zoho IAM without requiring CAPTCHA.
 */
export async function authenticateWithAcademia(
  netIdInput: string,
  passwordInput: string
): Promise<SRMAuthResult> {
  let cleanNetId = (netIdInput || '').trim();
  if (cleanNetId && !cleanNetId.includes('@')) {
    cleanNetId = `${cleanNetId}@srmist.edu.in`;
  }
  const password = (passwordInput || '').trim();

  if (!cleanNetId || !password) {
    return {
      success: false,
      statusCode: 400,
      error: 'Please enter both your SRM NetID and password.',
      technicalReason: 'Missing NetID or password payload',
    };
  }

  const signinPageUrl =
    'https://academia.srmist.edu.in/accounts/p/10002227248/signin?hide_fp=true&orgtype=40&service_language=&css_url=/49910842/academia-academic-services/downloadPortalCustomCss/login&dcc=true';

  try {
    // Step A: Initial GET to initialize Zoho IAM session & obtain iamcsr token
    const initRes = await fetch(signinPageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const initCookies = initRes.headers.getSetCookie
      ? initRes.headers.getSetCookie()
      : [initRes.headers.get('set-cookie') || ''];

    let cookieMap: Record<string, string> = {};
    const mergeCookies = (cList: string[]) => {
      cList.forEach((c) => {
        if (!c) return;
        const part = c.split(';')[0];
        const eqIdx = part.indexOf('=');
        if (eqIdx > 0) {
          const k = part.substring(0, eqIdx).trim();
          const v = part.substring(eqIdx + 1).trim();
          cookieMap[k] = v;
        }
      });
    };

    mergeCookies(initCookies);
    const iamcsr = cookieMap['iamcsr'] || '';

    const buildCookieHeader = () =>
      Object.entries(cookieMap)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

    // Step B: Lookup NetID against Zoho IAM
    const lookupUrl = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/lookup/${encodeURIComponent(cleanNetId)}`;
    const lookupBody = new URLSearchParams({
      mode: 'primary',
      cli_time: Date.now().toString(),
      orgtype: '40',
    });

    const lookupRes = await fetch(lookupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Cookie: buildCookieHeader(),
        'User-Agent': USER_AGENT,
        Origin: 'https://academia.srmist.edu.in',
        Referer: signinPageUrl,
        'X-ZCSRF-TOKEN': iamcsr ? `iamcsrcoo=${iamcsr}` : '',
      },
      body: lookupBody.toString(),
    });

    if (lookupRes.headers.getSetCookie) {
      mergeCookies(lookupRes.headers.getSetCookie());
    }

    const lookupData: any = await lookupRes.json().catch(() => ({}));

    if (lookupData.code === 'U100' || lookupData.message?.includes('does not exist')) {
      return {
        success: false,
        statusCode: 404,
        error: 'Invalid NetID. Account does not exist on SRM Academia.',
        technicalReason: `Zoho IAM lookup returned U100: ${lookupData.message || 'User does not exist'}`,
      };
    }

    if (lookupData.code !== 'U200' || !lookupData.lookup?.identifier) {
      return {
        success: false,
        statusCode: 400,
        error: 'Zoho IAM validation failed for this NetID.',
        technicalReason: `Zoho lookup status ${lookupData.status_code || lookupRes.status}: ${lookupData.message || 'Unknown error'}`,
      };
    }

    const zuid = lookupData.lookup.identifier;
    const digest = lookupData.lookup.digest || '';

    // Step C: Submit Password to Zoho IAM
    const signinParams = `cli_time=${Date.now()}&orgtype=40`;
    const passwordUrl = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/primary/${zuid}/password?digest=${digest}&${signinParams}`;

    const passRes = await fetch(passwordUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Cookie: buildCookieHeader(),
        'User-Agent': USER_AGENT,
        Origin: 'https://academia.srmist.edu.in',
        Referer: signinPageUrl,
        'X-ZCSRF-TOKEN': iamcsr ? `iamcsrcoo=${iamcsr}` : '',
      },
      body: JSON.stringify({
        passwordauth: {
          password: password,
        },
      }),
    });

    if (passRes.headers.getSetCookie) {
      mergeCookies(passRes.headers.getSetCookie());
    }

    const passData: any = await passRes.json().catch(() => ({}));

    // Check for password mismatch
    if (
      passData.status_code === 500 ||
      passData.errors?.[0]?.code === 'IN102' ||
      passData.message === 'Invalid password'
    ) {
      return {
        success: false,
        statusCode: 401,
        error: `Incorrect password for ${cleanNetId}. Please try again.`,
        technicalReason: passData.localized_message || passData.message || 'Wrong password in Zoho IAM',
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
        statusCode: 401,
        error: 'SRM Academia authentication failed.',
        technicalReason: passData.localized_message || passData.message || `Zoho returned code: ${passData.code}`,
      };
    }

    // Step D: Follow redirect_uri to establish portal session
    const redirectUri =
      passData.passwordauth?.redirect_uri ||
      'https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin';

    let portalHtml = '';
    try {
      const redirectRes = await fetch(redirectUri, {
        headers: {
          Cookie: buildCookieHeader(),
          'User-Agent': USER_AGENT,
        },
        redirect: 'follow',
      });

      if (redirectRes.headers.getSetCookie) {
        mergeCookies(redirectRes.headers.getSetCookie());
      }
      portalHtml = await redirectRes.text();

      // Fetch Attendance Page (My_Attendance)
      const academiaAttendanceUrls = [
        'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance',
        'https://academia.srmist.edu.in/liveViewHeader.do?sharedBy=srm_university&appLinkName=academia-academic-services&viewLinkName=My_Attendance',
        'https://academia.srmist.edu.in/portal/academia-academic-services/page/My_Attendance',
      ];

      for (const attUrl of academiaAttendanceUrls) {
        try {
          const attRes = await fetch(attUrl, {
            headers: {
              Cookie: buildCookieHeader(),
              'User-Agent': USER_AGENT,
              'X-Requested-With': 'XMLHttpRequest',
              Referer: 'https://academia.srmist.edu.in/',
              Accept: '*/*',
            },
          });
          if (attRes.ok) {
            const attText = await attRes.text();
            if (attText.length > 200) {
              portalHtml += '\n' + attText;
              break;
            }
          }
        } catch {}
      }

      // Fetch Timetable Page (My_Time_Table_2023_24) for Profile and Section Details
      const academiaTimetableUrls = [
        'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Time_Table_2023_24',
        'https://academia.srmist.edu.in/liveViewHeader.do?sharedBy=srm_university&appLinkName=academia-academic-services&viewLinkName=My_Time_Table_2023_24',
        'https://academia.srmist.edu.in/portal/academia-academic-services/page/My_Time_Table_2023_24',
      ];

      for (const ttUrl of academiaTimetableUrls) {
        try {
          const ttRes = await fetch(ttUrl, {
            headers: {
              Cookie: buildCookieHeader(),
              'User-Agent': USER_AGENT,
              'X-Requested-With': 'XMLHttpRequest',
              Referer: 'https://academia.srmist.edu.in/',
              Accept: '*/*',
            },
          });
          if (ttRes.ok) {
            const ttText = await ttRes.text();
            if (ttText.length > 200) {
              portalHtml += '\n' + ttText;
              break;
            }
          }
        } catch {}
      }
    } catch (e: any) {
      console.warn('[Academia] Error fetching subpage HTML:', e?.message || e);
    }

    // Step E: Parse courses and student profile
    const courses = parseAttendanceAndMarksHtml(portalHtml);
    const student = parseStudentProfileFromHtml(portalHtml, cleanNetId);

    return {
      success: true,
      portalType: 'academia',
      cookies: buildCookieHeader(),
      attendanceHtml: portalHtml,
      student,
      courses,
    };
  } catch (err: any) {
    return {
      success: false,
      statusCode: 500,
      error: 'Unable to communicate with SRM Academia Zoho portal.',
      technicalReason: err?.message || 'Network handshake failed',
    };
  }
}

/**
 * 2. LIVE JSESSIONID / COOKIE AUTHENTICATION (STUDENT PORTAL sp.srmist.edu.in)
 * Validates active JSESSIONID from browser and scrapes real courses, attendance, and timetable.
 */
export async function verifySRMSessionCookie(cookieInput: string): Promise<SRMAuthResult> {
  const rawInput = (cookieInput || '').trim();
  if (!rawInput) {
    return {
      success: false,
      statusCode: 400,
      error: 'Please provide your active SRM JSESSIONID.',
      technicalReason: 'Empty cookie input provided',
    };
  }

  // Extract clean JSESSIONID value
  let cleanCookieHeader = '';
  const jsessionMatch = rawInput.match(/JSESSIONID=([A-Za-z0-9\.\_\-]+)/i);
  if (jsessionMatch) {
    cleanCookieHeader = `JSESSIONID=${jsessionMatch[1]}`;
  } else if (/^[A-Za-z0-9\.\_\-]+$/.test(rawInput)) {
    cleanCookieHeader = `JSESSIONID=${rawInput}`;
  } else {
    cleanCookieHeader = rawInput;
  }

  try {
    const reportUrl =
      'https://sp.srmist.edu.in/srmiststudentportal/students/report/studentAttendanceDetails.jsp';

    const res = await axios.get(reportUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Cookie: cleanCookieHeader,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: 'https://sp.srmist.edu.in/srmiststudentportal/students/template/commonTemplate.jsp',
      },
      timeout: 10000,
      maxRedirects: 3,
      validateStatus: (status) => status < 500,
    });

    const html = res.data || '';

    // Check if session expired (sp.srmist.edu.in redirects back to youLogin.jsp on expired session)
    if (
      html.includes('youLogin.jsp') ||
      html.includes('LoginServlet') ||
      html.includes('Session Expired') ||
      html.includes('Invalid session') ||
      (!html.includes('Attendance') && !html.includes('Registration') && !html.includes('Course'))
    ) {
      return {
        success: false,
        statusCode: 401,
        error: 'SRM JSESSIONID expired or invalid.',
        technicalReason: 'Portal returned login screen or session expired message',
      };
    }

    const courses = parseAttendanceAndMarksHtml(html);
    const student = parseStudentProfileFromHtml(html);

    return {
      success: true,
      portalType: 'student_portal',
      jsessionId: cleanCookieHeader,
      cookies: cleanCookieHeader,
      attendanceHtml: html,
      student,
      courses,
    };
  } catch (err: any) {
    return {
      success: false,
      statusCode: 502,
      error: 'Unable to connect to SRM Student Portal (sp.srmist.edu.in).',
      technicalReason: err?.message || 'Network timeout or unreachable host',
    };
  }
}

/**
 * 3. STUDENT PORTAL (sp.srmist.edu.in) WITH CAPTCHA AUTHENTICATION
 */
export async function authenticateWithSRMPortal(
  usernameInput: string,
  passwordInput: string,
  captchaInput?: string,
  activeJsessionId?: string,
  domainField?: string,
  domainValue?: string,
  captchaField?: string,
  captchaValue?: string
): Promise<SRMAuthResult> {
  const cleanUsername = usernameInput.replace(/@srmist\.edu\.in$/i, '').trim();
  const password = passwordInput.trim();

  if (!cleanUsername || !password) {
    return {
      success: false,
      statusCode: 400,
      error: 'Please enter your Registration Number / NetID and password.',
      technicalReason: 'Missing credentials',
    };
  }

  try {
    let jsessionId = activeJsessionId || '';
    let captcha = captchaInput || '';
    let dField = domainField;
    let dVal = domainValue;
    let cField = captchaField;
    let cVal = captchaValue;

    // If session/tokens not supplied, fetch initial tokens
    if (!jsessionId || !captcha || !dField) {
      const pageUrl = 'https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp';
      const pageRes = await axios.get(pageUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 9000,
      });

      const setCookieHeaders = pageRes.headers['set-cookie'] || [];
      for (const c of setCookieHeaders) {
        if (c.startsWith('JSESSIONID=')) {
          jsessionId = c.split(';')[0];
          break;
        }
      }

      const html = pageRes.data || '';
      const captchaMatch = html.match(/captchaText\s*=\s*['"]([^'"]+)['"]/);
      const domainFieldMatch = html.match(/domainFieldName\s*=\s*['"]([^'"]+)['"]/);
      const captchaFieldMatch = html.match(/captchaFieldName\s*=\s*['"]([^'"]+)['"]/);
      const delimiterMatch = html.match(/randomDelimiter\s*=\s*['"]([^'"]+)['"]/);

      if (!captcha) captcha = captchaMatch?.[1] || '';
      dField = domainFieldMatch?.[1] || 'dtoken_default';
      cField = captchaFieldMatch?.[1] || 'cptoken_default';
      const delimiter = delimiterMatch?.[1] || '';

      const reversedHost = 'sp.srmist.edu.in'.split('').reverse().join('');
      dVal = Buffer.from(reversedHost).toString('base64');
      cVal = Buffer.from(`3${delimiter}16`).toString('base64');
    }

    const postPayload: Record<string, string> = {
      username: cleanUsername,
      password: password,
      captcha: captcha,
    };
    if (dField && dVal) postPayload[dField] = dVal;
    if (cField && cVal) postPayload[cField] = cVal;

    const postData = querystring.stringify(postPayload);

    const loginUrl = 'https://sp.srmist.edu.in/srmiststudentportal/LoginServlet';
    const loginRes = await axios.post(loginUrl, postData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        Cookie: jsessionId,
        'User-Agent': USER_AGENT,
        Referer: 'https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp',
      },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const responseHtml = typeof loginRes.data === 'string' ? loginRes.data : '';
    if (
      responseHtml.includes('Invalid credentials') ||
      responseHtml.includes('Invalid Captcha') ||
      responseHtml.includes('User does not exist') ||
      responseHtml.includes('youLogin.jsp')
    ) {
      let specificReason = 'Invalid credentials or wrong password';
      if (responseHtml.includes('Invalid Captcha')) specificReason = 'SRM Portal rejected CAPTCHA';
      return {
        success: false,
        statusCode: 401,
        error: 'Invalid NetID or Password on SRM Student Portal.',
        technicalReason: specificReason,
      };
    }

    return await verifySRMSessionCookie(jsessionId);
  } catch (err: any) {
    return {
      success: false,
      statusCode: 500,
      error: 'Unable to connect to SRM Student Portal.',
      technicalReason: err?.message || 'Handshake failed',
    };
  }
}
