import "server-only";

import { assertPublicUrl, BlockedUrlError } from "./fetcher";
import type { MapsListing } from "./types";

/**
 * Hôtes reconnus comme des liens Google Maps (fiches d'établissement ou
 * liens de partage courts).
 */
const GOOGLE_MAPS_HOSTS = [
  "google.com",
  "www.google.com",
  "maps.google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "g.co",
];

/** Indique si l'URL ressemble à un lien Google Maps valide. */
export function isGoogleMapsUrl(raw: string): boolean {
  try {
    const u = new URL(raw.match(/^https?:\/\//i) ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase();
    const isMapsHost = GOOGLE_MAPS_HOSTS.includes(host);
    // google.com n'est un lien Maps que sur le chemin /maps
    if (host === "google.com" || host === "www.google.com") {
      return u.pathname.startsWith("/maps");
    }
    return isMapsHost;
  } catch {
    return false;
  }
}

/**
 * Normalise un lien Maps facultatif.
 * Retourne `null` si vide, ou lève une erreur si le lien est invalide.
 */
export function normalizeMapsUrl(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  if (!isGoogleMapsUrl(trimmed)) {
    throw new InvalidMapsUrlError();
  }

  const u = new URL(trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`);
  return u.toString();
}

export class InvalidMapsUrlError extends Error {
  constructor() {
    super("Lien Google Maps invalide.");
    this.name = "InvalidMapsUrlError";
  }
}

const MAPS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAPS_TIMEOUT_MS = 12000;

function parseFrNumber(raw: string): number | null {
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Scraping best-effort d'une fiche Google Maps : récupère nom, note et nombre
 * d'avis quand c'est possible. Gratuit et tolérant aux pannes — renvoie
 * `scraped: false` si rien d'exploitable (Google rend la fiche en JS, le HTML
 * brut ne contient pas toujours les chiffres).
 */
export async function scrapeMapsListing(mapsUrl: string): Promise<MapsListing> {
  const empty: MapsListing = { listingName: null, rating: null, reviewCount: null, scraped: false };
  let target: string;
  try {
    target = normalizeMapsUrl(mapsUrl) ?? "";
  } catch {
    return empty;
  }
  if (!target) return empty;

  // Encourage une réponse FR.
  try {
    const u = new URL(target);
    if (!u.searchParams.has("hl")) u.searchParams.set("hl", "fr");
    target = u.toString();
  } catch {
    /* on garde l'URL telle quelle */
  }

  let html = "";
  try {
    await assertPublicUrl(target);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MAPS_TIMEOUT_MS);
    try {
      const res = await fetch(target, {
        headers: { "User-Agent": MAPS_UA, "Accept-Language": "fr-FR,fr;q=0.9" },
        redirect: "follow",
        signal: controller.signal,
      });
      if (res.ok) html = await res.text();
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if (err instanceof BlockedUrlError) return empty;
    return empty;
  }
  if (!html) return empty;

  const out: MapsListing = { ...empty };

  // Nom : balise og:title puis <title>.
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawName = (ogTitle?.[1] || title?.[1] || "").replace(/\s*[-–|]\s*Google Maps.*$/i, "").trim();
  if (rawName) out.listingName = rawName;

  // Note : motifs « 4,6 », « 4.6 » associés à étoiles / avis.
  const ratingMatch =
    html.match(/(\d[.,]\d)\s*(?:★|étoiles?|stars?)/i) ||
    html.match(/["']ratingValue["']\s*[:=]\s*["']?(\d[.,]\d)/i) ||
    html.match(/(\d[.,]\d)\s*(?:sur|\/)\s*5/i);
  if (ratingMatch) {
    const r = parseFloat(ratingMatch[1].replace(",", "."));
    if (r >= 0 && r <= 5) out.rating = r;
  }

  // Nombre d'avis : « 1 234 avis », « 1,234 reviews », ratingCount.
  const reviewMatch =
    html.match(/([\d][\d\s.,]{0,9})\s*(?:avis|reviews|avaliações)/i) ||
    html.match(/["'](?:reviewCount|ratingCount)["']\s*[:=]\s*["']?([\d.,]+)/i);
  if (reviewMatch) {
    const n = parseFrNumber(reviewMatch[1]);
    if (n && n > 0) out.reviewCount = n;
  }

  out.scraped = out.listingName != null || out.rating != null || out.reviewCount != null;
  return out;
}
