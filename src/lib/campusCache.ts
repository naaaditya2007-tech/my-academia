import { CampusData } from '@/types/campus';

interface CacheEntry {
  data: CampusData;
  expiresAt: number;
}

// In-memory cache for student portal data (30-minute TTL)
const cache = new Map<string, CacheEntry>();

export function getCachedCampusData(netId: string): CampusData | null {
  const cleanId = (netId || '').trim().toLowerCase();
  if (!cleanId) return null;
  const entry = cache.get(cleanId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(cleanId);
    return null;
  }
  return entry.data;
}

export function setCachedCampusData(netId: string, data: CampusData, ttlMs = 30 * 60 * 1000): void {
  const cleanId = (netId || '').trim().toLowerCase();
  if (!cleanId || !data) return;
  cache.set(cleanId, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}
