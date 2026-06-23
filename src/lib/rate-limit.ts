// Limiteur de débit en mémoire (best-effort, mono-instance).
// Pour une mise à l'échelle multi-instances, remplacer par Redis/Upstash.

type Hit = { count: number; reset: number };
const store = new Map<string, Hit>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();

  // Purge opportuniste pour éviter une croissance illimitée.
  if (store.size > 5000) {
    for (const [k, v] of store) if (v.reset < now) store.delete(k);
  }

  const hit = store.get(key);
  if (!hit || hit.reset < now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, reset: resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  if (hit.count >= limit) {
    return { ok: false, remaining: 0, resetAt: hit.reset };
  }
  hit.count += 1;
  return { ok: true, remaining: limit - hit.count, resetAt: hit.reset };
}

/** Extrait l'IP cliente depuis les en-têtes proxy usuels. */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
