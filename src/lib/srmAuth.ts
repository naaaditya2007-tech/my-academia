import { parseAttendanceAndMarksHtml, parseStudentProfileFromHtml, decodeZohoHtml } from './scraper';
import { Course, StudentProfile } from '@/types/campus';

export interface CookieEntry {
  value: string;
  path: string;
}

export class ManualCookieJar {
  private cookies = new Map<string, CookieEntry>();

  updateFromHeaders(headers: any) {
    if (!headers) return;
    let list: string[] = [];
    if (typeof headers?.getSetCookie === 'function') {
      list = headers.getSetCookie();
    } else if (typeof headers?.get === 'function') {
      const s = headers.get('set-cookie');
      if (s) {
        list = s.split(/,(?=\s*[\w-]+=[^;])/);
      }
    } else if (Array.isArray(headers?.['set-cookie'])) {
      list = headers['set-cookie'];
    } else if (typeof headers?.['set-cookie'] === 'string') {
      list = headers['set-cookie'].split(/,(?=\s*[\w-]+=[^;])/);
    }

    for (const str of list) {
      if (!str) continue;
      const parts = str.split(';');
      const nameVal = parts[0].trim();
      const idx = nameVal.indexOf('=');
      if (idx > 0) {
        const k = nameVal.slice(0, idx).trim();
        const v = nameVal.slice(idx + 1).trim();

        let path = '/';
        for (let i = 1; i < parts.length; i++) {
          const attr = parts[i].trim();
          const pIdx = attr.indexOf('=');
          if (pIdx > 0 && attr.slice(0, pIdx).trim().toLowerCase() === 'path') {
            path = attr.slice(pIdx + 1).trim() || '/';
            break;
          }
        }

        if (v && v.toLowerCase() !== 'delete' && v.toLowerCase() !== 'deleted') {
          this.cookies.set(k, { value: v, path });
        }
      }
    }
  }

  set(key: string, val: string, path: string = '/') {
    this.cookies.set(key, { value: val, path });
  }

  delete(key: string) {
    this.cookies.delete(key);
  }

  get(key: string): string | undefined {
    return this.cookies.get(key)?.value;
  }

  has(key: string): boolean {
    return this.cookies.has(key);
  }

  keys(): string[] {
    return Array.from(this.cookies.keys());
  }

  entries(): [string, string][] {
    return Array.from(this.cookies.entries()).map(([k, entry]) => [k, entry.value]);
  }

  toHeaderString(): string {
    return Array.from(this.cookies.entries())
      .map(([k, entry]) => `${k}=${entry.value}`)
      .join('; ');
  }

  toCleanIAMAuthHeader(): string {
    const ALLOWED_PREFIXES = ['_iamadt', '_iambdt', '__Secure-iamsdt', '_z_identity'];
    return Array.from(this.cookies.entries())
      .filter(([name]) => ALLOWED_PREFIXES.some((prefix) => name.startsWith(prefix)))
      .map(([k, entry]) => `${k}=${entry.value}`)
      .join('; ');
  }

  toHeaderStringForPath(targetPath: string = '/srm_university'): string {
    const excludedKeys = new Set(['iamcsr', 'stk', 'zalb_f0e8db9d3d']);
    const entries: string[] = [];

    for (const [k, entry] of this.cookies.entries()) {
      if (excludedKeys.has(k)) continue;
      if (entry.path.startsWith('/accounts') || entry.path.startsWith('/signin')) continue;
      if (k.startsWith('zalb_') && k !== 'zalb_74c3a1eecc' && entry.path.startsWith('/accounts')) continue;
      entries.push(`${k}=${entry.value}`);
    }

    if (!entries.some(e => e.startsWith('ZCNEWUIPUBLICPORTAL='))) {
      entries.push('ZCNEWUIPUBLICPORTAL=true');
    }

    return entries.join('; ');
  }

  loadFromString(headerStr: string) {
    if (!headerStr) return;
    const parts = headerStr.split(';');
    for (const p of parts) {
      const idx = p.indexOf('=');
      if (idx > 0) {
        const k = p.slice(0, idx).trim();
        const v = p.slice(idx + 1).trim();
        if (v && v.toLowerCase() !== 'delete' && v.toLowerCase() !== 'deleted') {
          this.cookies.set(k, { value: v, path: '/' });
        }
      }
    }
  }
}

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

  const jar = new ManualCookieJar();

  try {
    // Step 1: Initial GET to initialize Zoho IAM session & obtain iamcsr token
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
        statusCode: 502,
        error: `[Step 1 CSRF Init]: Failed to obtain iamcsr token from Zoho IAM. CookiesCaptured: [${jar.keys().join(', ')}]`,
        technicalReason: `Zoho returned status ${initRes.status}. No iamcsr cookie found in session jar.`,
        stepDetails: {
          step: 'Step 1 CSRF Init',
          zohoStatus: initRes.status,
          viewUrl: signinPageUrl,
          rawSnippet: (await initRes.text()).slice(0, 300),
          cookiesCaptured: jar.keys(),
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
    const lookupData: any = await lookupRes.json().catch(() => ({}));

    if (lookupData.code === 'U100' || lookupData.message?.includes('does not exist')) {
      return {
        success: false,
        statusCode: 404,
        error: `[Step 2 NetID Lookup]: Invalid NetID. Account does not exist on SRM Academia. CookiesCaptured: [${jar.keys().join(', ')}]`,
        technicalReason: `Zoho IAM returned U100: ${lookupData.message || 'User does not exist'}`,
        stepDetails: {
          step: 'Step 2 NetID Lookup',
          zohoStatus: lookupRes.status,
          viewUrl: lookupUrl,
          rawSnippet: JSON.stringify(lookupData),
          cookiesCaptured: jar.keys(),
        },
      };
    }

    if (lookupData.code !== 'U200' || !lookupData.lookup?.identifier) {
      return {
        success: false,
        statusCode: 400,
        error: `[Step 2 NetID Lookup]: Zoho IAM validation failed for ${cleanNetId}. CookiesCaptured: [${jar.keys().join(', ')}]`,
        technicalReason: `Zoho lookup code ${lookupData.code || lookupRes.status}: ${lookupData.message || 'Unknown error'}`,
        stepDetails: {
          step: 'Step 2 NetID Lookup',
          zohoStatus: lookupRes.status,
          viewUrl: lookupUrl,
          rawSnippet: JSON.stringify(lookupData),
          cookiesCaptured: jar.keys(),
        },
      };
    }

    const zuid = lookupData.lookup.identifier;
    const digest = lookupData.lookup.digest || '';

    // Step 3: Submit Password to Zoho IAM
    const signinParams = `digest=${digest}&cli_time=${Date.now()}&orgtype=40&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2F`;
    const passwordUrl = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/primary/${zuid}/password?${signinParams}`;

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
        error: `[Step 3 Password Auth]: Incorrect password for ${cleanNetId}. Please verify your SRM Academia password. CookiesCaptured: [${jar.keys().join(', ')}]`,
        technicalReason: passData.localized_message || passData.message || 'IN102 Wrong password',
        stepDetails: {
          step: 'Step 3 Password Auth',
          zohoStatus: passRes.status,
          viewUrl: passwordUrl,
          rawSnippet: JSON.stringify(passData),
          cookiesCaptured: jar.keys(),
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
        error: `[Step 3 Password Auth]: SRM Academia sign-in rejected. CookiesCaptured: [${jar.keys().join(', ')}]`,
        technicalReason: passData.localized_message || passData.message || `Zoho code: ${passData.code}`,
        stepDetails: {
          step: 'Step 3 Password Auth',
          zohoStatus: passRes.status,
          viewUrl: passwordUrl,
          rawSnippet: JSON.stringify(passData),
          cookiesCaptured: jar.keys(),
        },
      };
    }

    // Step 4: Follow redirect_uri hops manually (up to 8 hops) to lock in all session cookies
    const initialRedirectUri =
      passData.passwordauth?.redirect_uri ||
      'https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin';

    let currentUrl: string | null = initialRedirectUri;
    let hops = 0;
    let portalHtml = '';

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

        // Crucial: Update cookies BEFORE checking location header
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
          const text = await hopRes.text();
          if (text) portalHtml += '\n' + text;
          break;
        }
      } catch (err: any) {
        console.warn(`[Academia] Redirect hop ${hops} error:`, err?.message || err);
        break;
      }
    }

    // Step 4b: Lock in JSESSIONID and ZCNEWUIPUBLICPORTAL with one GET to base academia domain
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
      const mainText = await finalRes.text();
      if (mainText && mainText.length > 100) {
        portalHtml += '\n' + mainText;
      }
    } catch {}

    // Step 5: Fetch Attendance via /page-perma/My_Attendance
    let lastViewUrl = 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page-perma/My_Attendance';
    let lastZohoStatus = 200;

    try {
      const attRes = await fetch(lastViewUrl, {
        method: 'GET',
        headers: {
          Cookie: jar.toHeaderString(),
          'User-Agent': USER_AGENT,
          Accept: '*/*',
          Referer: 'https://academia.srmist.edu.in/',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      lastZohoStatus = attRes.status;
      jar.updateFromHeaders(attRes.headers);

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
        const ttRes = await fetch(ttUrl, {
          method: 'GET',
          headers: {
            Cookie: jar.toHeaderString(),
            'User-Agent': USER_AGENT,
            Accept: '*/*',
            Referer: 'https://academia.srmist.edu.in/',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        jar.updateFromHeaders(ttRes.headers);
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
    const serializedCookieHeader = jar.toHeaderString();

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
        cookiesCaptured: jar.keys(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      statusCode: 500,
      error: `[Zoho Network Handshake]: Unable to communicate with SRM Academia Zoho portal. CookiesCaptured: [${jar.keys().join(', ')}]`,
      technicalReason: err?.message || 'Network handshake failed',
      stepDetails: {
        step: 'Zoho Network Handshake',
        zohoStatus: 500,
        rawSnippet: err?.message || 'Handshake failed',
        cookiesCaptured: jar.keys(),
      },
    };
  }
}
