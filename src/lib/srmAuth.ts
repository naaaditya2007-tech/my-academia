import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
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
 * Uses a stateful tough-cookie jar wrapped with axios to preserve session cookies across redirects.
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
    const jar = new CookieJar();
    const client = wrapper(
      axios.create({
        jar,
        headers: {
          'User-Agent': USER_AGENT,
        },
        timeout: 20000,
      })
    );

    // Step A: Initial GET to initialize Zoho IAM session & obtain iamcsr token
    await client.get(signinPageUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const cookies = await jar.getCookies('https://academia.srmist.edu.in');
    const iamcsr = cookies.find((c) => c.key === 'iamcsr')?.value || '';

    // Step B: Lookup NetID against Zoho IAM
    const lookupUrl = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/lookup/${encodeURIComponent(cleanNetId)}`;
    const lookupBody = new URLSearchParams({
      mode: 'primary',
      cli_time: Date.now().toString(),
      orgtype: '40',
      serviceurl: 'https://academia.srmist.edu.in/',
    });

    const lookupRes = await client.post(lookupUrl, lookupBody.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-ZCSRF-TOKEN': iamcsr ? `iamcsrcoo=${iamcsr}` : '',
        Origin: 'https://academia.srmist.edu.in',
        Referer: signinPageUrl,
      },
      validateStatus: () => true,
    });

    const lookupData = lookupRes.data || {};

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
    const signinParams = `digest=${digest}&cli_time=${Date.now()}&orgtype=40&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2F`;
    const passwordUrl = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/primary/${zuid}/password?${signinParams}`;

    const passRes = await client.post(
      passwordUrl,
      {
        passwordauth: {
          password: password,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'X-ZCSRF-TOKEN': iamcsr ? `iamcsrcoo=${iamcsr}` : '',
          Origin: 'https://academia.srmist.edu.in',
          Referer: signinPageUrl,
        },
        validateStatus: () => true,
      }
    );

    const passData = passRes.data || {};

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

    // Step D: Follow redirect_uri to establish portal session in cookie jar
    const redirectUri =
      passData.passwordauth?.redirect_uri ||
      'https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin';

    let portalHtml = '';
    try {
      const redirectRes = await client.get(redirectUri, {
        maxRedirects: 10,
        validateStatus: () => true,
      });

      portalHtml = typeof redirectRes.data === 'string' ? redirectRes.data : '';

      // Discover active semester views dynamically from navigation HTML if possible
      const attendanceViews = [
        'My_Attendance',
      ];
      const matchAtt = portalHtml.match(/viewLinkName=(My_Attendance[^"&'\s]*)/i);
      if (matchAtt?.[1] && !attendanceViews.includes(matchAtt[1])) {
        attendanceViews.unshift(matchAtt[1]);
      }

      for (const viewName of attendanceViews) {
        try {
          const attRes = await client.get(`https://academia.srmist.edu.in/liveViewHeader.do`, {
            params: {
              sharedBy: 'srm_university',
              appLinkName: 'academia-academic-services',
              viewLinkName: viewName,
            },
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              Referer: 'https://academia.srmist.edu.in/portal/academia-academic-services',
              Accept: '*/*',
            },
            validateStatus: () => true,
          });

          const attText = typeof attRes.data === 'string' ? attRes.data : JSON.stringify(attRes.data);
          if (attText.length > 200) {
            portalHtml += '\n' + attText;
            break;
          }
        } catch {}
      }

      // Fetch Timetable Page for Profile and Section Details
      const timetableViews = [
        'My_Time_Table_2023_24',
        'My_Time_Table_2024_25',
        'My_Time_Table',
      ];
      const matchTt = portalHtml.match(/viewLinkName=(My_Time_Table[^"&'\s]*)/i);
      if (matchTt?.[1] && !timetableViews.includes(matchTt[1])) {
        timetableViews.unshift(matchTt[1]);
      }

      for (const viewName of timetableViews) {
        try {
          const ttRes = await client.get(`https://academia.srmist.edu.in/liveViewHeader.do`, {
            params: {
              sharedBy: 'srm_university',
              appLinkName: 'academia-academic-services',
              viewLinkName: viewName,
            },
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              Referer: 'https://academia.srmist.edu.in/portal/academia-academic-services',
              Accept: '*/*',
            },
            validateStatus: () => true,
          });

          const ttText = typeof ttRes.data === 'string' ? ttRes.data : JSON.stringify(ttRes.data);
          if (ttText.length > 200) {
            portalHtml += '\n' + ttText;
            break;
          }
        } catch {}
      }
    } catch (e: any) {
      console.warn('[Academia] Error fetching subpage HTML:', e?.message || e);
    }

    // Step E: Parse courses and student profile
    const courses = parseAttendanceAndMarksHtml(portalHtml);
    const student = parseStudentProfileFromHtml(portalHtml, cleanNetId);
    const serializedCookieHeader = await jar.getCookieString('https://academia.srmist.edu.in');

    return {
      success: true,
      portalType: 'academia',
      cookies: serializedCookieHeader,
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
