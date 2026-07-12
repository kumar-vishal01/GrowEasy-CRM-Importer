import { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_MINUTE || 20);

const buckets = new Map<string, Bucket>();

// Without this sweep, `buckets` grows forever — one entry per distinct IP
// ever seen — which is a slow memory leak on a long-running server. A
// lazy sweep on a cadence is enough for a single-instance deployment;
// a Redis-backed limiter with TTLs is the fix for a multi-instance one.
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweep = Date.now();

function sweepExpiredBuckets(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS) buckets.delete(key);
  }
}

/**
 * Minimal per-IP fixed-window rate limiter. Sufficient for a single-instance
 * deployment; swap for a Redis-backed limiter behind a load balancer.
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || "unknown";
  const now = Date.now();
  sweepExpiredBuckets(now);
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    next();
    return;
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = WINDOW_MS - (now - bucket.windowStart);
    res.status(429).json({
      success: false,
      error: "rate_limited",
      message: "Too many import requests. Please slow down.",
      retryAfterMs,
    });
    return;
  }

  bucket.count += 1;
  next();
}
