// Simple in-memory rate limiter — resets per serverless instance.
// Not globally distributed, but catches accidental loops and basic abuse.

const buckets = new Map<string, { count: number; reset: number }>();

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key      Unique key (e.g. `send:${userId}`)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

export function rateLimitResponse() {
  return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta en un momento." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "60" },
  });
}
