import { createHash } from "node:crypto";

import type { SiteSignals } from "./types";

/**
 * L'empreinte d'un site : ce que la reprise du jour a réellement lu.
 *
 * La notation d'une page est rendue par un modèle. Un modèle relit deux fois la
 * même page et rend deux fois des chiffres voisins, jamais identiques : 62 puis
 * 64, sans qu'une ligne du site ait bougé. Sur un tableau de bord qui promet
 * « voilà ce que vos corrections ont changé », ce bruit est un mensonge — il
 * fait passer une journée sans travail pour une journée de progrès, et
 * inversement.
 *
 * D'où cette empreinte. Elle résume les signaux collectés sans le moindre appel
 * de modèle : deux crawls d'un site inchangé donnent la même chaîne, et la
 * reprise sait alors qu'elle n'a rien de neuf à faire noter. Les notes de la
 * veille sont reprises telles quelles, le modèle n'est pas appelé, et la carte
 * de progression affiche un zéro sincère.
 *
 * Ce qui entre dans l'empreinte : tout ce qui pèse sur la notation — les
 * balises, la structure, le volume de texte, les données structurées, l'accès
 * des crawlers, l'échantillon de contenu. Ce qui n'y entre pas : rien
 * d'horodaté, rien de mesuré en millisecondes, rien qui varie d'un appel réseau
 * à l'autre sans que le site ait changé.
 *
 * Les listes sont triées avant d'être hachées : l'ordre dans lequel un crawl
 * rencontre trois types JSON-LD n'est pas une information sur le site.
 */
export function signalsFingerprint(signals: SiteSignals): string {
  const sorted = (values: string[]) => [...values].sort();

  // L'objet est écrit à la main, clé par clé, plutôt que sérialisé en bloc :
  // un champ ajouté un jour à `SiteSignals` ne doit pas invalider en silence
  // toutes les empreintes déjà en base. Il entre ici quand il compte.
  const material = {
    url: signals.url,
    domain: signals.domain,
    fetchedOk: signals.fetchedOk,
    statusCode: signals.statusCode,
    title: signals.title,
    metaDescription: signals.metaDescription,
    h1: signals.h1,
    headingCount: signals.headingCount,
    wordCount: signals.wordCount,
    hasHttps: signals.hasHttps,
    hasViewport: signals.hasViewport,
    hasRobotsTxt: signals.hasRobotsTxt,
    hasSitemap: signals.hasSitemap,
    hasLlmsTxt: signals.hasLlmsTxt,
    llmsTxtMisconfigured: signals.llmsTxtMisconfigured,
    hasFaqSection: signals.hasFaqSection,
    hasReviewsSection: signals.hasReviewsSection,
    firstParagraph: signals.firstParagraph,
    openingHoursHint: signals.openingHoursHint,
    ratingHint: signals.ratingHint,
    stack: signals.stack?.id ?? null,
    jsonLdTypes: sorted(signals.jsonLdTypes),
    jsonLdCount: signals.jsonLdCount,
    hasOpenGraph: signals.hasOpenGraph,
    imagesWithoutAlt: signals.imagesWithoutAlt,
    crawlers: sorted(signals.crawlers.map((c) => `${c.name}:${c.allowed}`)),
    textSample: signals.textSample,
    crawl: {
      pagesCrawled: signals.crawl.pagesCrawled,
      sampledUrls: sorted(signals.crawl.sampledUrls),
      schemaTypes: sorted(signals.crawl.schemaTypes),
      hasFaqSchema: signals.crawl.hasFaqSchema,
      totalWordCount: signals.crawl.totalWordCount,
      internalLinks: signals.crawl.internalLinks,
    },
  };

  return createHash("sha256").update(JSON.stringify(material)).digest("hex");
}
