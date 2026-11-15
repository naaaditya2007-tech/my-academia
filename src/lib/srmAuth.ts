import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { parseAttendanceAndMarksHtml, parseStudentProfileFromHtml, decodeZohoHtml } from './scraper';
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
  stepDetails?: {
    step: string;
    zohoStatus: number;
    viewUrl?: string;
    rawSnippet?: string;
  };
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
      stepDetails: {
        step: 'Step 0 Credential Validation',
        zohoStatus: 400,
        rawSnippet: 'NetID or password omitted',
      },
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
        timeout: 25000,
      })
    );

    // Step 1: Initial GET to initialize Zoho IAM session & obtain iamcsr token
    const initRes = await client.get(signinPageUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      validateStatus: () => true,
    });

    const cookies = await jar.getCookies('https://academia.srmist.edu.in');
    const iamcsr = cookies.find((c) => c.key === 'iamcsr')?.value || '';

    if (!iamcsr) {
      return {
        success: false,
        statusCode: 502,
        error: `[Step 1 CSRF Init]: Failed to obtain iamcsr token from Zoho IAM.`,
        technicalReason: `Zoho returned status ${initRes.status}. No iamcsr cookie found in session jar.`,
        stepDetails: {
          step: 'Step 1 CSRF Init',
          zohoStatus: initRes.status,
          viewUrl: signinPageUrl,
          rawSnippet: String(initRes.data).slice(0, 300),
        },
      };
    }

    // Step 2: Lookup NetID against Zoho IAM
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
        'X-ZCSRF-TOKEN': `iamcsrcoo=${iamcsr}`,
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
        error: `[Step 2 NetID Lookup]: Invalid NetID. Account does not exist on SRM Academia.`,
        technicalReason: `Zoho IAM returned U100: ${lookupData.message || 'User does not exist'}`,
        stepDetails: {
          step: 'Step 2 NetID Lookup',
          zohoStatus: lookupRes.status,
          viewUrl: lookupUrl,
          rawSnippet: JSON.stringify(lookupData),
        },
      };
    }

    if (lookupData.code !== 'U200' || !lookupData.lookup?.identifier) {
      return {
        success: false,
        statusCode: 400,
        error: `[Step 2 NetID Lookup]: Zoho IAM validation failed for ${cleanNetId}.`,
        technicalReason: `Zoho lookup code ${lookupData.code || lookupRes.status}: ${lookupData.message || 'Unknown error'}`,
        stepDetails: {
          step: 'Step 2 NetID Lookup',
          zohoStatus: lookupRes.status,
          viewUrl: lookupUrl,
          rawSnippet: JSON.stringify(lookupData),
        },
      };
    }

    const zuid = lookupData.lookup.identifier;
    const digest = lookupData.lookup.digest || '';

    // Step 3: Submit Password to Zoho IAM
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
          'X-ZCSRF-TOKEN': `iamcsrcoo=${iamcsr}`,
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
        error: `[Step 3 Password Auth]: Incorrect password for ${cleanNetId}. Please verify your SRM Academia password.`,
        technicalReason: passData.localized_message || passData.message || 'IN102 Wrong password',
        stepDetails: {
          step: 'Step 3 Password Auth',
          zohoStatus: passRes.status,
          viewUrl: passwordUrl,
          rawSnippet: JSON.stringify(passData),
        },
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
        error: `[Step 3 Password Auth]: SRM Academia sign-in rejected.`,
        technicalReason: passData.localized_message || passData.message || `Zoho code: ${passData.code}`,
        stepDetails: {
          step: 'Step 3 Password Auth',
          zohoStatus: passRes.status,
          viewUrl: passwordUrl,
          rawSnippet: JSON.stringify(passData),
        },
      };
    }

    // Step 4: Follow redirect_uri to establish authenticated portal session in tough-cookie jar
    const redirectUri =
      passData.passwordauth?.redirect_uri ||
      'https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin';

    let portalHtml = '';
    let lastViewUrl = '';
    let lastZohoStatus = 200;

    try {
      const redirectRes = await client.get(redirectUri, {
        maxRedirects: 10,
        validateStatus: () => true,
      });

      lastZohoStatus = redirectRes.status;
      portalHtml = typeof redirectRes.data === 'string' ? redirectRes.data : '';

      // Step 5: POST to liveViewHeader.do for My_Attendance (Exact Zoho Creator format)
      const attendanceViews = ['My_Attendance'];
      const matchAtt = portalHtml.match(/viewLinkName=(My_Attendance[^"&'\s]*)/i);
      if (matchAtt?.[1] && !attendanceViews.includes(matchAtt[1])) {
        attendanceViews.unshift(matchAtt[1]);
      }

      for (const viewName of attendanceViews) {
        lastViewUrl = `https://academia.srmist.edu.in/liveViewHeader.do [view: ${viewName}]`;
        try {
          const attBody = `sharedBy=srm_university&appLinkName=academia-academic-services&zccpn=bts&viewLinkName=${encodeURIComponent(viewName)}&&urlParams=%7B%7D&isPageLoad=true`;

          const attRes = await client.post('https://academia.srmist.edu.in/liveViewHeader.do', attBody, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              Origin: 'https://academia.srmist.edu.in',
              Referer: 'https://academia.srmist.edu.in/portal/academia-academic-services',
              Accept: '*/*',
            },
            validateStatus: () => true,
          });

          lastZohoStatus = attRes.status;
          const attText = typeof attRes.data === 'string' ? attRes.data : JSON.stringify(attRes.data);
          if (attText && attText.length > 50) {
            portalHtml += '\n' + attText;
            break;
          }
        } catch (e: any) {
          console.warn('[Academia] Error fetching attendance view:', e?.message || e);
        }
      }

      // Step 6: POST to liveViewHeader.do for Timetable & Course Details
      const timetableViews = ['My_Time_Table_2023_24', 'My_Time_Table_2024_25', 'My_Time_Table'];
      const matchTt = portalHtml.match(/viewLinkName=(My_Time_Table[^"&'\s]*)/i);
      if (matchTt?.[1] && !timetableViews.includes(matchTt[1])) {
        timetableViews.unshift(matchTt[1]);
      }

      for (const viewName of timetableViews) {
        try {
          const ttBody = `sharedBy=srm_university&appLinkName=academia-academic-services&zccpn=bts&viewLinkName=${encodeURIComponent(viewName)}&&urlParams=%7B%7D&isPageLoad=true`;

          const ttRes = await client.post('https://academia.srmist.edu.in/liveViewHeader.do', ttBody, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              Origin: 'https://academia.srmist.edu.in',
              Referer: 'https://academia.srmist.edu.in/portal/academia-academic-services',
              Accept: '*/*',
            },
            validateStatus: () => true,
          });

          const ttText = typeof ttRes.data === 'string' ? ttRes.data : JSON.stringify(ttRes.data);
          if (ttText && ttText.length > 50) {
            portalHtml += '\n' + ttText;
            break;
          }
        } catch {}
      }
    } catch (e: any) {
      console.warn('[Academia] Error in view session sequence:', e?.message || e);
    }

    // Step 7: Parse courses and student profile from combined, decoded HTML
    const decodedHtml = decodeZohoHtml(portalHtml);
    const courses = parseAttendanceAndMarksHtml(portalHtml);
    const student = parseStudentProfileFromHtml(portalHtml, cleanNetId);
    const serializedCookieHeader = await jar.getCookieString('https://academia.srmist.edu.in');

    return {
      success: true,
      portalType: 'academia',
      cookies: serializedCookieHeader,
      attendanceHtml: decodedHtml || portalHtml,
      student,
      courses,
      stepDetails: {
        step: 'Step 5 Attendance Fetch',
        zohoStatus: lastZohoStatus,
        viewUrl: lastViewUrl,
        rawSnippet: (decodedHtml || portalHtml).slice(0, 300),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      statusCode: 500,
      error: `[Zoho Network Handshake]: Unable to communicate with SRM Academia Zoho portal.`,
      technicalReason: err?.message || 'Network handshake failed',
      stepDetails: {
        step: 'Zoho Network Handshake',
        zohoStatus: 500,
        rawSnippet: err?.message || 'Handshake failed',
      },
    };
  }
}
