import { parseAttendanceAndMarksHtml, parseStudentProfileFromHtml } from './scraper';
import { Course, StudentProfile } from '@/types/campus';

export interface SRMAuthResult {
  success: boolean;
  portalType?: 'academia';
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
 * SRM ACADEMIA (ZOHO IAM HANDSHAKE) - CAMPUS WEB 1-CLICK AUTH
 * Authenticates NetID (e.g. an1328@srmist.edu.in) + Password via Zoho IAM without requiring CAPTCHA.
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
      serviceurl: 'https://academia.srmist.edu.in/',
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
        'https://academia.srmist.edu.in/liveViewHeader.do?sharedBy=srm_university&appLinkName=academia-academic-services&viewLinkName=My_Attendance',
        'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance',
        'https://academia.srmist.edu.in/portal/academia-academic-services/page/My_Attendance',
      ];

      for (const attUrl of academiaAttendanceUrls) {
        try {
          const attRes = await fetch(attUrl, {
            headers: {
              Cookie: buildCookieHeader(),
              'User-Agent': USER_AGENT,
              'X-Requested-With': 'XMLHttpRequest',
              Referer: 'https://academia.srmist.edu.in/portal/academia-academic-services',
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
        'https://academia.srmist.edu.in/liveViewHeader.do?sharedBy=srm_university&appLinkName=academia-academic-services&viewLinkName=My_Time_Table_2023_24',
        'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Time_Table_2023_24',
        'https://academia.srmist.edu.in/portal/academia-academic-services/page/My_Time_Table_2023_24',
      ];

      for (const ttUrl of academiaTimetableUrls) {
        try {
          const ttRes = await fetch(ttUrl, {
            headers: {
              Cookie: buildCookieHeader(),
              'User-Agent': USER_AGENT,
              'X-Requested-With': 'XMLHttpRequest',
              Referer: 'https://academia.srmist.edu.in/portal/academia-academic-services',
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
