import { NextRequest, NextResponse } from 'next/server';

export interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  regNumber: string;
  ip: string;
  location: string;
  lastActive: string;
  status: 'active' | 'revoked';
}

// Global server memory store: strictly holds REAL connected devices (zero fake mocks)
let devicesStore: ConnectedDevice[] = [];

function parseUserAgent(ua: string): string {
  if (!ua) return 'Web Browser';
  if (/iPhone/i.test(ua)) return 'Apple iPhone · iOS Safari';
  if (/iPad/i.test(ua)) return 'Apple iPad · iPadOS';
  if (/Android/i.test(ua)) {
    return 'Android Mobile · Chrome';
  }
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Apple Mac · macOS Safari/Chrome';
  if (/Windows NT 10.0/i.test(ua) || /Windows/i.test(ua)) return 'Windows PC · Chrome/Edge';
  if (/Linux/i.test(ua)) return 'Linux PC · Browser';
  return 'Web Browser';
}

function parseLocation(req: NextRequest): string {
  const city = req.headers.get('x-vercel-ip-city');
  const region = req.headers.get('x-vercel-ip-country-region');
  const country = req.headers.get('x-vercel-ip-country');
  
  if (city) {
    try {
      const decodedCity = decodeURIComponent(city);
      return region ? `${decodedCity}, ${region}` : `${decodedCity}, ${country || 'IN'}`;
    } catch {
      return `${city}, ${country || 'IN'}`;
    }
  }
  if (country) {
    return country === 'IN' ? 'India' : country;
  }
  return 'Direct Web Session';
}

export async function GET() {
  const now = Date.now();
  // A device is considered live active if seen within the last 15 minutes and not revoked
  const activeCount = devicesStore.filter(
    (d) => d.status === 'active' && now - new Date(d.lastActive).getTime() < 15 * 60 * 1000
  ).length;

  return NextResponse.json({
    success: true,
    totalCount: devicesStore.length,
    activeCount,
    devices: devicesStore,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, deviceId, deviceName, regNumber } = body;

    const rawIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'Direct Connection';
    const clientIp = rawIp.replace(/^::ffff:/, '');

    const realLocation = parseLocation(req);
    const ua = req.headers.get('user-agent') || '';
    const resolvedDeviceName = deviceName || parseUserAgent(ua);

    // 1. Check revocation status (Heartbeat check from client)
    if (action === 'check_status') {
      const existingIdx = devicesStore.findIndex((d) => d.deviceId === deviceId);
      if (existingIdx >= 0) {
        // Update heartbeat and network info
        devicesStore[existingIdx].lastActive = new Date().toISOString();
        if (clientIp && clientIp !== 'Direct Connection') {
          devicesStore[existingIdx].ip = clientIp;
        }
        if (realLocation && realLocation !== 'Direct Web Session') {
          devicesStore[existingIdx].location = realLocation;
        }

        if (devicesStore[existingIdx].status === 'revoked') {
          return NextResponse.json({ success: true, revoked: true });
        }
      } else if (deviceId) {
        // Automatically register unseen active client device on heartbeat
        devicesStore.unshift({
          deviceId,
          deviceName: resolvedDeviceName,
          regNumber: regNumber || 'RA2511026010107',
          ip: clientIp,
          location: realLocation,
          lastActive: new Date().toISOString(),
          status: 'active',
        });
      }
      return NextResponse.json({ success: true, revoked: false });
    }

    // 2. Admin Revocation Action
    if (action === 'revoke') {
      devicesStore = devicesStore.map((d) =>
        d.deviceId === deviceId ? { ...d, status: 'revoked' as const } : d
      );
      const activeCount = devicesStore.filter((d) => d.status === 'active').length;
      return NextResponse.json({
        success: true,
        message: `Device ${deviceId} revoked successfully`,
        devices: devicesStore,
        activeCount,
      });
    }

    // 3. Real Device Registration (On Initial Page Mount / Login)
    if (action === 'register' && deviceId) {
      const existingIdx = devicesStore.findIndex((d) => d.deviceId === deviceId);
      if (existingIdx >= 0) {
        devicesStore[existingIdx] = {
          ...devicesStore[existingIdx],
          deviceName: resolvedDeviceName,
          lastActive: new Date().toISOString(),
          ip: clientIp,
          location: realLocation,
        };
      } else {
        devicesStore.unshift({
          deviceId,
          deviceName: resolvedDeviceName,
          regNumber: regNumber || 'RA2511026010107',
          ip: clientIp,
          location: realLocation,
          lastActive: new Date().toISOString(),
          status: 'active',
        });
      }

      // Limit memory list to latest 50 real devices
      if (devicesStore.length > 50) {
        devicesStore = devicesStore.slice(0, 50);
      }

      const activeCount = devicesStore.filter((d) => d.status === 'active').length;
      return NextResponse.json({
        success: true,
        devices: devicesStore,
        activeCount,
      });
    }

    // Default: Return current real devices list
    const activeCount = devicesStore.filter((d) => d.status === 'active').length;
    return NextResponse.json({
      success: true,
      devices: devicesStore,
      activeCount,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
