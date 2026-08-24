import "server-only";

import * as cheerio from "cheerio";
import { assertPublicUrl, BlockedUrlError } from "@/lib/geo/fetcher";

/**
 * Le pont vers Crawl4AI. Le crawler est un service Python à part (conteneur
 * `unclecode/crawl4ai`, cf. `docker-compose.crawl4ai.yml`) : Next.js ne fait
 * que lui parler en HTTP, ce qui évite d'embarquer Playwright dans l'app.
 *
 * Si le service ne répond pas — poste de dev sans Docker, redémarrage —, on
 * retombe sur un parcours maison (fetch + cheerio, même origine, profondeur 1).
 * Il rend moins de choses mais l'accueil client ne doit jamais rester bloqué
 * sur une brique d'infrastructure absente.
 */

const CRAWL4AI_URL = process.env.CRAWL4AI_URL ?? "http://localhost:11235";
const CRAWL4AI_TOKEN = process.env.CRAWL4AI_TOKEN;
const CRAWL_TIMEOUT_MS = 180_000;

/** Une page crawlée, réduite à ce que l'on conserve en base. */
export type CrawledPageData = {
  url: string;
  title: string | null;
  statusCode: number | null;
  depth: number;
  markdown: string;
  html: string | null;
  wordCount: number;
};

export type CrawlOutcome = {
  pages: CrawledPageData[];
  /** « crawl4ai » ou « fallback » — utile pour expliquer un résultat maigre. */
  source: "crawl4ai" | "fallback";
};

type CrawlOptions = {
  /** Nombre de pages maximum rapportées (accueil comprise). */
  maxPages?: number;
  /** Profondeur de suivi des liens internes. */
  maxDepth?: number;
};

const DEFAULT_MAX_PAGES = 25;
const DEFAULT_MAX_DEPTH = 2;

/** Le HTML n'est gardé que sur demande : il pèse dix fois le Markdown. */
const KEEP_HTML = process.env.CRAWL_KEEP_HTML === "true";

const countWords = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

/** Normalise le champ `markdown`, tantôt chaîne, tantôt objet selon la version. */
function readMarkdown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidate = record.fit_markdown ?? record.raw_markdown ?? record.markdown;
    if (typeof candidate === "string") return candidate;
  }
  return "";
}

type Crawl4aiResult = {
  url?: string;
  status_code?: number;
  success?: boolean;
  html?: string;
  cleaned_html?: string;
  markdown?: unknown;
  metadata?: { title?: string; depth?: number } & Record<string, unknown>;
};

/**
 * Le corps attendu par le serveur Crawl4AI : chaque configuration voyage
 * enveloppée dans `{ type, params }`, y compris la stratégie de crawl profond.
 * Sans cette enveloppe, le serveur refuse la requête.
 */
function crawlPayload(url: string, options: Required<CrawlOptions>) {
  return {
    urls: [url],
    browser_config: {
      type: "BrowserConfig",
      params: { headless: true, viewport_width: 1280, viewport_height: 800 },
    },
    crawler_config: {
      type: "CrawlerRunConfig",
      params: {
        stream: false,
        cache_mode: "bypass",
        word_count_threshold: 10,
        page_timeout: 30_000,
        deep_crawl_strategy: {
          type: "BFSDeepCrawlStrategy",
          params: {
            max_depth: options.maxDepth,
            max_pages: options.maxPages,
            include_external: false,
          },
        },
      },
    },
  };
}

async function crawlWithService(
  url: string,
  options: Required<CrawlOptions>,
): Promise<CrawledPageData[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

  try {
    const response = await fetch(`${CRAWL4AI_URL}/crawl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(CRAWL4AI_TOKEN ? { Authorization: `Bearer ${CRAWL4AI_TOKEN}` } : {}),
      },
      body: JSON.stringify(crawlPayload(url, options)),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`crawl4ai ${response.status}`);
    }

    const payload = (await response.json()) as {
      results?: Crawl4aiResult[];
      success?: boolean;
    };
    const results = payload.results ?? [];

    return results
      .filter((result) => result.url && result.success !== false)
      .slice(0, options.maxPages)
      .map((result) => {
        const markdown = readMarkdown(result.markdown);
        return {
          url: result.url as string,
          title: result.metadata?.title ?? null,
          statusCode: result.status_code ?? null,
          depth: typeof result.metadata?.depth === "number" ? result.metadata.depth : 0,
          markdown,
          html: KEEP_HTML ? (result.cleaned_html ?? result.html ?? null) : null,
          wordCount: countWords(markdown),
        };
      });
  } finally {
    clearTimeout(timer);
  }
}

/** Convertit un document HTML en texte lisible : titres, paragraphes, listes. */
function htmlToText(html: string): { title: string | null; text: string; links: string[] } {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();

  const title = $("title").first().text().trim() || null;
  const parts: string[] = [];

  $("h1, h2, h3, h4, p, li, td, dd, blockquote").each((_, node) => {
    const text = $(node).text().replace(/\s+/g, " ").trim();
    if (text.length > 1) parts.push(text);
  });

  const links = $("a[href]")
    .map((_, node) => $(node).attr("href") ?? "")
    .get();

  return { title, text: parts.join("\n"), links };
}

/**
 * Le parcours de secours : l'accueil, puis les liens internes trouvés dessus.
 * Chaque URL repasse par le contrôle anti-SSRF, car un site peut très bien
 * pointer vers une adresse privée depuis son propre menu.
 */
async function crawlWithFallback(
  startUrl: string,
  options: Required<CrawlOptions>,
): Promise<CrawledPageData[]> {
  const origin = new URL(startUrl).origin;
  const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];
  const seen = new Set([startUrl]);
  const pages: CrawledPageData[] = [];

  while (queue.length > 0 && pages.length < options.maxPages) {
    const { url, depth } = queue.shift() as { url: string; depth: number };

    let html: string;
    let status: number;
    try {
      await assertPublicUrl(url);
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GotTheRef-Crawler/1.0)" },
        signal: AbortSignal.timeout(15_000),
      });
      status = response.status;
      if (!response.ok) continue;
      html = await response.text();
    } catch {
      continue;
    }

    const { title, text, links } = htmlToText(html);
    pages.push({
      url,
      title,
      statusCode: status,
      depth,
      markdown: text,
      html: KEEP_HTML ? html : null,
      wordCount: countWords(text),
    });

    if (depth >= options.maxDepth) continue;

    for (const href of links) {
      if (seen.size >= options.maxPages * 3) break;
      let next: URL;
      try {
        next = new URL(href, url);
      } catch {
        continue;
      }
      next.hash = "";
      if (next.origin !== origin) continue;
      if (seen.has(next.toString())) continue;
      seen.add(next.toString());
      queue.push({ url: next.toString(), depth: depth + 1 });
    }
  }

  return pages;
}

/**
 * Crawle un site et rend ses pages. Passe par Crawl4AI, et n'utilise le
 * parcours maison que si le service est injoignable ou muet.
 */
export async function crawlSite(
  rawUrl: string,
  options: CrawlOptions = {},
): Promise<CrawlOutcome> {
  const resolved: Required<CrawlOptions> = {
    maxPages: options.maxPages ?? DEFAULT_MAX_PAGES,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
  };

  // Le contrôle anti-SSRF vaut aussi pour Crawl4AI : le service accepterait
  // sans broncher une adresse interne qu'on lui tendrait.
  await assertPublicUrl(rawUrl);

  try {
    const pages = await crawlWithService(rawUrl, resolved);
    if (pages.length > 0) return { pages, source: "crawl4ai" };
  } catch (error) {
    if (error instanceof BlockedUrlError) throw error;
    console.warn("[crawl] Crawl4AI indisponible, repli sur le parcours interne", error);
  }

  return { pages: await crawlWithFallback(rawUrl, resolved), source: "fallback" };
}
