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

/**
 * Extrait l'IP cliente depuis les en-têtes proxy.
 *
 * `X-Forwarded-For` est une liste que le client contrôle à gauche : lire la
 * première entrée laisse n'importe qui se donner une IP neuve à chaque requête
 * et contourner les quotas (analyse anonyme, capture d'écran).
 *
 * Ordre de confiance décroissante :
 *  1. `x-vercel-forwarded-for`, posé par la plateforme et jamais transmis depuis
 *     le client ;
 *  2. la DERNIÈRE entrée de `X-Forwarded-For` — celle ajoutée par le proxy de
 *     confiance le plus proche de nous, donc hors de portée du client ;
 *  3. `x-real-ip` en dernier recours : un client peut l'envoyer lui-même, seul
 *     un proxy qui l'écrase le rend fiable.
 */
export function clientIp(request: Request): string {
  const platform = request.headers.get("x-vercel-forwarded-for");
  if (platform) return platform.trim();

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
