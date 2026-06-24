import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Débit : la capture est mise en cache 1 jour côté client, donc ces appels sont
// rares en usage normal. On borne tout de même pour protéger le quota ApiFlash.
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 5 * 60_000;

/** Hôtes privés / loopback / link-local à refuser (défense en profondeur). */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) {
    return true;
  }
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true; // loopback / privé / "this host"
    if (a === 169 && b === 254) return true; // link-local
    if (a === 192 && b === 168) return true; // privé
    if (a === 172 && b >= 16 && b <= 31) return true; // privé
  }
  return false;
}

/**
 * Proxy de capture d'écran ApiFlash.
 *
 * Le `fetch` ne vise QUE `api.apiflash.com` : notre serveur n'atteint jamais la
 * cible (c'est l'infra ApiFlash qui la rend). Pour éviter de servir d'open proxy
 * et d'épuiser le quota de la clé, l'URL demandée doit correspondre à une analyse
 * existante en base, l'appel est limité en débit par IP, et les hôtes privés sont
 * refusés.
 *
 * Usage : <img src="/api/screenshot?url=https%3A%2F%2Fexemple.com" />
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target) {
    return NextResponse.json({ error: "Paramètre url manquant." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "URL invalide." }, { status: 400 });
  }

  // Protocole, port et hôte : on reste sur du web public standard.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Protocole non autorisé." }, { status: 400 });
  }
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    return NextResponse.json({ error: "Port non autorisé." }, { status: 400 });
  }
  if (isPrivateHost(parsed.hostname)) {
    return NextResponse.json({ error: "Hôte non autorisé." }, { status: 400 });
  }

  const ip = clientIp(request);
  if (!rateLimit(`shot:${ip}`, RATE_LIMIT, RATE_WINDOW_MS).ok) {
    return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
  }

  // Liaison à la base : on ne capture que des URLs réellement analysées
  // (site audité ou fiche Maps fournie). Empêche l'usage en open proxy.
  const known = await prisma.analysis.findFirst({
    where: { OR: [{ url: target }, { mapsUrl: target }] },
    select: { id: true },
  });
  if (!known) {
    return NextResponse.json({ error: "URL non reconnue." }, { status: 403 });
  }

  const accessKey = process.env.API_FLASH_KEY;
  if (!accessKey) {
    return NextResponse.json({ error: "ApiFlash non configuré." }, { status: 503 });
  }

  const params = new URLSearchParams({
    access_key: accessKey,
    url: target,
    format: "jpeg",
    quality: "85",
    width: "1280",
    height: "800",
    response_type: "image",
    wait_until: "page_loaded",
    no_cookie_banners: "true",
    no_ads: "true",
    fail_on_status: "400,404,500-511",
  });

  const res = await fetch(`https://api.apiflash.com/v1/urltoimage?${params}`, {
    signal: AbortSignal.timeout(40_000),
  });

  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "Capture indisponible." }, { status: 502 });
  }

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
      // Cache 1 jour côté navigateur/CDN, revalidation en arrière-plan.
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
