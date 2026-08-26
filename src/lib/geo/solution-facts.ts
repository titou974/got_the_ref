import type { GeoAnalysisResult } from "./types";
import type { AnalysisDiagnostic } from "./diagnostic";
import type { SolutionTab } from "./solution-prompts";

/**
 * Le dossier de faits d'un onglet : ce que le prompt doit contenir mot pour
 * mot.
 *
 * Un prompt qui dit « corrigez votre méta description » ne fait rien avancer :
 * le client doit encore trouver quoi écrire. On lui livre donc la méta
 * description proposée, le H1 proposé, le fichier qui manque, l'article déjà
 * rédigé — le texte exact, pas sa description.
 *
 * D'où la séparation avec la rédaction du prompt : le modèle mini écrit
 * l'enrobage (le contexte et les consignes), ce fichier fournit la matière, et
 * l'assemblage recopie la matière sans la faire passer par le modèle. Un
 * modèle qui recopie abrège, reformule et perd une balise sur trois ; ici rien
 * ne peut se perdre.
 */

/** Un article du planning, tel qu'il doit apparaître dans le prompt. */
export type ArticleFact = {
  title: string;
  keyword: string | null;
  status: string;
  scheduledFor: Date | null;
  excerpt: string | null;
  /** Plan sérialisé en JSON (liste de titres), tel qu'en base. */
  outline: string | null;
  /** Corps rédigé en Markdown — vide tant que l'article n'est qu'un sujet. */
  body: string;
};

export type SolutionFactsInput = {
  tab: SolutionTab;
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  /** Le planning éditorial, pour l'onglet Articles uniquement. */
  articles?: ArticleFact[];
};

export type SolutionFacts = {
  /** Ce que le prompt doit obtenir, en une phrase — sert de cadrage au modèle. */
  mission: string;
  /** Le bloc à recopier tel quel dans le prompt final. */
  dossier: string;
};

const ARTICLE_STATUS_LABELS: Record<string, string> = {
  planned: "sujet retenu, non rédigé",
  drafted: "rédigé, en attente de validation",
  approved: "validé, prêt à publier",
  published: "publié",
  rejected: "écarté",
};

const missing = (label: string) => `- ${label} : MANQUANT`;

function frDate(date: Date | null): string {
  if (!date) return "non planifié";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Le plan d'un article, stocké en JSON, ramené à une liste lisible. */
function readOutline(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) =>
        typeof item === "string"
          ? item
          : typeof (item as { title?: unknown })?.title === "string"
            ? ((item as { title: string }).title)
            : "",
      )
      .filter((line) => line.trim().length > 0);
  } catch {
    return [];
  }
}

function section(heading: string, lines: string[]): string {
  return lines.length ? `${heading}\n${lines.join("\n")}` : "";
}

/** L'identité du site, rappelée en tête de chaque dossier. */
function siteBlock(result: GeoAnalysisResult): string {
  const loc = result.profile.location ? ` · ${result.profile.location}` : "";
  return [
    `Site : ${result.url}`,
    `Activité : ${result.profile.niche}${loc}`,
    result.signals.stack?.name ? `Plateforme : ${result.signals.stack.name}` : "",
    `Score GEO global : ${result.overallScore}/100`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Les fichiers et éléments techniques réellement absents du site.
 *
 * On liste ce que le crawl n'a pas trouvé, pas ce qu'un audit type recommande :
 * un client qui a déjà son sitemap ne doit pas lire « créez un sitemap ».
 */
function architectureFacts(result: GeoAnalysisResult): string {
  const s = result.signals;
  const files: string[] = [];

  if (!s.hasLlmsTxt) {
    files.push(
      s.llmsTxtMisconfigured
        ? `- /llms.txt : PRÉSENT MAIS SERVI EN ERREUR (statut ≠ 200) — les IA l'ignorent`
        : missing("/llms.txt"),
    );
  }
  if (!s.hasRobotsTxt) files.push(missing("/robots.txt"));
  if (!s.hasSitemap) files.push(missing("/sitemap.xml"));
  if (s.jsonLdCount === 0) files.push(missing("Balise JSON-LD Schema.org (aucune sur la page)"));
  if (!s.hasOpenGraph) files.push(missing("Balises Open Graph"));
  if (!s.hasHttps) files.push(missing("HTTPS"));

  const blocked = s.crawlers.filter((c) => !c.allowed).map((c) => `- ${c.name} : bloqué`);

  const onPage = [
    `- <title> actuel : ${s.title ? `« ${s.title} »` : "ABSENT"}`,
    `- <meta name="description"> actuelle : ${
      s.metaDescription ? `« ${s.metaDescription} »` : "ABSENTE"
    }`,
    `- H1 relevé(s) : ${s.h1.length ? s.h1.map((h) => `« ${h} »`).join(" · ") : "AUCUN"}`,
  ];

  const structured = s.jsonLdTypes.length
    ? [`- Types JSON-LD déjà présents : ${s.jsonLdTypes.join(", ")}`]
    : [];

  return [
    section("FICHIERS ET ÉLÉMENTS MANQUANTS (détectés au crawl) :", files.length ? files : ["- (aucun fichier manquant)"]),
    section("ROBOTS D'IA BLOQUÉS :", blocked.length ? blocked : ["- (aucun : tous les robots d'IA passent)"]),
    section("ÉTAT ON-PAGE ACTUEL :", onPage),
    section("DONNÉES STRUCTURÉES :", structured),
    section("CRAWL :", [
      `- Pages parcourues : ${result.signals.crawl.pagesCrawled}`,
      `- Mots au total : ${result.signals.crawl.totalWordCount}`,
      `- Liens internes : ${result.signals.crawl.internalLinks}`,
    ]),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Les réécritures on-page déjà calculées, en face de l'existant.
 *
 * Ce sont exactement les textes affichés dans l'onglet Contenu : le prompt et
 * l'écran doivent dire la même chose, sinon le client colle une version et en
 * lit une autre.
 */
function contentFacts(result: GeoAnalysisResult): string {
  const s = result.signals;
  const insight = result.trendingKeywords;
  const suggested = insight?.suggested;

  const current = [
    `- <title> actuel : ${s.title ? `« ${s.title} »` : "ABSENT"}`,
    `- Méta description actuelle : ${s.metaDescription ? `« ${s.metaDescription} »` : "ABSENTE"}`,
    `- H1 actuel : ${s.h1[0] ? `« ${s.h1[0]} »` : "ABSENT"}`,
    `- Premier paragraphe actuel : ${
      s.firstParagraph ? `« ${s.firstParagraph} »` : "ABSENT"
    }`,
  ];

  const proposals = suggested
    ? [
        `- Balise <title> à poser :\n  ${suggested.title}`,
        `- Méta description à poser :\n  ${suggested.metaDescription}`,
        `- H1 à poser :\n  ${suggested.h1}`,
        `- Premier paragraphe à poser :\n  ${suggested.firstParagraph}`,
      ]
    : [];

  const keywords = (insight?.keywords ?? []).map(
    (k) =>
      `- « ${k.keyword} » (${k.trend}, intention : ${k.intent}) → à placer dans : ${k.placements.join(", ")}`,
  );

  const notes = (insight?.notes ?? []).map((n) => `- ${n}`);

  return [
    section("TEXTES ACTUELS DU SITE :", current),
    section(
      `RÉÉCRITURES PROPOSÉES${insight?.period ? ` (mots-clés ${insight.period})` : ""} — À REPRENDRE MOT POUR MOT :`,
      proposals.length ? proposals : ["- (aucune réécriture calculée pour l'instant)"],
    ),
    section("MOTS-CLÉS DE LA NICHE :", keywords),
    section("REMARQUES :", notes),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Le planning éditorial, articles compris.
 *
 * Le corps rédigé part en entier : c'est le point du prompt qui fait gagner du
 * temps. Le client colle, l'agent publie — il n'a pas à retourner chercher le
 * texte dans l'application.
 */
function articlesFacts(articles: ArticleFact[]): string {
  if (!articles.length) {
    return "PLANNING ÉDITORIAL :\n- (aucun article planifié pour l'instant)";
  }

  const blocks = articles.map((article, index) => {
    const outline = readOutline(article.outline);
    const head = [
      `### Article ${index + 1} — ${article.title}`,
      `Statut : ${ARTICLE_STATUS_LABELS[article.status] ?? article.status}`,
      `Publication prévue : ${frDate(article.scheduledFor)}`,
      article.keyword ? `Mot-clé visé : ${article.keyword}` : "",
      article.excerpt ? `Chapô : ${article.excerpt}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const plan = outline.length
      ? `\n\nPlan :\n${outline.map((line) => `- ${line}`).join("\n")}`
      : "";

    const body = article.body.trim()
      ? `\n\nContenu rédigé (Markdown, à publier tel quel) :\n<<<ARTICLE ${index + 1}\n${article.body.trim()}\nARTICLE ${index + 1}>>>`
      : `\n\nContenu rédigé : (pas encore écrit — sujet seul)`;

    return `${head}${plan}${body}`;
  });

  return `PLANNING ÉDITORIAL — ${articles.length} article(s), texte intégral inclus :\n\n${blocks.join("\n\n")}`;
}

function presenceFacts(result: GeoAnalysisResult): string {
  const quals = result.webPresence.qualifications.map((q) => `- ${q.label} (${q.source})`);
  const mentions = result.webPresence.articles.map((a) => `- « ${a.title} » — ${a.source}`);
  return [
    section("QUALIFICATIONS ET LABELS RELEVÉS :", quals.length ? quals : ["- (aucun)"]),
    section("MENTIONS ÉDITORIALES RELEVÉES :", mentions.length ? mentions : ["- (aucune)"]),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function mapsFacts(result: GeoAnalysisResult): string {
  const coherence = result.mapsCoherence;
  const inconsistencies = (coherence?.matches ?? [])
    .filter((m) => !m.consistent)
    .map((m) => `- ${m.label} : ${m.detail}`);
  const facts = [
    `- Fiche Google Maps : ${result.mapsUrl ?? "non renseignée"}`,
    coherence?.listingName ? `- Nom sur la fiche : ${coherence.listingName}` : "",
    coherence?.rating != null ? `- Note : ${coherence.rating}/5` : "",
    coherence?.reviewCount != null ? `- Avis : ${coherence.reviewCount}` : "",
  ].filter(Boolean);

  return [
    section("FICHE LOCALE :", facts),
    section(
      "INCOHÉRENCES FICHE ↔ SITE :",
      inconsistencies.length ? inconsistencies : ["- (aucune incohérence relevée)"],
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function resultsFacts(result: GeoAnalysisResult): string {
  const recos = result.recommendations
    .slice(0, 8)
    .map((r) => `- [${r.priority}] ${r.title} : ${r.description}`);
  const categories = result.categories.map((c) => `- ${c.key} : ${c.score}/100`);
  return [
    section("RECOMMANDATIONS PRIORITAIRES :", recos.length ? recos : ["- (aucune)"]),
    section("SCORES PAR CATÉGORIE :", categories),
  ]
    .filter(Boolean)
    .join("\n\n");
}

const MISSIONS: Record<SolutionTab, string> = {
  all: "faire corriger d'un seul passage tout ce que l'audit a relevé sur le site : technique, contenu, articles, notoriété et fiche locale",
  results:
    "faire appliquer le plan d'action GEO priorisé du site, recommandation par recommandation",
  architecture:
    "faire créer les fichiers et balises techniques manquants, avec le code exact à déposer",
  content:
    "faire remplacer les textes on-page du site par les réécritures fournies, à l'identique",
  articles:
    "faire publier les articles déjà rédigés sur le blog du site, en respectant le planning",
  presence:
    "faire gagner des mentions et des qualifications éditoriales dans la niche du site",
  maps: "faire aligner la fiche Google Maps et le site pour la visibilité locale",
};

/**
 * Le dossier complet : les six onglets bout à bout, chacun sous son titre.
 *
 * C'est la matière du prompt général de la barre « résoudre ». Rien n'y est
 * résumé : un client qui colle ce prompt doit pouvoir tout appliquer sans
 * revenir dans l'application, y compris les articles rédigés.
 */
function allFacts(input: SolutionFactsInput): string {
  const { result } = input;
  const parts: [string, string][] = [
    ["PLAN D'ACTION", resultsFacts(result)],
    ["ARCHITECTURE TECHNIQUE", architectureFacts(result)],
    ["CONTENU ET CITABILITÉ", contentFacts(result)],
    ["ARTICLES", articlesFacts(input.articles ?? [])],
    ["PRÉSENCE ET NOTORIÉTÉ", presenceFacts(result)],
  ];

  // La fiche locale ne concerne qu'un commerce physique : l'annoncer à un site
  // sans adresse ferait travailler l'agent sur un manque inventé.
  if (result.profile.isPhysical || result.mapsUrl) {
    parts.push(["FICHE GOOGLE MAPS", mapsFacts(result)]);
  }

  return parts.map(([title, body]) => `===== ${title} =====\n\n${body}`).join("\n\n");
}

export function buildSolutionFacts(input: SolutionFactsInput): SolutionFacts {
  const { tab, result } = input;

  const body =
    tab === "all"
      ? allFacts(input)
      : tab === "architecture"
        ? architectureFacts(result)
        : tab === "content"
          ? contentFacts(result)
          : tab === "articles"
            ? articlesFacts(input.articles ?? [])
            : tab === "presence"
              ? presenceFacts(result)
              : tab === "maps"
                ? mapsFacts(result)
                : resultsFacts(result);

  return {
    mission: MISSIONS[tab],
    dossier: `${siteBlock(result)}\n\n${body}`,
  };
}
