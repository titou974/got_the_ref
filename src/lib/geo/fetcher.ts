import * as cheerio from "cheerio";
import dns from "node:dns/promises";
import net from "node:net";
import type { CrawlerAccess, SiteSignals } from "./types";

const UA =
  "Mozilla/5.0 (compatible; GEOBoost-Analyzer/1.0; +https://boostgeo.fr)";
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 4;

/** Erreur dédiée : URL pointant vers une cible interdite (anti-SSRF). */
export class BlockedUrlError extends Error {
  constructor(message = "URL non autorisée") {
    super(message);
    this.name = "BlockedUrlError";
  }
}

function ipv4IsPrivate(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true; // 0/8, 10/8, loopback
  if (a === 169 && b === 254) return true; // link-local 169.254/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  return false;
}

function ipv6IsPrivate(ip: string): boolean {
  const low = ip.toLowerCase();
  if (low === "::1" || low === "::") return true; // loopback / unspecified
  if (low.startsWith("fe80") || low.startsWith("fe9") || low.startsWith("fea") || low.startsWith("feb"))
    return true; // link-local fe80::/10
  if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA fc00::/7
  // IPv4-mappé ::ffff:a.b.c.d
  const mapped = low.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPrivate(mapped[1]);
  return false;
}

function isBlockedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return ipv4IsPrivate(ip);
  if (version === 6) return ipv6IsPrivate(ip);
  return true; // format inconnu → bloqué par précaution
}

/** Vérifie qu'un hostname résout uniquement vers des adresses publiques. */
async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new BlockedUrlError();
    return;
  }
  let records: { address: string }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new BlockedUrlError("Domaine introuvable.");
  }
  if (records.length === 0 || records.some((r) => isBlockedIp(r.address))) {
    throw new BlockedUrlError();
  }
}

/** Valide une URL avant toute requête : schéma http(s) + hôte public. */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError("URL invalide.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new BlockedUrlError("Seules les URL http(s) sont autorisées.");
  }
  await assertPublicHost(u.hostname);
}

// Crawlers IA critiques (référence skill geo-crawlers)
const AI_CRAWLERS: { name: string; operator: string }[] = [
  { name: "GPTBot", operator: "OpenAI" },
  { name: "OAI-SearchBot", operator: "OpenAI" },
  { name: "ChatGPT-User", operator: "OpenAI" },
  { name: "ClaudeBot", operator: "Anthropic" },
  { name: "PerplexityBot", operator: "Perplexity" },
  { name: "Google-Extended", operator: "Google" },
];

export function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  const parsed = new URL(u);
  return parsed.origin + parsed.pathname.replace(/\/$/, "");
}

/**
 * Fetch protégé contre le SSRF : valide schéma + hôte public à chaque saut,
 * suit les redirections manuellement (revalidation à chaque hop).
 */
async function safeFetch(url: string): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new BlockedUrlError("Schéma non autorisé.");
    }
    await assertPublicHost(u.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue; // la cible de redirection est revalidée au tour suivant
    }
    return res;
  }
  throw new BlockedUrlError("Trop de redirections.");
}

/** Extrait les types JSON-LD d'une page chargée par cheerio. */
function jsonLdTypesOf($: cheerio.CheerioAPI): string[] {
  const types: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of arr) {
        const t = node["@type"];
        if (typeof t === "string") types.push(t);
        else if (Array.isArray(t)) types.push(...t.filter((x) => typeof x === "string"));
        if (Array.isArray(node["@graph"])) {
          for (const g of node["@graph"]) {
            if (typeof g["@type"] === "string") types.push(g["@type"]);
          }
        }
      }
    } catch {
      /* JSON-LD invalide ignoré */
    }
  });
  return [...new Set(types)];
}

/** Nombre de mots du contenu principal d'une page. */
function wordCountOf($: cheerio.CheerioAPI): number {
  const clone = $.root().clone();
  clone.find("script,style,noscript,svg").remove();
  const text = clone.text().replace(/\s+/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

// Pages à privilégier pour le crawl (signaux d'architecture forts).
const PRIORITY_PATH = /(about|a-propos|apropos|faq|service|prestation|menu|carte|contact|tarif|price|avis|review)/i;
const MAX_CRAWL_PAGES = 4; // page d'accueil incluse

/** Sélectionne les liens internes les plus pertinents pour le crawl. */
function pickInternalLinks($: cheerio.CheerioAPI, origin: string, homeUrl: string): string[] {
  const seen = new Set<string>([homeUrl]);
  const found: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: URL;
    try {
      abs = new URL(href, homeUrl);
    } catch {
      return;
    }
    if (abs.origin !== origin) return;
    if (!/^https?:$/.test(abs.protocol)) return;
    const clean = abs.origin + abs.pathname.replace(/\/$/, "");
    if (seen.has(clean) || clean === origin) return;
    if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|mp4|mp3)$/i.test(abs.pathname)) return;
    seen.add(clean);
    found.push(clean);
  });
  // priorise les pages à fort signal, puis complète par les premières trouvées
  const priority = found.filter((u) => PRIORITY_PATH.test(u));
  const rest = found.filter((u) => !PRIORITY_PATH.test(u));
  return [...new Set([...priority, ...rest])];
}

/**
 * Récupère une ressource racine (robots/sitemap/llms) en tolérant le cas où le
 * fichier n'est servi qu'en HTTP alors que le site est en HTTPS : on tente
 * d'abord l'origine telle quelle, puis on retombe sur http en dernier recours.
 */
async function fetchWithHttpFallback(
  url: string,
): Promise<{ res: Response | null; viaHttpFallback: boolean }> {
  try {
    const res = await safeFetch(url);
    if (res.ok) return { res, viaHttpFallback: false };
  } catch {
    /* on tente le repli http */
  }
  if (url.startsWith("https://")) {
    try {
      const res = await safeFetch("http://" + url.slice("https://".length));
      if (res.ok) return { res, viaHttpFallback: true };
    } catch {
      /* échec définitif */
    }
  }
  return { res: null, viaHttpFallback: false };
}

/** Le corps ressemble-t-il à un vrai llms.txt (markdown, pas une page HTML) ? */
function looksLikeLlmsTxt(body: string): boolean {
  const t = body.trim();
  if (!t || t.startsWith("<")) return false; // page HTML (404 SPA) → non
  return t.startsWith("#") && t.length > 30 && (/\]\(/.test(t) || /^>/m.test(t));
}

/**
 * Détecte un llms.txt en distinguant trois cas :
 *  - servi correctement (statut 200 + contenu) → `served`
 *  - contenu présent mais statut ≠ 200 (ex. 404) → `misconfigured` (les IA l'ignorent)
 *  - absent.
 * Teste https puis http (au cas où seul http réponde).
 */
async function detectLlmsTxt(
  origin: string,
): Promise<{ served: boolean; misconfigured: boolean }> {
  const candidates = [
    origin + "/llms.txt",
    origin.startsWith("https://") ? "http://" + origin.slice("https://".length) + "/llms.txt" : null,
  ].filter((u): u is string => !!u);

  let misconfigured = false;
  for (const url of candidates) {
    try {
      const res = await safeFetch(url);
      const body = await res.text().catch(() => "");
      if (res.ok && body.trim().length > 0 && !body.trim().startsWith("<")) {
        return { served: true, misconfigured: false };
      }
      if (!res.ok && looksLikeLlmsTxt(body)) misconfigured = true;
    } catch {
      /* candidat suivant */
    }
  }
  return { served: false, misconfigured };
}

function parseRobots(robotsTxt: string): CrawlerAccess[] {
  // Analyse simplifiée : un crawler est bloqué s'il a un bloc User-agent
  // explicite avec Disallow: / (ou si User-agent: * bloque tout).
  const lines = robotsTxt.split("\n").map((l) => l.trim());
  let globalBlocked = false;
  const blockedAgents = new Set<string>();
  let currentAgents: string[] = [];

  for (const line of lines) {
    if (/^user-agent:/i.test(line)) {
      currentAgents.push(line.split(":")[1]?.trim().toLowerCase() ?? "");
    } else if (/^disallow:/i.test(line)) {
      const path = line.split(":")[1]?.trim() ?? "";
      if (path === "/") {
        for (const a of currentAgents) {
          if (a === "*") globalBlocked = true;
          else blockedAgents.add(a);
        }
      }
      currentAgents = [];
    } else if (line === "" ) {
      currentAgents = [];
    }
  }

  return AI_CRAWLERS.map((c) => {
    const explicitlyBlocked = blockedAgents.has(c.name.toLowerCase());
    return {
      name: c.name,
      operator: c.operator,
      allowed: !(explicitlyBlocked || globalBlocked),
    };
  });
}

export async function collectSignals(inputUrl: string): Promise<SiteSignals> {
  const url = normalizeUrl(inputUrl);
  const origin = new URL(url).origin;
  const domain = new URL(url).hostname.replace(/^www\./, "");

  const base: SiteSignals = {
    url,
    domain,
    fetchedOk: false,
    statusCode: null,
    title: null,
    metaDescription: null,
    h1: [],
    headingCount: 0,
    wordCount: 0,
    hasHttps: url.startsWith("https://"),
    hasViewport: false,
    hasRobotsTxt: false,
    hasSitemap: false,
    hasLlmsTxt: false,
    llmsTxtMisconfigured: false,
    jsonLdTypes: [],
    jsonLdCount: 0,
    hasOpenGraph: false,
    imagesWithoutAlt: 0,
    crawlers: AI_CRAWLERS.map((c) => ({ ...c, allowed: true })),
    textSample: "",
    crawl: {
      pagesCrawled: 0,
      sampledUrls: [],
      schemaTypes: [],
      hasFaqSchema: false,
      totalWordCount: 0,
      internalLinks: 0,
    },
  };

  let crawlCandidates: string[] = [];

  // 1. Page principale
  let html = "";
  try {
    const res = await safeFetch(url);
    base.statusCode = res.status;
    base.fetchedOk = res.ok;
    if (res.ok) html = await res.text();
  } catch {
    base.fetchedOk = false;
  }

  if (html) {
    const $ = cheerio.load(html);
    base.title = $("title").first().text().trim() || null;
    base.metaDescription =
      $('meta[name="description"]').attr("content")?.trim() || null;
    base.hasViewport = $('meta[name="viewport"]').length > 0;
    base.hasOpenGraph = $('meta[property^="og:"]').length > 0;
    base.h1 = $("h1")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 5);
    base.headingCount = $("h1,h2,h3,h4").length;

    $("img").each((_, el) => {
      const alt = $(el).attr("alt");
      if (!alt || alt.trim() === "") base.imagesWithoutAlt += 1;
    });

    // JSON-LD
    const types: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).text());
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (const node of arr) {
          const t = node["@type"];
          if (typeof t === "string") types.push(t);
          else if (Array.isArray(t)) types.push(...t.filter((x) => typeof x === "string"));
          if (Array.isArray(node["@graph"])) {
            for (const g of node["@graph"]) {
              if (typeof g["@type"] === "string") types.push(g["@type"]);
            }
          }
        }
      } catch {
        /* JSON-LD invalide ignoré */
      }
    });
    base.jsonLdTypes = [...new Set(types)];
    base.jsonLdCount = base.jsonLdTypes.length;

    // Liens internes pour le crawl multi-pages (avant de retirer le contenu).
    crawlCandidates = pickInternalLinks($, origin, url);
    base.crawl.internalLinks = crawlCandidates.length;

    // Texte principal pour l'IA
    $("script,style,noscript,svg").remove();
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    base.wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
    base.textSample = bodyText.slice(0, 6000);

    // Synthèse de crawl : la page d'accueil compte comme 1ʳᵉ page.
    base.crawl.pagesCrawled = 1;
    base.crawl.sampledUrls = [url];
    base.crawl.schemaTypes = [...base.jsonLdTypes];
    base.crawl.hasFaqSchema = base.jsonLdTypes.some((t) => /faq/i.test(t));
    base.crawl.totalWordCount = base.wordCount;
  }

  // 2. robots.txt (repli http si nécessaire)
  {
    const { res } = await fetchWithHttpFallback(origin + "/robots.txt");
    if (res) {
      const robots = await res.text();
      base.hasRobotsTxt = robots.toLowerCase().includes("user-agent");
      base.hasSitemap = /sitemap:/i.test(robots);
      base.crawlers = parseRobots(robots);
    }
  }

  // 3. sitemap.xml (fallback si non déclaré dans robots)
  if (!base.hasSitemap) {
    const { res } = await fetchWithHttpFallback(origin + "/sitemap.xml");
    base.hasSitemap = !!res;
  }

  // 4. llms.txt (standard émergent) — distingue « bien servi (200) » de
  //    « contenu présent mais statut 404 » (ce dernier est ignoré par les IA).
  {
    const llms = await detectLlmsTxt(origin);
    base.hasLlmsTxt = llms.served;
    base.llmsTxtMisconfigured = llms.misconfigured;
  }

  // 5. Crawl multi-pages (gratuit) : explore quelques pages internes clés pour
  //    nourrir l'analyse d'architecture/contenu. Best-effort, plafonné, séquentiel.
  const schemaAgg = new Set(base.crawl.schemaTypes);
  for (const pageUrl of crawlCandidates) {
    if (base.crawl.pagesCrawled >= MAX_CRAWL_PAGES) break;
    try {
      const res = await safeFetch(pageUrl);
      if (!res.ok) continue;
      const pageHtml = await res.text();
      if (!pageHtml) continue;
      const $p = cheerio.load(pageHtml);
      for (const t of jsonLdTypesOf($p)) schemaAgg.add(t);
      if (jsonLdTypesOf($p).some((t) => /faq/i.test(t))) base.crawl.hasFaqSchema = true;
      base.crawl.totalWordCount += wordCountOf($p);
      base.crawl.sampledUrls.push(pageUrl);
      base.crawl.pagesCrawled += 1;
    } catch {
      /* page ignorée */
    }
  }
  base.crawl.schemaTypes = [...schemaAgg];

  return base;
}
