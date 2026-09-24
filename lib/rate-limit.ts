/**
 * Minimal in-memory sliding-window rate limiter.
 * Good enough for a single-process dev / small deployment; swap for Redis
 * (e.g. @upstash/redis) when scaling horizontally.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds to wait before retrying (0 when allowed). */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  // Drop hits outside the window
  bucket.hits = bucket.hits.filter((t) => t > now - windowMs);

  if (bucket.hits.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.hits[0] + windowMs - now) / 1000));
    return { allowed: false, retryAfter };
  }

  bucket.hits.push(now);
  return { allowed: true, retryAfter: 0 };
}

/** Prevent the map from growing forever with stale keys. */
export function sweepRateLimitBuckets(now = Date.now()) {
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => t > now - 60_000);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

// Periodic cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(() => sweepRateLimitBuckets(), 60_000);
}