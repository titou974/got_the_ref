import "server-only";

import * as cheerio from "cheerio";
import { assertPublicUrl, BlockedUrlError } from "@/lib/geo/fetcher";

/**
 * Le pont vers Firecrawl.
 *
 * Un service hébergé, appelé en HTTP : rien à faire tourner à côté de
 * l'application, ce qui la laisse déployable telle quelle sur une plateforme
 * sans conteneurs. Firecrawl rend directement du Markdown propre, sans les
 * menus ni les pieds de page, ce que les modèles lisent bien mieux qu'un DOM
 * complet.
 *
 * Sans clé — ou si l'API tombe —, on retombe sur un parcours maison (fetch +
 * cheerio, même origine, profondeur limitée). Il rend moins de choses mais
 * l'accueil client ne doit jamais rester bloqué sur une dépendance externe.
 */

const FIRECRAWL_URL = process.env.FIRECRAWL_URL ?? "https://api.firecrawl.dev";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

/** Temps maximum accordé à un crawl complet, sondages compris. */
const CRAWL_TIMEOUT_MS = 180_000;
/** Intervalle entre deux sondages de l'état du travail. */
const POLL_INTERVAL_MS = 2_000;

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
  /** « firecrawl » ou « fallback » : utile pour expliquer un résultat maigre. */
  source: "firecrawl" | "fallback";
};

type CrawlOptions = {
  /** Nombre de pages maximum rapportées, accueil comprise. Une page = un crédit. */
  maxPages?: number;
  /** Profondeur de suivi des liens internes depuis l'URL de départ. */
  maxDepth?: number;
};

const DEFAULT_MAX_PAGES = 25;
const DEFAULT_MAX_DEPTH = 2;

/** Le HTML n'est gardé que sur demande : il pèse dix fois le Markdown. */
const KEEP_HTML = process.env.CRAWL_KEEP_HTML === "true";

export const isFirecrawlConfigured = (): boolean => Boolean(FIRECRAWL_API_KEY);

const countWords = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

/** Certains champs de métadonnées arrivent en tableau : on garde la première valeur. */
function firstString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

type FirecrawlDocument = {
  markdown?: string;
  html?: string;
  rawHtml?: string;
  metadata?: {
    title?: string | string[];
    sourceURL?: string;
    url?: string;
    statusCode?: number;
  };
};

const firecrawlHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
});

/** Traduit un document Firecrawl en ligne de la table `CrawledPage`. */
function toPage(document: FirecrawlDocument, fallbackUrl: string, depth: number): CrawledPageData {
  const markdown = document.markdown ?? "";
  return {
    url: document.metadata?.sourceURL ?? document.metadata?.url ?? fallbackUrl,
    title: firstString(document.metadata?.title),
    statusCode: document.metadata?.statusCode ?? null,
    depth,
    markdown,
    html: KEEP_HTML ? (document.html ?? document.rawHtml ?? null) : null,
    wordCount: countWords(markdown),
  };
}

/**
 * Une seule page : `/v2/scrape`, synchrone et facturé un crédit.
 *
 * Passer par un crawl complet pour une page unique coûterait le même crédit
 * mais imposerait la boucle de sondage, donc plusieurs secondes d'attente pour
 * rien. C'est le chemin de l'article donné en exemple à l'étape tonalité.
 */
async function scrapeOnePage(url: string): Promise<CrawledPageData[]> {
  const response = await fetch(`${FIRECRAWL_URL}/v2/scrape`, {
    method: "POST",
    headers: firecrawlHeaders(),
    body: JSON.stringify({
      url,
      formats: KEEP_HTML ? ["markdown", "html"] : ["markdown"],
      onlyMainContent: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`firecrawl scrape ${response.status}`);
  }

  const payload = (await response.json()) as { success?: boolean; data?: FirecrawlDocument };
  if (!payload.data) throw new Error("firecrawl scrape : réponse vide");

  return [toPage(payload.data, url, 0)];
}

/**
 * Un site entier : `/v2/crawl` ouvre un travail, puis on sonde son état.
 *
 * Firecrawl découpe les réponses volumineuses : tant qu'un `next` est renvoyé,
 * il reste des pages à récupérer, et s'arrêter au premier lot amputerait le
 * crawl des sites les plus fournis, justement ceux qui nous intéressent.
 */
async function crawlWithFirecrawl(
  url: string,
  options: Required<CrawlOptions>,
): Promise<CrawledPageData[]> {
  const deadline = Date.now() + CRAWL_TIMEOUT_MS;

  const started = await fetch(`${FIRECRAWL_URL}/v2/crawl`, {
    method: "POST",
    headers: firecrawlHeaders(),
    body: JSON.stringify({
      url,
      limit: options.maxPages,
      maxDiscoveryDepth: options.maxDepth,
      // Le crawl reste sur le domaine : les liens sortants d'un site de commerce
      // mènent aux réseaux sociaux et aux annuaires, pas à son offre.
      crawlEntireDomain: false,
      allowExternalLinks: false,
      scrapeOptions: {
        formats: KEEP_HTML ? ["markdown", "html"] : ["markdown"],
        onlyMainContent: true,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!started.ok) {
    const detail = await started.text().catch(() => "");
    throw new Error(`firecrawl crawl ${started.status} ${detail.slice(0, 200)}`);
  }

  const { id } = (await started.json()) as { success?: boolean; id?: string };
  if (!id) throw new Error("firecrawl crawl : aucun identifiant de travail");

  const statusUrl = `${FIRECRAWL_URL}/v2/crawl/${id}`;

  const readStatus = async (url: string) => {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`firecrawl statut ${response.status}`);
    return (await response.json()) as {
      status?: string;
      data?: FirecrawlDocument[];
      next?: string | null;
    };
  };

  // Deux temps, et pas un seul : tant que le crawl tourne, l'API renvoie déjà
  // des résultats partiels accompagnés d'un `next`. Ramasser au fil de l'eau
  // puis revenir au point d'entrée après une pause redonnerait le premier lot,
  // et les mêmes pages seraient comptées deux fois. On attend donc la fin, puis
  // on déroule la pagination d'une traite.
  let done = false;
  while (Date.now() < deadline) {
    const payload = await readStatus(statusUrl);
    if (payload.status === "failed") throw new Error("firecrawl : crawl en échec");
    if (payload.status === "completed") {
      done = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Le délai a expiré avant la fin : on prend ce qui est prêt plutôt que de
  // renvoyer le client à son formulaire les mains vides.
  if (!done) {
    console.warn("[crawl] Firecrawl encore en cours, on garde les pages déjà prêtes");
  }

  const documents: FirecrawlDocument[] = [];
  const seen = new Set<string>();
  let pageUrl: string | null = statusUrl;

  while (pageUrl && documents.length < options.maxPages) {
    const payload: Awaited<ReturnType<typeof readStatus>> = await readStatus(pageUrl);

    for (const document of payload.data ?? []) {
      const key = document.metadata?.sourceURL ?? document.metadata?.url;
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      documents.push(document);
    }

    pageUrl = payload.next ?? null;
  }

  // Firecrawl ne dit pas à quelle profondeur chaque page a été trouvée. La
  // première du lot est celle de départ, les autres sont ses descendantes :
  // c'est tout ce dont l'assemblage du corpus a besoin.
  return documents
    .slice(0, options.maxPages)
    .map((document, index) => toPage(document, url, index === 0 ? 0 : 1));
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
 * Crawle un site et rend ses pages. Passe par Firecrawl quand une clé est
 * configurée, et n'utilise le parcours maison qu'à défaut.
 */
export async function crawlSite(
  rawUrl: string,
  options: CrawlOptions = {},
): Promise<CrawlOutcome> {
  const resolved: Required<CrawlOptions> = {
    maxPages: options.maxPages ?? DEFAULT_MAX_PAGES,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
  };

  // Le contrôle anti-SSRF vaut aussi pour Firecrawl : le service accepterait
  // sans broncher une adresse interne qu'on lui tendrait.
  await assertPublicUrl(rawUrl);

  if (isFirecrawlConfigured()) {
    try {
      const pages =
        resolved.maxPages === 1
          ? await scrapeOnePage(rawUrl)
          : await crawlWithFirecrawl(rawUrl, resolved);
      if (pages.length > 0) return { pages, source: "firecrawl" };
    } catch (error) {
      if (error instanceof BlockedUrlError) throw error;
      console.warn("[crawl] Firecrawl indisponible, repli sur le parcours interne", error);
    }
  }

  return { pages: await crawlWithFallback(rawUrl, resolved), source: "fallback" };
}
