import axios from 'axios';
import querystring from 'querystring';

export interface SRMAuthResult {
  success: boolean;
  jsessionId?: string;
  attendanceHtml?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Attempts real-time authentication against live SRM Student Portal (sp.srmist.edu.in)
 * Follows official login sequence: GET youLogin.jsp -> Token extraction -> POST LoginServlet -> Verification
 */
export async function authenticateWithSRMPortal(
  usernameInput: string,
  passwordInput: string
): Promise<SRMAuthResult> {
  const cleanUsername = usernameInput.replace(/@srmist\.edu\.in$/i, '').trim();
  const password = passwordInput.trim();

  if (!cleanUsername || !password) {
    return {
      success: false,
      error: 'Please enter both your SRM NetID and password.',
      statusCode: 400,
    };
  }

  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

  try {
    // 1. Initial GET to youLogin.jsp to establish session & retrieve secure tokens
    const pageUrl = 'https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp';
    const pageRes = await axios.get(pageUrl, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 9000,
      maxRedirects: 5,
    });

    const setCookieHeaders = pageRes.headers['set-cookie'] || [];
    let jsessionId = '';
    for (const c of setCookieHeaders) {
      if (c.startsWith('JSESSIONID=')) {
        jsessionId = c.split(';')[0];
        break;
      }
    }

    if (!jsessionId) {
      return {
        success: false,
        error: 'Unable to establish secure connection with SRM portal server.',
        statusCode: 502,
      };
    }

    const html = pageRes.data || '';

    // 2. Extract guard tokens & captcha embedded by SRM portal
    const captchaMatch = html.match(/captchaText\s*=\s*['"]([^'"]+)['"]/);
    const domainFieldMatch = html.match(/domainFieldName\s*=\s*['"]([^'"]+)['"]/);
    const captchaFieldMatch = html.match(/captchaFieldName\s*=\s*['"]([^'"]+)['"]/);
    const delimiterMatch = html.match(/randomDelimiter\s*=\s*['"]([^'"]+)['"]/);
    const hpMatch = html.match(/name=\"(ph_[a-f0-9]+)\"/);

    const captchaText = captchaMatch?.[1] || '';
    const domainField = domainFieldMatch?.[1];
    const captchaField = captchaFieldMatch?.[1];
    const delimiter = delimiterMatch?.[1] || '';
    const hpField = hpMatch?.[1];

    const reversedHost = 'sp.srmist.edu.in'.split('').reverse().join('');
    const dtokenVal = Buffer.from(reversedHost).toString('base64');
    const cptokenVal = Buffer.from(`3${delimiter}16`).toString('base64');

    const postPayload: Record<string, string> = {
      username: cleanUsername,
      password: password,
      captcha: captchaText,
    };
    if (domainField) postPayload[domainField] = dtokenVal;
    if (captchaField) postPayload[captchaField] = cptokenVal;
    if (hpField) postPayload[hpField] = '';

    const postData = querystring.stringify(postPayload);

    // 3. POST credentials to SRM LoginServlet
    const loginUrl = 'https://sp.srmist.edu.in/srmiststudentportal/LoginServlet';
    const loginRes = await axios.post(loginUrl, postData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        Cookie: jsessionId,
        Referer: pageUrl,
        Origin: 'https://sp.srmist.edu.in',
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true, // Don't throw on 302 or 401
    });

    const loginBody = String(loginRes.data || '');

    // Check for SRM portal invalid credentials indicators
    if (
      loginRes.status === 401 ||
      loginBody.includes('Invalid credentials') ||
      loginBody.includes('Invalid user') ||
      loginBody.includes('Enter valid password') ||
      loginBody.includes('divUserId') ||
      loginBody.includes('Please Enter Valid')
    ) {
      return {
        success: false,
        error: 'Invalid NetID or Password.',
        statusCode: 401,
      };
    }

    // 4. Verify authenticated session by requesting actual student attendance details
    const attendanceUrl =
      'https://sp.srmist.edu.in/srmiststudentportal/students/report/studentAttendanceDetails.jsp';
    const verifyRes = await axios.post(
      attendanceUrl,
      {},
      {
        headers: {
          Cookie: jsessionId,
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 9000,
        validateStatus: () => true,
      }
    );

    const verifyHtml = String(verifyRes.data || '');

    // If attendance page redirects to login or does not contain student details, auth failed
    if (
      verifyRes.status === 401 ||
      verifyRes.status === 403 ||
      verifyHtml.includes('login_form') ||
      verifyHtml.includes('youLogin.jsp') ||
      verifyHtml.includes('Invalid')
    ) {
      return {
        success: false,
        error: 'Invalid NetID or Password.',
        statusCode: 401,
      };
    }

    // Authentication succeeded with verified live session
    return {
      success: true,
      jsessionId,
      attendanceHtml: verifyHtml,
      statusCode: 200,
    };
  } catch (err: any) {
    console.error('[SRM Auth] Network/handshake error:', err.message);
    return {
      success: false,
      error: 'Unable to connect to SRM student portal. Please check your network or try again.',
      statusCode: 503,
    };
  }
}

/**
 * Validates an active JSESSIONID session cookie against live SRM portal
 */
export async function verifySRMSessionCookie(cookieInput: string): Promise<SRMAuthResult> {
  const cleanCookie = cookieInput.trim();
  const formattedCookie = cleanCookie.includes('JSESSIONID=')
    ? cleanCookie
    : `JSESSIONID=${cleanCookie}`;

  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

  try {
    const attendanceUrl =
      'https://sp.srmist.edu.in/srmiststudentportal/students/report/studentAttendanceDetails.jsp';
    const res = await axios.post(
      attendanceUrl,
      {},
      {
        headers: {
          Cookie: formattedCookie,
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 9000,
        validateStatus: () => true,
      }
    );

    const html = String(res.data || '');

    if (
      res.status === 401 ||
      res.status === 403 ||
      html.includes('login_form') ||
      html.includes('youLogin.jsp')
    ) {
      return {
        success: false,
        error: 'Invalid or expired JSESSIONID. Please log in to sp.srmist.edu.in and copy a fresh session cookie.',
        statusCode: 401,
      };
    }

    return {
      success: true,
      jsessionId: formattedCookie,
      attendanceHtml: html,
      statusCode: 200,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Failed to verify session cookie with SRM portal.',
      statusCode: 503,
    };
  }
}
