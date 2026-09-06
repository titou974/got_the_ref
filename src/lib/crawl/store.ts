import "server-only";

import { prisma } from "@/lib/prisma";
import { crawlSite, type CrawledPageData } from "./firecrawl";

/**
 * La mémoire des crawls. Chaque page et son contenu sont conservés : c'est la
 * matière première des agents, et la relire coûte une requête SQL là où la
 * recrawler coûte une minute de navigateur headless.
 *
 * La clé est le domaine, pas le compte : deux clients sur le même domaine
 * partagent le crawl. Passé `CRAWL_MAX_AGE_HOURS`, le site est repassé au
 * crawler et ses pages remplacées.
 */

const MAX_AGE_HOURS = Number(process.env.CRAWL_MAX_AGE_HOURS ?? 168); // 7 jours

/** Ramène une URL saisie à la main à quelque chose de crawlable. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  url.hash = "";
  return url.toString();
}

/** Le domaine nu, sans « www. » : c'est lui qui identifie le site. */
export function domainOf(input: string): string {
  return new URL(normalizeUrl(input)).hostname.replace(/^www\./i, "").toLowerCase();
}

const isFresh = (date: Date): boolean =>
  Date.now() - date.getTime() < MAX_AGE_HOURS * 3600_000;

export type StoredSite = {
  siteId: string;
  domain: string;
  url: string;
  pages: { url: string; title: string | null; markdown: string; wordCount: number }[];
  /** Vrai si le crawl vient d'être relancé, faux si les pages sortent du cache. */
  crawled: boolean;
};

/**
 * Rend les pages d'un site : celles déjà en base si elles sont récentes, un
 * crawl neuf sinon.
 *
 * Les pages sont réécrites en bloc dans une transaction — un remplacement, pas
 * une fusion. Fusionner laisserait traîner des URL supprimées du site, que les
 * agents citeraient ensuite comme si elles existaient encore.
 */
export async function getOrCrawlSite(
  rawUrl: string,
  options: { maxPages?: number; maxDepth?: number; force?: boolean } = {},
): Promise<StoredSite> {
  const url = normalizeUrl(rawUrl);
  const domain = domainOf(url);

  const existing = await prisma.crawledSite.findUnique({
    where: { domain },
    include: {
      pages: {
        orderBy: [{ depth: "asc" }, { wordCount: "desc" }],
        select: { url: true, title: true, markdown: true, wordCount: true },
      },
    },
  });

  if (!options.force && existing && existing.pages.length > 0 && isFresh(existing.lastCrawledAt)) {
    return {
      siteId: existing.id,
      domain,
      url: existing.url,
      pages: existing.pages,
      crawled: false,
    };
  }

  const { pages } = await crawlSite(url, {
    maxPages: options.maxPages,
    maxDepth: options.maxDepth,
  });

  const site = await persistPages({ domain, url, pages });

  return {
    siteId: site.id,
    domain,
    url,
    pages: pages.map((page) => ({
      url: page.url,
      title: page.title,
      markdown: page.markdown,
      wordCount: page.wordCount,
    })),
    crawled: true,
  };
}

/** Écrit le site et ses pages, en remplaçant l'ancien jeu de pages. */
async function persistPages({
  domain,
  url,
  pages,
}: {
  domain: string;
  url: string;
  pages: CrawledPageData[];
}) {
  return prisma.$transaction(async (tx) => {
    const site = await tx.crawledSite.upsert({
      where: { domain },
      create: { domain, url, pageCount: pages.length },
      update: { url, pageCount: pages.length, lastCrawledAt: new Date() },
    });

    await tx.crawledPage.deleteMany({ where: { siteId: site.id } });

    if (pages.length > 0) {
      await tx.crawledPage.createMany({
        data: pages.map((page) => ({
          siteId: site.id,
          url: page.url,
          title: page.title,
          statusCode: page.statusCode,
          depth: page.depth,
          markdown: page.markdown,
          html: page.html,
          wordCount: page.wordCount,
        })),
        skipDuplicates: true,
      });
    }

    return site;
  });
}

/** Range l'analyse produite à partir du crawl, à côté des pages qui l'ont nourrie. */
export async function saveSiteAnalysis(siteId: string, analysis: unknown): Promise<void> {
  await prisma.crawledSite.update({
    where: { id: siteId },
    data: { analysis: JSON.stringify(analysis) },
  });
}

/**
 * Assemble un extrait des pages pour le modèle : les plus fournies d'abord,
 * chacune tronquée. Un site entier dépasse vite la fenêtre utile, et les
 * premières lignes d'une page portent l'essentiel de ce qu'on cherche ici
 * (langue, ville, offre).
 */
export function buildCorpus(
  pages: { url: string; title: string | null; markdown: string; wordCount: number }[],
  { maxPages = 12, perPageChars = 2500 }: { maxPages?: number; perPageChars?: number } = {},
): string {
  return pages
    .slice(0, maxPages)
    .map(
      (page) =>
        `## ${page.title ?? "(sans titre)"}\nURL : ${page.url}\n\n${page.markdown.slice(0, perPageChars)}`,
    )
    .join("\n\n---\n\n");
}
