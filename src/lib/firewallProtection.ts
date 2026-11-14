/**
 * SRM Firewall & Vercel IP-Ban Protection Engine
 * 
 * 1. 15-Minute Per-Device Sync Cooldown
 * 2. Human-Like Request Throttling & User-Agent Rotation (400ms-900ms jitter)
 * 3. SRM Firewall Circuit Breaker (Auto-trips on 403 / 429 / 503 for 10 minutes)
 * 4. Automatic sync quiet hours (Sundays & 7:00 PM – 7:00 AM IST)
 */

export const REALISTIC_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UQ1A.240205.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
];

export function getRandomUserAgent(): string {
  const idx = Math.floor(Math.random() * REALISTIC_USER_AGENTS.length);
  return REALISTIC_USER_AGENTS[idx];
}

/**
 * Human-like randomized jitter delay (400ms - 900ms) between sequential portal requests
 */
export const sleepJitter = (minMs = 400, maxMs = 900): Promise<void> => {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export interface CircuitBreakerState {
  isTripped: boolean;
  trippedAt: number | null;
  resetAt: number | null;
  reason: string | null;
  statusCode: number | null;
}

let circuitBreaker: CircuitBreakerState = {
  isTripped: false,
  trippedAt: null,
  resetAt: null,
  reason: null,
  statusCode: null,
};

export function getCircuitBreakerState(): CircuitBreakerState {
  // Auto-reset when 10-minute timeout expires
  if (circuitBreaker.isTripped && circuitBreaker.resetAt && Date.now() >= circuitBreaker.resetAt) {
    circuitBreaker = {
      isTripped: false,
      trippedAt: null,
      resetAt: null,
      reason: null,
      statusCode: null,
    };
  }
  return { ...circuitBreaker };
}

export function tripCircuitBreaker(statusCode: number, reason?: string): CircuitBreakerState {
  const now = Date.now();
  const resetAt = now + 10 * 60 * 1000; // 10 minutes strictly enforced
  circuitBreaker = {
    isTripped: true,
    trippedAt: now,
    resetAt,
    reason: reason || `SRM Firewall Block / Rate Limit Triggered (HTTP ${statusCode})`,
    statusCode,
  };
  return { ...circuitBreaker };
}

export function resetCircuitBreaker(): CircuitBreakerState {
  circuitBreaker = {
    isTripped: false,
    trippedAt: null,
    resetAt: null,
    reason: null,
    statusCode: null,
  };
  return { ...circuitBreaker };
}

// 15-Minute Cooldown State
export const SYNC_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes per-device

const serverCooldownMap = new Map<string, number>();

export function checkServerCooldown(clientIdentifier: string): { allowed: boolean; remainingSec: number } {
  const lastSync = serverCooldownMap.get(clientIdentifier) || 0;
  const elapsed = Date.now() - lastSync;
  if (elapsed < SYNC_COOLDOWN_MS) {
    return {
      allowed: false,
      remainingSec: Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000),
    };
  }
  return { allowed: true, remainingSec: 0 };
}

export function recordServerSync(clientIdentifier: string) {
  serverCooldownMap.set(clientIdentifier, Date.now());
}

/**
 * Checks if current time is within portal quiet hours in Indian Standard Time (IST):
 * 1. All day Sunday (SRM attendance server never processes weekend entries)
 * 2. Between 7:00 PM and 7:00 AM IST (outside active faculty working window)
 */
export function isQuietSyncPeriod(): { isQuiet: boolean; reason?: string } {
  const now = new Date();
  // Compute IST Date (UTC + 5:30)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 5.5 * 3600000);

  const day = istDate.getDay(); // 0 = Sunday
  const hour = istDate.getHours(); // 0 - 23

  if (day === 0) {
    return {
      isQuiet: true,
      reason: 'Sunday Portal Pause · SRM attendance is never updated on weekends',
    };
  }

  if (hour >= 19 || hour < 7) {
    return {
      isQuiet: true,
      reason: 'Night Window (7:00 PM – 7:00 AM IST) · Attendance only updates during working hours',
    };
  }

  return { isQuiet: false };
}
