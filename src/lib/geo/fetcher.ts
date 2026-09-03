import * as cheerio from "cheerio";
import dns from "node:dns/promises";
import net from "node:net";
import type { CrawlerAccess, SiteSignals } from "./types";
import { detectStack } from "./stack";

const UA =
  "Mozilla/5.0 (compatible; GotTheRef-Analyzer/1.0; +https://gottheref.fr)";
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

/**
 * Collecte récursivement TOUS les @type d'un arbre JSON-LD, y compris ceux
 * IMBRIQUÉS dans des propriétés (aggregateRating, review, address, geo,
 * openingHoursSpecification…). Sans ça, un nœud « Restaurant » contenant un
 * AggregateRating/Review masque ces schémas (faux « schéma absent »).
 */
function collectJsonLdTypes(node: unknown, acc: Set<string>): void {
  if (Array.isArray(node)) {
    for (const n of node) collectJsonLdTypes(n, acc);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") acc.add(t);
    else if (Array.isArray(t)) for (const x of t) if (typeof x === "string") acc.add(x);
    for (const [k, v] of Object.entries(obj)) {
      if (k !== "@type") collectJsonLdTypes(v, acc);
    }
  }
}

/** Extrait les types JSON-LD d'une page chargée par cheerio (imbriqués inclus). */
function jsonLdTypesOf($: cheerio.CheerioAPI): string[] {
  const acc = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      collectJsonLdTypes(JSON.parse($(el).text()), acc);
    } catch {
      /* JSON-LD invalide ignoré */
    }
  });
  return [...acc];
}

/** Extrait la note moyenne déclarée (AggregateRating) dans le JSON-LD. */
function aggregateRatingFromJsonLd($: cheerio.CheerioAPI): string | null {
  let hint: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (hint) return false;
    try {
      for (const node of flattenJsonLd(JSON.parse($(el).text()))) {
        const ar = node.aggregateRating;
        if (ar && typeof ar === "object") {
          const r = ar as Record<string, unknown>;
          const value = r.ratingValue != null ? String(r.ratingValue) : null;
          const count = r.reviewCount ?? r.ratingCount;
          if (value) {
            hint = count != null ? `${value}/5 · ${count} avis` : `${value}/5`;
            return false;
          }
        }
      }
    } catch {
      /* JSON-LD invalide ignoré */
    }
  });
  return hint;
}

/**
 * Détecte une vraie SECTION FAQ sur la page (éditoriale, pas seulement un
 * schéma FAQPage) : accordéons <details>/<summary>, conteneurs « faq »/
 * « accordion », un intitulé « foire aux questions / questions fréquentes »,
 * ou un bloc avec plusieurs questions (lignes terminées par « ? »).
 */
function detectFaqSection($: cheerio.CheerioAPI): boolean {
  // 1. Marqueurs structurels explicites (classe/id/aria) ou accordéon natif.
  if ($("details summary").length >= 1) return true;
  if (
    $(
      '[class*="faq" i],[id*="faq" i],[class*="accordion" i],[class*="accordeon" i],[class*="accordéon" i]',
    ).length > 0
  ) {
    return true;
  }

  // 2. Intitulé de section FAQ dans un titre.
  const headings = $("h1,h2,h3,h4,summary,button,[role='heading']")
    .map((_, el) => $(el).text().trim().toLowerCase())
    .get();
  const faqHeading = headings.some(
    (h) =>
      h === "faq" ||
      /foire aux questions|questions fréquentes|questions frequentes|questions\s*\/\s*réponses|questions courantes|vos questions/.test(
        h,
      ),
  );
  if (faqHeading) return true;

  // 3. Heuristique de repli : plusieurs intitulés formulés en question.
  const questionHeadings = headings.filter((h) => h.length > 8 && h.endsWith("?"));
  return questionHeadings.length >= 3;
}

/**
 * Détecte une SECTION AVIS / TÉMOIGNAGES sur la page d'accueil : conteneurs
 * « avis »/« review »/« testimonial », schéma Review/Rating, un intitulé dédié,
 * ou des marqueurs de notation (étoiles, « note 4,8/5 », « X avis »).
 */
function detectReviewsSection($: cheerio.CheerioAPI): boolean {
  // 1. Marqueurs structurels (classe/id).
  if (
    $(
      '[class*="avis" i],[id*="avis" i],[class*="review" i],[id*="review" i],[class*="testimonial" i],[class*="temoignage" i],[class*="témoignage" i],[class*="rating" i],[class*="stars" i]',
    ).length > 0
  ) {
    return true;
  }

  // 2. Schéma structuré Review / AggregateRating.
  if (jsonLdTypesOf($).some((t) => /review|rating/i.test(t))) return true;

  // 3. Intitulé de section dédié.
  const headings = $("h1,h2,h3,h4")
    .map((_, el) => $(el).text().trim().toLowerCase())
    .get();
  const reviewHeading = headings.some((h) =>
    /avis|témoignages|temoignages|ils nous font confiance|ce qu'ils (en )?disent|ce qu'ils pensent|nos clients|notes? clients?|reviews|testimonials/.test(
      h,
    ),
  );
  if (reviewHeading) return true;

  // 4. Marqueurs de notation dans le texte (étoiles, « 4,8/5 », « 120 avis »).
  const text = $("body").text().replace(/\s+/g, " ").toLowerCase();
  if (/[★⭐]/.test(text)) return true;
  if (/\b\d(?:[.,]\d)?\s*\/\s*5\b/.test(text)) return true;
  if (/\b\d{1,5}\s*avis\b/.test(text)) return true;
  return false;
}

/**
 * Première phrase du premier paragraphe substantiel de la ZONE PRINCIPALE.
 * On cherche dans <main>/[role=main]/<article>/<section> en priorité (puis
 * <body> en dernier recours), en excluant toujours header/nav/footer/aside :
 * la phrase d'intro qui compte est celle du contenu, pas du chrome.
 */
function firstParagraphSentence($: cheerio.CheerioAPI): string | null {
  const EXCLUDE = "header, nav, footer, aside";
  const roots = ["main", '[role="main"]', "article", "section", "body"];
  let best: string | null = null;

  for (const root of roots) {
    $(root)
      .find("p")
      .each((_, el) => {
        if (best) return false;
        const $el = $(el);
        if ($el.closest(EXCLUDE).length) return; // ignore header/nav/footer/aside
        const txt = $el.text().replace(/\s+/g, " ").trim();
        if (txt.length >= 40) {
          best = txt;
          return false; // 1ᵉʳ paragraphe substantiel trouvé → on s'arrête
        }
      });
    if (best) break;
  }
  if (!best) return null;

  // On garde la 1ʳᵉ phrase (jusqu'au point), bornée pour rester lisible.
  const sentence = (best as string).split(/(?<=[.!?])\s+/)[0] ?? best;
  return sentence.length > 300 ? sentence.slice(0, 300).trim() + "…" : sentence;
}

/** Aplatit un arbre JSON-LD (tableaux + @graph) en une liste de nœuds objets. */
function flattenJsonLd(parsed: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      out.push(obj);
      if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(visit);
    }
  };
  visit(parsed);
  return out;
}

/** Extrait les horaires d'ouverture déclarés dans le JSON-LD (indice). */
function openingHoursFromJsonLd($: cheerio.CheerioAPI): string | null {
  const out: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      for (const node of flattenJsonLd(JSON.parse($(el).text()))) {
        const oh = node.openingHours;
        if (typeof oh === "string") out.push(oh);
        else if (Array.isArray(oh)) out.push(...oh.filter((x): x is string => typeof x === "string"));

        const spec = node.openingHoursSpecification;
        const specs = Array.isArray(spec) ? spec : spec ? [spec] : [];
        for (const sp of specs as Record<string, unknown>[]) {
          const day = sp.dayOfWeek;
          const days = Array.isArray(day)
            ? day.map((d) => String(d).replace(/^https?:\/\/schema\.org\//, "")).join(", ")
            : day
              ? String(day).replace(/^https?:\/\/schema\.org\//, "")
              : "";
          const fmt = (v: unknown) => String(v ?? "").replace(/^T/, "").replace(/:00$/, "h").replace(":", "h");
          const opens = sp.opens ? fmt(sp.opens) : "";
          const closes = sp.closes ? fmt(sp.closes) : "";
          if (days && (opens || closes)) out.push(`${days} ${opens}–${closes}`.trim());
        }
      }
    } catch {
      /* JSON-LD invalide ignoré */
    }
  });
  const uniq = [...new Set(out.map((s) => s.trim()).filter(Boolean))];
  return uniq.length ? uniq.join(" · ") : null;
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
 * safeFetch avec quelques tentatives : sur une connexion lente, un timeout
 * transitoire ne doit pas faire passer une ressource pour absente (faux négatif
 * sur robots.txt / sitemap / llms.txt). Renvoie null après échec définitif.
 */
async function safeFetchRetry(url: string, attempts = 2): Promise<Response | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await safeFetch(url);
    } catch {
      /* nouvelle tentative, ou null si c'était la dernière */
    }
  }
  return null;
}

/**
 * Le corps d'une ressource publique, ou `null` si elle n'a pas répondu.
 *
 * Même garde-fou que le reste du fichier — schéma, hôte public, redirections
 * revalidées à chaque saut — exposé pour les lectures qui ne rentrent pas dans
 * `collectSignals` : la page d'accueil relue telle quelle et les feuilles de
 * style qu'elle appelle, dont on tire la couleur de marque.
 *
 * Le corps est tronqué : une feuille de style compilée par un thème WordPress
 * pèse volontiers plusieurs mégaoctets, et la couleur des boutons se lit dans
 * les premières centaines de kilooctets ou nulle part.
 */
export async function fetchPublicText(
  url: string,
  maxChars = 400_000,
): Promise<string | null> {
  const res = await safeFetchRetry(url);
  if (!res?.ok) return null;
  try {
    const body = await res.text();
    return body.slice(0, maxChars);
  } catch {
    return null;
  }
}

/**
 * Récupère une ressource racine (robots/sitemap/llms) en tolérant le cas où le
 * fichier n'est servi qu'en HTTP alors que le site est en HTTPS : on tente
 * d'abord l'origine telle quelle (avec retries), puis on retombe sur http.
 */
async function fetchWithHttpFallback(
  url: string,
): Promise<{ res: Response | null; viaHttpFallback: boolean }> {
  const res = await safeFetchRetry(url);
  if (res?.ok) return { res, viaHttpFallback: false };
  if (url.startsWith("https://")) {
    const httpRes = await safeFetchRetry("http://" + url.slice("https://".length));
    if (httpRes?.ok) return { res: httpRes, viaHttpFallback: true };
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
 * Teste TOUJOURS l'adresse HTTPS en premier (même si le site a été saisi en
 * http), puis http en repli : le llms.txt est quasi systématiquement servi en
 * https et c'est cette URL que consultent les IA.
 */
async function detectLlmsTxt(
  origin: string,
): Promise<{ served: boolean; misconfigured: boolean }> {
  const host = new URL(origin).host;
  const candidates = [
    `https://${host}/llms.txt`,
    `http://${host}/llms.txt`,
  ];

  let misconfigured = false;
  for (const url of candidates) {
    const res = await safeFetchRetry(url);
    if (!res) continue;
    const body = await res.text().catch(() => "");
    if (res.ok && body.trim().length > 0 && !body.trim().startsWith("<")) {
      return { served: true, misconfigured: false };
    }
    // Contenu llms.txt valide mais statut ≠ 200 (ex. 404 servi par WordPress) :
    // les crawlers IA s'arrêtent au code de statut et l'ignorent.
    if (!res.ok && looksLikeLlmsTxt(body)) misconfigured = true;
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
    hasFaqSection: false,
    hasReviewsSection: false,
    firstParagraph: null,
    openingHoursHint: null,
    ratingHint: null,
    stack: null,
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

  // 1. Page principale (avec retries : la connexion peut être lente)
  let html = "";
  const homeRes = await safeFetchRetry(url, 3);
  if (homeRes) {
    base.statusCode = homeRes.status;
    base.fetchedOk = homeRes.ok;
    if (homeRes.ok) html = await homeRes.text().catch(() => "");
  }

  // Plateforme du site : lue sur le HTML brut ET les en-têtes de réponse (une
  // partie des empreintes ne vit que là : x-shopid, x-powered-by…).
  if (html || homeRes) {
    base.stack = detectStack(html, homeRes?.headers ?? null);
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

    // JSON-LD : types collectés récursivement (schémas imbriqués inclus, ex.
    // AggregateRating/Review d'un nœud Restaurant) + note moyenne déclarée.
    base.jsonLdTypes = jsonLdTypesOf($);
    base.jsonLdCount = base.jsonLdTypes.length;
    base.ratingHint = aggregateRatingFromJsonLd($);

    // Sections éditoriales clés de la page d'accueil (avant de retirer le DOM) :
    // une FAQ visible (accordéons / Q-R) et une section avis comptent davantage
    // pour les IA qu'un simple schéma.
    base.hasFaqSection = detectFaqSection($);
    base.hasReviewsSection = detectReviewsSection($);
    base.firstParagraph = firstParagraphSentence($);
    base.openingHoursHint = openingHoursFromJsonLd($);

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
