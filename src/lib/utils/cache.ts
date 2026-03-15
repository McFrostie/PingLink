/**
 * Returns true if data should be re-fetched:
 *  - `ts` is null (never fetched), OR
 *  - more than `ttlMs` milliseconds have elapsed since `ts`
 */
export function isStale(ts: number | null, ttlMs: number): boolean {
  if (ts === null) return true;
  return Date.now() - ts > ttlMs;
}
