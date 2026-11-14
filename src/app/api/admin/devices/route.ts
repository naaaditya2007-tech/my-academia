import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  regNumber: string;
  ip: string;
  location: string;
  lastActive: string;
  status: 'active' | 'revoked';
}

const BLOB_URL =
  'https://5dcoimklfenjzpig.public.blob.vercel-storage.com/myacademia/devices.json';

// In-memory cache for ultra-fast responses between lambdas
let memoryCache: { devices: ConnectedDevice[]; fetchedAt: number } = {
  devices: [],
  fetchedAt: 0,
};

async function fetchCloudDevices(): Promise<ConnectedDevice[]> {
  try {
    // Cache for 2 seconds to prevent excessive blob calls while keeping multi-device state real-time
    if (Date.now() - memoryCache.fetchedAt < 2000 && memoryCache.devices.length > 0) {
      return memoryCache.devices;
    }
    const res = await fetch(`${BLOB_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        memoryCache = { devices: data, fetchedAt: Date.now() };
        return data;
      }
    }
  } catch (err) {
    console.warn('[Blob Device Store] Read error, falling back to memory cache:', err);
  }
  return memoryCache.devices;
}

async function saveCloudDevices(devices: ConnectedDevice[]): Promise<void> {
  memoryCache = { devices, fetchedAt: Date.now() };
  try {
    await put('myacademia/devices.json', JSON.stringify(devices.slice(0, 50)), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (err) {
    console.warn('[Blob Device Store] Cloud save error:', err);
  }
}

function parseUserAgent(ua: string): string {
  if (!ua) return 'Web Browser';
  if (/iPhone/i.test(ua)) return 'Apple iPhone · iOS Safari';
  if (/iPad/i.test(ua)) return 'Apple iPad · iPadOS';
  if (/Android/i.test(ua)) {
    return 'Android Mobile · Chrome';
  }
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Apple Mac · macOS Safari/Chrome';
  if (/Windows NT 10.0/i.test(ua) || /Windows/i.test(ua)) return 'Windows 11 · Chrome/Edge';
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
  const store = await fetchCloudDevices();
  const now = Date.now();
  // A device is considered active if seen within the last 15 minutes and NOT revoked
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
    const { action, deviceId, deviceName, regNumber, passkey } = body;

    let store = await fetchCloudDevices();

    const rawIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'Direct Connection';
    const clientIp = rawIp.replace(/^::ffff:/, '');

    const realLocation = parseLocation(req);
    const ua = req.headers.get('user-agent') || '';
    const resolvedDeviceName = deviceName || parseUserAgent(ua);
    const resolvedRegNumber = regNumber || 'Student Session';

    // 1. Check revocation status (Heartbeat check from client every 3s)
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

        // If marked as revoked in cloud store, strictly return revoked: true!
        if (store[existingIdx].status === 'revoked') {
          await saveCloudDevices(store);
          return NextResponse.json({
            success: true,
            revoked: true,
            deviceId,
            message: 'Device access has been revoked by administrator.',
          });
        }

        await saveCloudDevices(store);
      } else if (deviceId) {
        // Auto-register unseen active client device on heartbeat
        store.unshift({
          deviceId,
          deviceName: resolvedDeviceName,
          regNumber: resolvedRegNumber,
          ip: clientIp,
          location: realLocation,
          lastActive: new Date().toISOString(),
          status: 'active',
        });
        await saveCloudDevices(store);
      }
      return NextResponse.json({ success: true, revoked: false, deviceId });
    }

    // 2. Admin Revocation Action
    if (action === 'revoke') {
      store = store.map((d) =>
        d.deviceId === deviceId ? { ...d, status: 'revoked' as const, lastActive: new Date().toISOString() } : d
      );
      await saveCloudDevices(store);
      const activeCount = store.filter((d) => d.status === 'active').length;
      return NextResponse.json({
        success: true,
        message: `Device ${deviceId} revoked successfully`,
        devices: store,
        activeCount,
      });
    }

    // 3. Admin Un-revoke / Approve Action (Requires master passkey or console call)
    if (action === 'unrevoke' || action === 'approve') {
      if (passkey && passkey !== '2808' && passkey !== '2077') {
        return NextResponse.json({ success: false, error: 'Invalid master PIN' }, { status: 403 });
      }

      store = store.map((d) =>
        d.deviceId === deviceId ? { ...d, status: 'active' as const, lastActive: new Date().toISOString() } : d
      );
      await saveCloudDevices(store);
      const activeCount = store.filter((d) => d.status === 'active').length;
      return NextResponse.json({
        success: true,
        message: `Device ${deviceId} re-authorized and restored successfully`,
        devices: store,
        activeCount,
      });
    }

    // 4. Real Device Registration (On Initial Page Mount / Login)
    if (action === 'register' && deviceId) {
      const existingIdx = store.findIndex((d) => d.deviceId === deviceId);
      if (existingIdx >= 0) {
        // PRESERVE REVOKED STATUS: A revoked device CANNOT un-revoke itself by registering!
        const currentStatus = store[existingIdx].status;
        store[existingIdx] = {
          ...store[existingIdx],
          deviceName: resolvedDeviceName,
          lastActive: new Date().toISOString(),
          ip: clientIp,
          location: realLocation,
          regNumber: regNumber || store[existingIdx].regNumber,
          status: currentStatus,
        };

        await saveCloudDevices(store);
        const activeCount = store.filter((d) => d.status === 'active').length;

        return NextResponse.json({
          success: true,
          revoked: currentStatus === 'revoked',
          devices: store,
          activeCount,
        });
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

      // Limit list to latest 50 real devices
      if (store.length > 50) {
        store = store.slice(0, 50);
      }

      await saveCloudDevices(store);
      const activeCount = store.filter((d) => d.status === 'active').length;
      return NextResponse.json({
        success: true,
        revoked: false,
        devices: store,
        activeCount,
      });
    }

    // Default: Return current cloud devices list
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
