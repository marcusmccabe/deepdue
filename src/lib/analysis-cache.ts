/**
 * In-memory analysis cache — server-side only.
 *
 * Keyed by uppercase company number. Entries expire after CACHE_TTL_MS.
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

const cache = new Map<string, CacheEntry>();

export function getCachedAnalysis(companyNumber: string): AccountsAnalysis | null {
  const key = companyNumber.toUpperCase();
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
  cache.set(companyNumber.toUpperCase(), {
    data: { ...data, cached: false },
    timestamp: Date.now(),
  });
}

export function clearCachedAnalysis(companyNumber: string): void {
  cache.delete(companyNumber.toUpperCase());
}
