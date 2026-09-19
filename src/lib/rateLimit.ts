/**
 * Simple in-memory fixed-window rate limiter.
 *
 * IMPORTANT: this only limits requests within a single running server process.
 * On Vercel's serverless/multi-instance deployment this does NOT provide a real
 * global limit — for production, replace with a shared store (e.g. Upstash Redis)
 * behind the same `checkRateLimit()` function signature so no caller needs to change.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

const hits = new Map<string, { count: number; windowStart: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, maxPerWindow = MAX_REQUESTS_PER_WINDOW): RateLimitResult {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    hits.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxPerWindow - 1, retryAfterMs: 0 };
  }

  if (entry.count >= maxPerWindow) {
    return { allowed: false, remaining: 0, retryAfterMs: WINDOW_MS - (now - entry.windowStart) };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxPerWindow - entry.count, retryAfterMs: 0 };
}

export function clientKeyFromRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() ?? "unknown";
}
