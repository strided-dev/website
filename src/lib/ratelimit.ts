/* Lightweight in-memory, per-IP sliding-window rate limiter.

   NOTE ON SERVERLESS: this lives in a single function instance's memory, so the
   counters are per-warm-instance, not global. That's enough to stop a naive loop
   hammering one endpoint (the common bot/abuse case) at zero cost and zero extra
   infra. It is NOT a hard guarantee against a distributed attacker spread across
   many cold starts — if this site ever needs that, swap the Map for a shared
   store (Upstash Redis / Vercel KV) behind the same `rateLimit()` signature. */

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

// Opportunistic cleanup so the Map can't grow unbounded across a long-lived
// instance. Runs at most once a minute, on access.
let lastSweep = 0;
const sweep = (now: number) => {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
};

export type RateResult = { ok: boolean; retryAfter: number };

/** Allow `limit` requests per `windowMs` for `key`. retryAfter is in seconds. */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  hit.count += 1;
  if (hit.count > limit) {
    return { ok: false, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from Vercel's proxy headers. */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
