import { NextRequest, NextResponse } from 'next/server';
import { put, get } from '@vercel/blob';

export interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  regNumber: string;
  ip: string;
  location: string;
  lastActive: string;
  status: 'active' | 'revoked';
}

const BLOB_PATH = 'myacademia/devices.json';
const BLOB_PUBLIC_URL =
  'https://5dcoimklfenjzpig.public.blob.vercel-storage.com/myacademia/devices.json';

// In-memory cache to ensure cross-request consistency within same lambda instance
let memoryCache: { devices: ConnectedDevice[]; fetchedAt: number } = {
  devices: [],
  fetchedAt: 0,
};

function getBlobOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim().replace(/^['"]|['"]$/g, '');
  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();
  const storeId = process.env.BLOB_STORE_ID || 'store_5dCoiMKlFENjzpIG';

  if (token) {
    return { token };
  }
  if (oidcToken) {
    return { storeId, oidcToken };
  }
  return { storeId };
}

/**
 * Robust cloud fetch bypassing CDN cache completely
 */
export async function fetchCloudDevices(): Promise<ConnectedDevice[]> {
  // Use memory cache only if very fresh (under 1 second) and non-empty
  if (Date.now() - memoryCache.fetchedAt < 1000 && memoryCache.devices.length > 0) {
    return memoryCache.devices;
  }

  // 1. Try direct @vercel/blob SDK get (bypasses CDN cache completely)
  try {
    const blobRes = await get(BLOB_PUBLIC_URL, {
      access: 'public',
      ...getBlobOptions(),
    });
    if (blobRes && blobRes.stream) {
      const text = await new Response(blobRes.stream).text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCache = { devices: parsed, fetchedAt: Date.now() };
        return parsed;
      }
    }
  } catch (err: any) {
    // If not found or error, fallback to uncached direct download fetch
    console.warn('[Blob Device Store] SDK get fallback:', err?.message || err);
  }

  // 2. Direct download fetch with timestamp and no-cache headers
  try {
    const res = await fetch(`${BLOB_PUBLIC_URL}?download=1&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        memoryCache = { devices: data, fetchedAt: Date.now() };
        return data;
      }
    }
  } catch (fetchErr: any) {
    console.warn('[Blob Device Store] Direct fetch fallback:', fetchErr?.message || fetchErr);
  }

  return memoryCache.devices;
}

export async function saveCloudDevices(devices: ConnectedDevice[]): Promise<void> {
  if (!Array.isArray(devices)) return;
  // Guard: NEVER save an empty array if we previously had devices!
  if (devices.length === 0 && memoryCache.devices.length > 0) {
    return;
  }

  memoryCache = { devices, fetchedAt: Date.now() };
  try {
    const blobOptions = getBlobOptions();
    await put(BLOB_PATH, JSON.stringify(devices.slice(0, 50)), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
      ...blobOptions,
    });
  } catch (err: any) {
    console.warn('[Blob Device Store] Cloud save error:', err?.message || err);
  }
}

/**
 * Check if a deviceId is revoked in the cloud registry
 */
export async function checkIsDeviceRevoked(deviceId: string): Promise<boolean> {
  if (!deviceId) return false;
  const devices = await fetchCloudDevices();
  const matched = devices.find((d) => d.deviceId === deviceId);
  return matched?.status === 'revoked';
}

function parseUserAgent(ua: string): string {
  if (!ua) return 'Web Browser';
  if (/iPhone/i.test(ua)) return 'iPhone · iOS Safari';
  if (/iPad/i.test(ua)) return 'iPad · Safari Mobile';
  if (/Android/i.test(ua)) return 'Android · Chrome Mobile';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'MacBook Pro · macOS Safari';
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
    const resolvedRegNumber = regNumber && regNumber !== 'Student Session' ? regNumber : '';

    // 1. Check revocation status (Fast Heartbeat check from client every 1.5s - 2s)
    if (action === 'check_status') {
      const existingIdx = store.findIndex((d) => d.deviceId === deviceId);

      if (existingIdx >= 0) {
        // Update heartbeat and network info in memory
        store[existingIdx].lastActive = new Date().toISOString();
        if (clientIp && clientIp !== 'Direct Connection') {
          store[existingIdx].ip = clientIp;
        }
        if (realLocation && realLocation !== 'Direct Web Session') {
          store[existingIdx].location = realLocation;
        }
        if (resolvedRegNumber && (!store[existingIdx].regNumber || store[existingIdx].regNumber === 'Guest / Login Screen')) {
          store[existingIdx].regNumber = resolvedRegNumber;
        }

        // Check if device is flagged as revoked
        const isRevoked = store[existingIdx].status === 'revoked';

        if (isRevoked) {
          return NextResponse.json({
            success: true,
            revoked: true,
            deviceId,
            message: 'Device access has been revoked by administrator.',
          });
        }
      } else if (deviceId) {
        // Auto-register unseen active client device
        store.unshift({
          deviceId,
          deviceName: resolvedDeviceName,
          regNumber: resolvedRegNumber || 'Active Student',
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
        // CRITICAL ZERO-TRUST RULE: A revoked device CANNOT un-revoke itself by registering!
        const currentStatus = store[existingIdx].status;
        store[existingIdx] = {
          ...store[existingIdx],
          deviceName: resolvedDeviceName,
          lastActive: new Date().toISOString(),
          ip: clientIp,
          location: realLocation,
          regNumber: resolvedRegNumber || store[existingIdx].regNumber,
          status: currentStatus, // PRESERVES 'revoked'!
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
          regNumber: resolvedRegNumber || 'Active Student',
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
