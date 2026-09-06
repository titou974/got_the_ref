import type { GeoAnalysisResult } from "./types";

/**
 * Les fichiers que les moteurs de réponse cherchent à la racine d'un site, et
 * que l'audit a relevés comme absents.
 *
 * Trois choses, pas plus : `/llms.txt` (ce que le commerce est, en clair, pour
 * un modèle qui le lit sans exécuter de JavaScript), `/robots.txt` (l'accès des
 * robots d'IA, refusé par défaut chez beaucoup d'hébergeurs), et le bloc
 * JSON-LD de la page d'accueil (ce que le commerce est, pour un moteur qui
 * l'indexe).
 *
 * Le contenu se déduit de l'audit, jamais d'un gabarit générique : un fichier
 * qui décrit « votre entreprise » n'apporte rien à un modèle. On n'y écrit que
 * des faits déjà relevés sur le site — nom, niche, ville, note, horaires.
 *
 * Rien ici n'écrit sur le site : la remise dépend de la plateforme et vit dans
 * `features/dashboard/site-sync`.
 */

export type StructureFileKind = "llmsTxt" | "robotsTxt" | "jsonLd";

export type BuiltStructureFile = {
  kind: StructureFileKind;
  path: string;
  content: string;
  /** Pourquoi ce fichier est proposé : ce que l'audit a constaté. */
  reason: string;
};

/** Les robots d'IA qu'un site a intérêt à laisser entrer, tous moteurs confondus. */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "CCBot",
];

const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

function llmsTxt(result: GeoAnalysisResult): string {
  const { profile, signals } = result;
  const location = profile.location ? ` à ${profile.location}` : "";

  const summary =
    clean(signals.metaDescription) ||
    clean(signals.firstParagraph) ||
    `${profile.niche}${location}.`;

  const lines: (string | null)[] = [
    `# ${result.businessName}`,
    "",
    `> ${summary}`,
    "",
    "## À propos",
    `- Site : ${result.url}`,
    `- Activité : ${profile.niche}`,
    profile.location ? `- Zone desservie : ${profile.location}` : null,
    result.mapsUrl ? `- Fiche Google : ${result.mapsUrl}` : null,
    result.mapsCoherence?.rating != null
      ? `- Avis : ${result.mapsCoherence.rating}/5${
          result.mapsCoherence.reviewCount != null
            ? ` sur ${result.mapsCoherence.reviewCount} avis`
            : ""
        }`
      : null,
    clean(signals.openingHoursHint) ? `- Horaires : ${clean(signals.openingHoursHint)}` : null,
    "",
    "## Pages",
    `- [Accueil](${result.url}) : ${clean(signals.title) || result.businessName}`,
  ];

  // Les URL réellement parcourues au crawl valent mieux qu'une arborescence
  // supposée : on ne cite que ce qui existe. Le libellé est tiré du chemin —
  // le crawl ne remonte pas le titre de chaque page jusqu'ici.
  const pages = result.signals.crawl.sampledUrls
    .filter((url) => url !== result.url)
    .slice(0, 12)
    .map((url) => {
      const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");
      const label = path
        .split("/")
        .filter(Boolean)
        .pop()
        ?.replace(/[-_]+/g, " ");
      return `- [${label || url}](${url})`;
    });

  // `filter` sur la nullité seule : une chaîne vide est une ligne de
  // séparation, et le Markdown de `llms.txt` s'effondre sans elles.
  return [...lines, ...pages, ""].filter((line) => line !== null).join("\n");
}

function robotsTxt(result: GeoAnalysisResult): string {
  const origin = new URL(result.url).origin;
  const blocked = result.signals.crawlers.filter((crawler) => !crawler.allowed);

  return [
    "# Accès des robots d'indexation et des robots d'IA.",
    blocked.length
      ? `# Bloqués à l'audit : ${blocked.map((crawler) => crawler.name).join(", ")}.`
      : "# Aucun robot d'IA n'était bloqué à l'audit : ce fichier fige l'autorisation.",
    "",
    "User-agent: *",
    "Allow: /",
    "",
    ...AI_CRAWLERS.flatMap((agent) => [`User-agent: ${agent}`, "Allow: /", ""]),
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

/**
 * Le balisage de la page d'accueil.
 *
 * `LocalBusiness` pour un commerce qui reçoit du public, `Organization` sinon :
 * annoncer une adresse à un site sans adresse est une donnée fausse, et c'est
 * pire que pas de balisage du tout.
 */
function jsonLd(result: GeoAnalysisResult): string {
  const { profile, signals } = result;
  const rating = result.mapsCoherence;

  const business: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": profile.isPhysical ? "LocalBusiness" : "Organization",
    name: result.businessName,
    url: result.url,
    description: clean(signals.metaDescription) || clean(signals.firstParagraph) || profile.niche,
  };

  if (profile.isPhysical && profile.location) {
    business.address = { "@type": "PostalAddress", addressLocality: profile.location };
    business.areaServed = profile.location;
  }
  if (result.mapsUrl) business.sameAs = [result.mapsUrl];
  if (rating?.rating != null && rating.reviewCount != null && rating.reviewCount > 0) {
    business.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating.rating,
      reviewCount: rating.reviewCount,
    };
  }

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: result.businessName,
    url: result.url,
  };

  return JSON.stringify([business, website], null, 2);
}

/**
 * Ce qui manque au site, prêt à déposer.
 *
 * Un site qui a déjà son `robots.txt` ne doit pas en recevoir un second : on ne
 * propose que ce que l'audit n'a pas trouvé. Le `llms.txt` servi en erreur
 * compte comme absent — les IA l'ignorent tout autant.
 */
export function buildStructureFiles(result: GeoAnalysisResult): BuiltStructureFile[] {
  const files: BuiltStructureFile[] = [];
  const { signals } = result;

  if (!signals.hasLlmsTxt) {
    files.push({
      kind: "llmsTxt",
      path: "/llms.txt",
      content: llmsTxt(result),
      reason: signals.llmsTxtMisconfigured
        ? "Le fichier existe mais n'est pas servi en 200 : les IA l'ignorent."
        : "Aucun fichier /llms.txt sur le site.",
    });
  }

  if (!signals.hasRobotsTxt || signals.crawlers.some((crawler) => !crawler.allowed)) {
    files.push({
      kind: "robotsTxt",
      path: "/robots.txt",
      content: robotsTxt(result),
      reason: signals.hasRobotsTxt
        ? "Des robots d'IA sont bloqués par le fichier actuel."
        : "Aucun fichier /robots.txt sur le site.",
    });
  }

  if (signals.jsonLdCount === 0) {
    files.push({
      kind: "jsonLd",
      path: "<script type=\"application/ld+json\">",
      content: jsonLd(result),
      reason: "Aucune donnée structurée Schema.org sur la page d'accueil.",
    });
  }

  return files;
}
