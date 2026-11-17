import fetchCookie from 'fetch-cookie';
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
    cookiesCaptured?: string[];
  };
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * SRM ACADEMIA (ZOHO IAM HANDSHAKE) - CAMPUS WEB 1-CLICK AUTH
 * Authenticates NetID (e.g. an1328@srmist.edu.in) + Password via Zoho IAM.
 * Uses ManualCookieJar (Map<string, string>) to avoid tough-cookie cross-subdomain drop.
 * Follows 302 redirect hops manually and fetches views via /page-perma/.
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

  const jar = new CookieJar();
  const client = fetchCookie(fetch, jar);

  try {
    // Step 1: Initial GET to initialize Zoho IAM session & obtain iamcsr token
    const initRes = await client(signinPageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const accountsCookies = await jar.getCookies('https://academia.srmist.edu.in/accounts');
    const iamcsr = accountsCookies.find((c) => c.key === 'iamcsr')?.value || '';

    if (!iamcsr) {
      return {
        success: false,
        statusCode: 502,
        error: `[Step 1 CSRF Init]: Failed to obtain iamcsr token from Zoho IAM. Status: ${initRes.status}`,
        technicalReason: `Zoho returned status ${initRes.status}. No iamcsr cookie found in session jar.`,
        stepDetails: {
          step: 'Step 1 CSRF Init',
          zohoStatus: initRes.status,
          viewUrl: signinPageUrl,
          rawSnippet: (await initRes.text()).slice(0, 300),
          cookiesCaptured: accountsCookies.map((c) => c.key),
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

    const lookupRes = await client(lookupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-ZCSRF-TOKEN': `iamcsrcoo=${iamcsr}`,
        Origin: 'https://academia.srmist.edu.in',
        Referer: signinPageUrl,
      },
      body: lookupBody.toString(),
    });

    const lookupData: any = await lookupRes.json().catch(() => ({}));

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

    const passRes = await client(passwordUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
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

    // Step 4: Follow redirect_uri automatically via fetchCookie
    const initialRedirectUri =
      passData.passwordauth?.redirect_uri ||
      'https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin';

    try {
      await client(initialRedirectUri, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: 'https://academia.srmist.edu.in/',
        },
      });
    } catch {}

    try {
      await client('https://academia.srmist.edu.in/', {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: 'https://academia.srmist.edu.in/',
        },
      });
    } catch {}

    await jar.setCookie(
      'ZCNEWUIPUBLICPORTAL=true; Path=/; Domain=academia.srmist.edu.in',
      'https://academia.srmist.edu.in/'
    );

    const cleanCookieString = await jar.getCookieString(
      'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance'
    );
    // Step 5: Fetch Attendance via /page-perma/My_Attendance
    let lastViewUrl = 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance';
    let lastZohoStatus = 200;
    let portalHtml = '';

    try {
      const attRes = await client(lastViewUrl, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: '*/*',
          Referer: 'https://academia.srmist.edu.in/',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      lastZohoStatus = attRes.status;
      const attText = await attRes.text();
      if (attText && attText.length > 50) {
        portalHtml += '\n' + attText;
      }
    } catch (e: any) {
      console.warn('[Academia] Error fetching /page-perma/My_Attendance:', e?.message || e);
    }

    // Step 6: Fetch Timetable via /page-perma/
    let ttViewName = 'My_Time_Table_2023_24';
    // Dynamically discover active timetable view from main HTML if present
    const matchTt = portalHtml.match(/My_Time_Table_[0-9_]+/i);
    if (matchTt?.[0]) {
      ttViewName = matchTt[0];
    }

    const timetableUrls = [
      `https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/${ttViewName}`,
      'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Time_Table_2024_25',
      'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Time_Table',
    ];

    for (const ttUrl of timetableUrls) {
      try {
        const ttRes = await client(ttUrl, {
          method: 'GET',
          headers: {
            'User-Agent': USER_AGENT,
            Accept: '*/*',
            Referer: 'https://academia.srmist.edu.in/',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        if (ttRes.ok) {
          const ttText = await ttRes.text();
          if (ttText && ttText.length > 50) {
            portalHtml += '\n' + ttText;
            break;
          }
        }
      } catch {}
    }

    // Step 7: Parse courses and student profile from decoded HTML
    const decodedHtml = decodeZohoHtml(portalHtml);
    const courses = parseAttendanceAndMarksHtml(decodedHtml || portalHtml);
    const student = parseStudentProfileFromHtml(decodedHtml || portalHtml, cleanNetId);
    const serializedCookieHeader = await jar.getCookieString('https://academia.srmist.edu.in/');

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
