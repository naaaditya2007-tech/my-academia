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

// Global server memory store of connected devices
let devicesStore: ConnectedDevice[] = [
  {
    deviceId: 'dev_win11_edge',
    deviceName: 'Windows 11 · Chrome/Edge',
    regNumber: 'RA2511026010107',
    ip: '10.1.44.12',
    location: 'SRM Tech Park · Wi-Fi',
    lastActive: new Date().toISOString(),
    status: 'active',
  },
  {
    deviceId: 'dev_ios_iphone15',
    deviceName: 'iPhone 15 Pro · iOS Safari',
    regNumber: 'RA2511026010107',
    ip: '172.16.8.94',
    location: 'UB Academic Block · 5G',
    lastActive: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    deviceId: 'dev_android_pixel',
    deviceName: 'Pixel 8 · Android Chrome',
    regNumber: 'RA2511026010107',
    ip: '10.1.44.19',
    location: 'SRM Library · Wi-Fi',
    lastActive: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
    status: 'active',
  },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    totalCount: devicesStore.length,
    activeCount: devicesStore.filter((d) => d.status === 'active').length,
    devices: devicesStore,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, deviceId, deviceName, regNumber } = body;

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '10.1.44.12';

    if (action === 'check_status') {
      const found = devicesStore.find((d) => d.deviceId === deviceId);
      if (found && found.status === 'revoked') {
        return NextResponse.json({ success: true, revoked: true });
      }
      return NextResponse.json({ success: true, revoked: false });
    }

    if (action === 'revoke') {
      devicesStore = devicesStore.map((d) =>
        d.deviceId === deviceId ? { ...d, status: 'revoked' as const } : d
      );
      return NextResponse.json({
        success: true,
        message: `Device ${deviceId} revoked successfully`,
        devices: devicesStore,
        activeCount: devicesStore.filter((d) => d.status === 'active').length,
      });
    }

    if (action === 'register' && deviceId) {
      const existingIdx = devicesStore.findIndex((d) => d.deviceId === deviceId);
      if (existingIdx >= 0) {
        devicesStore[existingIdx] = {
          ...devicesStore[existingIdx],
          lastActive: new Date().toISOString(),
          ip: clientIp,
        };
      } else {
        devicesStore.unshift({
          deviceId,
          deviceName: deviceName || 'Unknown Device',
          regNumber: regNumber || 'RA2511026010107',
          ip: clientIp,
          location: 'SRM Campus KTR',
          lastActive: new Date().toISOString(),
          status: 'active',
        });
      }
      return NextResponse.json({
        success: true,
        devices: devicesStore,
        activeCount: devicesStore.filter((d) => d.status === 'active').length,
      });
    }

    return NextResponse.json({ success: true, devices: devicesStore });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
