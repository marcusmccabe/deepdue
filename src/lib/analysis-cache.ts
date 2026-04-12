/**
 * In-memory analysis cache — server-side only.
 *
 * Keyed by "v2:{COMPANY_NUMBER}" — the v2 prefix automatically invalidates
 * any v1 cached results from the previous schema version.
 *
 * In a Vercel serverless deployment each function instance has its own
 * Map, so cache hits happen within the same warm instance. For persistent
 * cross-instance caching, swap this for Redis/Upstash.
 */
import type { AccountsAnalysis } from "./analysis-types";

interface CacheEntry {
  data: AccountsAnalysis;
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const VERSION = "v2";

const cache = new Map<string, CacheEntry>();

function cacheKey(companyNumber: string): string {
  return `${VERSION}:${companyNumber.toUpperCase()}`;
}

export function getCachedAnalysis(companyNumber: string): AccountsAnalysis | null {
  const key = cacheKey(companyNumber);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return { ...entry.data, cached: true };
}

export function setCachedAnalysis(
  companyNumber: string,
  data: AccountsAnalysis
): void {
  cache.set(cacheKey(companyNumber), {
    data: { ...data, cached: false },
    timestamp: Date.now(),
  });
}

export function clearCachedAnalysis(companyNumber: string): void {
  cache.delete(cacheKey(companyNumber));
}
