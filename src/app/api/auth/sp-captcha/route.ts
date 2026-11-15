import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const pageUrl = 'https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp';
    const pageRes = await fetch(pageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });

    const setCookies = pageRes.headers.getSetCookie
      ? pageRes.headers.getSetCookie()
      : [pageRes.headers.get('set-cookie') || ''];

    let jsessionId = '';
    for (const c of setCookies) {
      const m = c.match(/JSESSIONID=([^;]+)/i);
      if (m) {
        jsessionId = m[1];
        break;
      }
    }

    const html = await pageRes.text();
    const captchaTextMatch = html.match(/captchaText\s*=\s*['"]([^'"]+)['"]/);
    const domainFieldMatch = html.match(/domainFieldName\s*=\s*['"]([^'"]+)['"]/);
    const captchaFieldMatch = html.match(/captchaFieldName\s*=\s*['"]([^'"]+)['"]/);
    const delimiterMatch = html.match(/randomDelimiter\s*=\s*['"]([^'"]+)['"]/);
    const captchaImgMatch = html.match(/data-src=["']([^"']+)["']/i);

    const captchaPrefill = captchaTextMatch?.[1] || '';
    const domainFieldName = domainFieldMatch?.[1] || 'dtoken_1c9975';
    const captchaFieldName = captchaFieldMatch?.[1] || 'cptoken_9c2df5';
    const randomDelimiter = delimiterMatch?.[1] || '644e';
    const captchaPath = captchaImgMatch?.[1] || '';

    let captchaImg = '';
    if (captchaPath && jsessionId) {
      try {
        const imgUrl = `https://sp.srmist.edu.in${captchaPath}`;
        const imgRes = await fetch(imgUrl, {
          headers: {
            Cookie: `JSESSIONID=${jsessionId}`,
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            Referer: pageUrl,
          },
          cache: 'no-store',
        });
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          const base64 = Buffer.from(buf).toString('base64');
          captchaImg = `data:image/png;base64,${base64}`;
        }
      } catch (imgErr) {
        console.warn('[sp-captcha] Image fetch failed:', imgErr);
      }
    }

    return NextResponse.json({
      success: true,
      jsessionId,
      captchaImg,
      captchaPrefill,
      domainFieldName,
      captchaFieldName,
      randomDelimiter,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to fetch live CAPTCHA from SRM Student Portal.',
        technicalReason: error?.message || 'Connection failed',
      },
      { status: 502 }
    );
  }
}
