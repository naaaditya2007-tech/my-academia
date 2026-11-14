import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  regNumber: string;
  ip: string;
  location: string;
  lastActive: string;
  status: 'active' | 'revoked';
}

const STORAGE_PATH = path.join(
  process.platform === 'win32' ? process.cwd() : '/tmp',
  'myacademia_devices.json'
);

function loadDevices(): ConnectedDevice[] {
  try {
    if (fs.existsSync(STORAGE_PATH)) {
      const data = fs.readFileSync(STORAGE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function persistDevices(devices: ConnectedDevice[]) {
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(devices.slice(0, 50)), 'utf-8');
  } catch {}
}

let devicesStore: ConnectedDevice[] = loadDevices();

function getDevices(): ConnectedDevice[] {
  if (devicesStore.length === 0) {
    devicesStore = loadDevices();
  }
  return devicesStore;
}

function setDevices(list: ConnectedDevice[]) {
  devicesStore = list;
  persistDevices(list);
}

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
  const store = getDevices();
  const now = Date.now();
  // A device is considered live active if seen within the last 15 minutes and not revoked
  const activeCount = store.filter(
    (d) => d.status === 'active' && now - new Date(d.lastActive).getTime() < 15 * 60 * 1000
  ).length;

  return NextResponse.json({
    success: true,
    totalCount: store.length,
    activeCount,
    devices: store,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, deviceId, deviceName, regNumber } = body;

    let store = getDevices();

    const rawIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'Direct Connection';
    const clientIp = rawIp.replace(/^::ffff:/, '');

    const realLocation = parseLocation(req);
    const ua = req.headers.get('user-agent') || '';
    const resolvedDeviceName = deviceName || parseUserAgent(ua);
    const resolvedRegNumber = regNumber || 'Student Session';

    // 1. Check revocation status (Heartbeat check from client)
    if (action === 'check_status') {
      const existingIdx = store.findIndex((d) => d.deviceId === deviceId);
      if (existingIdx >= 0) {
        // Update heartbeat and network info
        store[existingIdx].lastActive = new Date().toISOString();
        if (clientIp && clientIp !== 'Direct Connection') {
          store[existingIdx].ip = clientIp;
        }
        if (realLocation && realLocation !== 'Direct Web Session') {
          store[existingIdx].location = realLocation;
        }
        if (regNumber && regNumber !== 'Student Session') {
          store[existingIdx].regNumber = regNumber;
        }

        setDevices(store);

        if (store[existingIdx].status === 'revoked') {
          return NextResponse.json({ success: true, revoked: true });
        }
      } else if (deviceId) {
        // Automatically register unseen active client device on heartbeat
        store.unshift({
          deviceId,
          deviceName: resolvedDeviceName,
          regNumber: resolvedRegNumber,
          ip: clientIp,
          location: realLocation,
          lastActive: new Date().toISOString(),
          status: 'active',
        });
        setDevices(store);
      }
      return NextResponse.json({ success: true, revoked: false });
    }

    // 2. Admin Revocation Action
    if (action === 'revoke') {
      store = store.map((d) =>
        d.deviceId === deviceId ? { ...d, status: 'revoked' as const } : d
      );
      setDevices(store);
      const activeCount = store.filter((d) => d.status === 'active').length;
      return NextResponse.json({
        success: true,
        message: `Device ${deviceId} revoked successfully`,
        devices: store,
        activeCount,
      });
    }

    // 3. Real Device Registration (On Initial Page Mount / Login)
    if (action === 'register' && deviceId) {
      const existingIdx = store.findIndex((d) => d.deviceId === deviceId);
      if (existingIdx >= 0) {
        store[existingIdx] = {
          ...store[existingIdx],
          deviceName: resolvedDeviceName,
          lastActive: new Date().toISOString(),
          ip: clientIp,
          location: realLocation,
          regNumber: regNumber || store[existingIdx].regNumber,
        };
      } else {
        store.unshift({
          deviceId,
          deviceName: resolvedDeviceName,
          regNumber: resolvedRegNumber,
          ip: clientIp,
          location: realLocation,
          lastActive: new Date().toISOString(),
          status: 'active',
        });
      }

      // Limit memory list to latest 50 real devices
      if (store.length > 50) {
        store = store.slice(0, 50);
      }

      setDevices(store);
      const activeCount = store.filter((d) => d.status === 'active').length;
      return NextResponse.json({
        success: true,
        devices: store,
        activeCount,
      });
    }

    // Default: Return current real devices list
    const activeCount = store.filter((d) => d.status === 'active').length;
    return NextResponse.json({
      success: true,
      devices: store,
      activeCount,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
