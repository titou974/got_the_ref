import { z } from "zod";
import { askJson, isAiConfigured } from "@/lib/ai/client";
import {
  CATEGORY_META,
  type CategoryKey,
  type CategoryScore,
  type GeoAnalysisResult,
  type Recommendation,
  type SiteSignals,
  type AiSimulation,
  type AiEngine,
  type EngineScore,
  type EngineRanking,
  type GoogleSeo,
  type BusinessMode,
  type BusinessProfile,
  type Competitor,
  type LocalRanking,
  type WebPresence,
  type OnPageContent,
  type OnPageCheck,
  type MapsCoherence,
  type MapsListing,
  type Backlinks,
  type ReferringSource,
} from "./types";
import {
  hasAnyEngineKey,
  gatherLiveEngines,
  measureEngine,
  type MeasuredEngine,
  type LiveEngineResult,
} from "./providers";
import { fetchTrendingKeywords, fallbackTrendingKeywords } from "./keywords";
import { scrapeMapsListing } from "./maps";
import { FREE_SCORE_CAP } from "@/constants/plans";
import { GEO_AUDIT_METHODOLOGY, DASHBOARD_MAPPING } from "./methodology";
import { geoLog } from "./log";

/** Contexte fourni par l'utilisateur (onglet physique/en ligne + fiche Maps). */
export type AnalysisContext = {
  mode: BusinessMode;
  mapsUrl: string | null;
};

/**
 * Tout le raisonnement de l'audit (notes, constats, recommandations, on-page,
 * notoriété, cohérence Maps) passe par le client `lib/ai` — DeepSeek V4 Flash en
 * tête, Kimi en secours. Les trois moteurs (ChatGPT, Gemini, Claude) ne sont
 * appelés que pour une seule chose : le CLASSEMENT réel, qu'aucun autre modèle
 * ne peut produire à leur place puisqu'il s'agit de leur propre réponse.
 */
const AUDIT_MAX_TOKENS = 16000;

/** Cœur d'analyse, avant enrichissement (overallScore, aiVisibility, signals, date). */
type EngineCore = Omit<GeoAnalysisResult, "signals" | "createdAt" | "overallScore">;

const MAX_RANK_ITEMS = 10;

/**
 * Les trois moteurs dont on relève le classement, dans l'ordre d'affichage.
 * Chacun est interrogé par SA propre API : la réponse de ChatGPT ne peut pas
 * être devinée par Gemini, ni celle de Claude par l'un des deux.
 */
const ALL_ENGINES: AiEngine[] = ["ChatGPT", "Gemini", "Claude"];

const CATEGORY_KEYS: CategoryKey[] = [
  "citability",
  "brandAuthority",
  "contentEEAT",
  "technical",
  "structuredData",
  "platform",
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function computeOverall(categories: CategoryScore[]): number {
  let total = 0;
  for (const c of categories) total += c.score * CATEGORY_META[c.key].weight;
  return clamp(total);
}

// Sous-schéma réutilisé pour chaque élément on-page (title, meta, H1, 1ʳᵉ phrase).
const ON_PAGE_CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: { type: ["string", "null"] },
    status: { type: "string", enum: ["ok", "warn", "ko"] },
    signals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          present: { type: "boolean" },
        },
        required: ["label", "present"],
      },
    },
    note: { type: "string" },
  },
  required: ["text", "status", "signals", "note"],
} as const;

// Schéma de sortie structurée imposé à Claude.
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    businessName: { type: "string" },
    businessType: { type: "string" },
    verdict: { type: "string" },
    categories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string", enum: CATEGORY_KEYS },
          score: { type: "integer" },
          summary: { type: "string" },
          findings: { type: "array", items: { type: "string" } },
        },
        required: ["key", "score", "summary", "findings"],
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: {
            type: "string",
            enum: ["critique", "haute", "moyenne", "basse"],
          },
          category: { type: "string", enum: CATEGORY_KEYS },
          impact: { type: "integer" },
        },
        required: ["title", "description", "priority", "category", "impact"],
      },
    },
    engines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          engine: { type: "string", enum: ALL_ENGINES },
          score: { type: "integer" },
          estimatedPosition: { type: ["integer", "null"] },
          visibility: {
            type: "string",
            enum: ["forte", "moyenne", "faible", "absente"],
          },
          summary: { type: "string" },
          competitorsAhead: { type: "array", items: { type: "string" } },
        },
        required: ["engine", "score", "estimatedPosition", "visibility", "summary", "competitorsAhead"],
      },
    },
    profile: {
      type: "object",
      additionalProperties: false,
      properties: {
        isPhysical: { type: "boolean" },
        niche: { type: "string" },
        generalCategory: { type: "string" },
        location: { type: ["string", "null"] },
      },
      required: ["isPhysical", "niche", "generalCategory", "location"],
    },
    localRankings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["niche", "general"] },
          label: { type: "string" },
          targetRank: { type: ["integer", "null"] },
          competitors: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                rank: { type: "integer" },
                name: { type: "string" },
                isTarget: { type: "boolean" },
                note: { type: ["string", "null"] },
              },
              required: ["rank", "name", "isTarget", "note"],
            },
          },
        },
        required: ["type", "label", "targetRank", "competitors"],
      },
    },
    webPresence: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "integer" },
        summary: { type: "string" },
        qualifications: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              source: { type: "string" },
              detail: { type: "string" },
            },
            required: ["label", "source", "detail"],
          },
        },
        articles: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              source: { type: "string" },
            },
            required: ["title", "source"],
          },
        },
        findings: { type: "array", items: { type: "string" } },
      },
      required: ["score", "summary", "qualifications", "articles", "findings"],
    },
    mapsCoherence: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        score: { type: "integer" },
        summary: { type: "string" },
        listingName: { type: ["string", "null"] },
        reviewCount: { type: ["integer", "null"] },
        rating: { type: ["number", "null"] },
        matches: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              consistent: { type: "boolean" },
              detail: { type: "string" },
            },
            required: ["label", "consistent", "detail"],
          },
        },
        findings: { type: "array", items: { type: "string" } },
      },
      required: ["score", "summary", "listingName", "reviewCount", "rating", "matches", "findings"],
    },
    onPageContent: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: ON_PAGE_CHECK_SCHEMA,
        metaDescription: ON_PAGE_CHECK_SCHEMA,
        h1: ON_PAGE_CHECK_SCHEMA,
        firstSentence: ON_PAGE_CHECK_SCHEMA,
        openingHours: { type: ["string", "null"] },
      },
      required: ["title", "metaDescription", "h1", "firstSentence", "openingHours"],
    },
    googleSeo: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "integer" },
        positioning: { type: "string" },
        summary: { type: "string" },
        findings: { type: "array", items: { type: "string" } },
        topKeywords: { type: "array", items: { type: "string" } },
      },
      required: ["score", "positioning", "summary", "findings", "topKeywords"],
    },
    aiSimulation: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string" },
        engine: { type: "string", enum: ALL_ENGINES },
        appearsInResults: { type: "boolean" },
        position: { type: ["integer", "null"] },
        competitorsAhead: { type: "array", items: { type: "string" } },
        explanation: { type: "string" },
      },
      required: [
        "query",
        "engine",
        "appearsInResults",
        "position",
        "competitorsAhead",
        "explanation",
      ],
    },
  },
  required: [
    "businessName",
    "businessType",
    "verdict",
    "categories",
    "engines",
    "profile",
    "localRankings",
    "webPresence",
    "onPageContent",
    "googleSeo",
    "recommendations",
    "aiSimulation",
  ],
} as const;


function buildPrompt(
  signals: SiteSignals,
  ctx: AnalysisContext,
  profile: BusinessProfile,
  mapsListing: MapsListing | null,
  measured: Record<AiEngine, MeasuredEngine | null>,
): string {
  const blockedCrawlers = signals.crawlers
    .filter((c) => !c.allowed)
    .map((c) => c.name);
  const modeLabel =
    ctx.mode === "physical" ? "Commerce physique (établissement local)" : "Commerce en ligne";

  // Classements RÉELS déjà mesurés (API moteurs) vs moteurs restant à estimer.
  const realLines = ALL_ENGINES.filter((e) => measured[e]).map((e) => {
    const m = measured[e]!;
    const pos = m.position != null ? `position ${m.position}` : m.cited ? "cité sans rang de tête" : "non cité";
    const ahead = m.competitorsAhead.length ? ` ; concurrents devant : ${m.competitorsAhead.join(", ")}` : "";
    return `- ${e} : ${pos}${ahead}`;
  });
  const toEstimate = ALL_ENGINES.filter((e) => !measured[e]);
  const enginesBlock = realLines.length
    ? `CLASSEMENTS MOTEURS DÉJÀ MESURÉS (réels, via API — NE RÉESTIME PAS ces moteurs) :\n${realLines.join("\n")}`
    : "Aucun classement moteur réel disponible.";
  const enginesInstruction = toEstimate.length
    ? `engines : produis un objet UNIQUEMENT pour le(s) moteur(s) SANS classement réel, à savoir : ${toEstimate.join(", ")}. Pour ces moteurs, estime score GEO (0-100), estimatedPosition (1 = cité en premier, null = non cité), visibility (forte/moyenne/faible/absente), un résumé d'une phrase, et competitorsAhead (0 à 3 noms). N'inclus AUCUN objet pour les moteurs déjà mesurés ci-dessus.`
    : `engines : tous les moteurs ont déjà un classement réel mesuré. Renvoie un tableau engines VIDE [].`;
  const mapsScraped =
    mapsListing && mapsListing.scraped
      ? `Données réelles extraites de la fiche Maps (scraping) — nom: ${mapsListing.listingName ?? "?"}, note: ${mapsListing.rating ?? "?"}, avis: ${mapsListing.reviewCount ?? "?"}. Utilise CES chiffres réels pour reviewCount/rating/listingName.`
      : "Aucune donnée chiffrée extraite de la fiche Maps (laisse reviewCount/rating à null si tu ne les connais pas).";
  return `Tu es un expert GEO (Generative Engine Optimization) et SEO. Tu évalues dans quelle mesure un site web est susceptible d'être cité par les moteurs de recherche IA (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews).

${GEO_AUDIT_METHODOLOGY}

${DASHBOARD_MAPPING}

NB : les clés de catégorie dans le JSON sont : citability, brandAuthority, contentEEAT, technical, structuredData, platform (elles correspondent respectivement à AI Citability, Brand Authority, Content E-E-A-T, Technical GEO, Schema & Structured Data, Platform Optimization).

DONNÉES TECHNIQUES MESURÉES DU SITE :
URL: ${signals.url}
Domaine: ${signals.domain}
Récupération réussie: ${signals.fetchedOk} (HTTP ${signals.statusCode})
Titre: ${signals.title ?? "(absent)"}
Meta description: ${signals.metaDescription ?? "(absente)"}
H1: ${signals.h1.join(" | ") || "(aucun)"}
Nombre de titres (h1-h4): ${signals.headingCount}
Nombre de mots: ${signals.wordCount}
HTTPS: ${signals.hasHttps}
Viewport mobile: ${signals.hasViewport}
robots.txt présent: ${signals.hasRobotsTxt}
sitemap présent: ${signals.hasSitemap}
llms.txt présent: ${signals.hasLlmsTxt}${signals.llmsTxtMisconfigured ? " — ATTENTION : un fichier llms.txt EXISTE mais le serveur le renvoie avec un statut 404 (au lieu de 200). Les crawlers IA l'ignorent donc. Recommander en PRIORITÉ de le servir avec un statut HTTP 200." : ""}
Types JSON-LD détectés (imbriqués inclus): ${signals.jsonLdTypes.join(", ") || "(aucun)"}
Schéma d'avis/notation présent (Review / AggregateRating): ${signals.jsonLdTypes.some((t) => /review|aggregaterating|rating/i.test(t))}${signals.ratingHint ? ` — note déclarée : ${signals.ratingHint}` : ""}
Open Graph: ${signals.hasOpenGraph}
Images sans attribut alt: ${signals.imagesWithoutAlt}
Section FAQ sur la page d'accueil (accordéons / blocs questions-réponses): ${signals.hasFaqSection}
Section avis / témoignages sur la page d'accueil: ${signals.hasReviewsSection}
Crawlers IA bloqués: ${blockedCrawlers.join(", ") || "aucun"}

CRAWL MULTI-PAGES (déterministe) :
Pages explorées: ${signals.crawl.pagesCrawled} (${signals.crawl.sampledUrls.join(", ") || "accueil"})
Liens internes détectés: ${signals.crawl.internalLinks}
Mots cumulés sur les pages: ${signals.crawl.totalWordCount}
Types JSON-LD agrégés (toutes pages): ${signals.crawl.schemaTypes.join(", ") || "(aucun)"}
FAQ structurée (FAQPage) détectée: ${signals.crawl.hasFaqSchema}

DÉCLARÉ PAR L'UTILISATEUR :
Type de commerce: ${modeLabel}
Fiche Google Maps fournie: ${ctx.mapsUrl ?? "(non fournie)"}
${mapsScraped}

${enginesBlock}

PROFIL DÉJÀ DÉTERMINÉ EN AMONT (étape 1 — fais-en AUTORITÉ, ne le contredis pas) :
Niche précise: ${profile.niche}
Catégorie générale: ${profile.generalCategory}
Localisation: ${profile.location ?? "(non physique / inconnue)"}

ÉLÉMENTS ON-PAGE RÉELS (à reprendre TEXTUELLEMENT, ne les invente pas) :
Balise title: ${signals.title ?? "(absente)"}
Meta description: ${signals.metaDescription ?? "(absente)"}
H1: ${signals.h1.join(" | ") || "(aucun)"}
1ʳᵉ phrase du 1ᵉʳ paragraphe: ${signals.firstParagraph ?? "(introuvable)"}
Horaires d'ouverture (indice JSON-LD): ${signals.openingHoursHint ?? "(aucun dans le schéma)"}

EXTRAIT DE CONTENU :
"""
${signals.textSample || "(contenu non récupérable)"}
"""

CONSIGNES :
1. Déduis le nom de l'entreprise (businessName) à partir du contenu. businessType = reprends la niche/catégorie du PROFIL DÉJÀ DÉTERMINÉ ci-dessus (en français).
2. Note chaque catégorie de 0 à 100 selon la GRILLE D'AUDIT GEO ci-dessus, en t'appuyant sur les données réelles. Sois rigoureux et honnête : un site sans données structurées ne peut pas avoir un bon score "structuredData".
3. Pour chaque catégorie, donne un résumé (1-2 phrases) et 2 à 4 constats précis (findings).
4. Propose 5 à 8 recommandations actionnables, priorisées (critique/haute/moyenne/basse) avec un impact estimé (1-10) et la catégorie concernée. NE RECOMMANDE JAMAIS d'ajouter un schéma déjà présent dans « Types JSON-LD détectés » (ex. si AggregateRating/Review/LocalBusiness/Restaurant/FAQPage y figurent, ils existent déjà : ne propose pas de les ajouter, suggère au plus de les enrichir).
5. ${enginesInstruction} (Différencie les moteurs : ChatGPT Search valorise l'autorité et la structure, Gemini s'appuie sur l'écosystème Google et les données structurées. NE PRODUIS JAMAIS de classement pour un moteur déjà mesuré : on n'utilise QUE des classements véridiques.)
6. googleSeo : réalise une mini-analyse SEO Google classique. Donne un score (0-100), un positionnement organique estimé (positioning, ex. "Page 1 (top 5)", "Page 2-3", "Non positionné"), un résumé, 2 à 4 constats (findings) et une liste de mots-clés (topKeywords) sur lesquels le site pourrait/devrait ressortir.
7. aiSimulation : imagine une requête de recherche naturelle qu'un utilisateur taperait dans une IA et pour laquelle cette entreprise devrait apparaître (ex. "meilleur restaurant italien à Lyon"). Indique si le site apparaîtrait probablement dans les résultats cités (appearsInResults), à quelle position approximative (position, ou null), quels types de concurrents passeraient devant, et pourquoi.
8. verdict : une phrase de synthèse percutante sur la visibilité IA actuelle du site.
9. profile : REPRENDS À L'IDENTIQUE le PROFIL DÉJÀ DÉTERMINÉ ci-dessus — isPhysical = ${profile.isPhysical}, niche = « ${profile.niche} », generalCategory = « ${profile.generalCategory} », location = ${profile.location ? `« ${profile.location} »` : "null"}. Ne le re-détecte pas, ne le modifie pas.
10. localRankings : UNIQUEMENT si commerce physique AVEC une localisation identifiée. Produis DEUX classements top 10 du marché LOCAL, basés sur ta meilleure connaissance des acteurs réels de cette ville (ce sont des ESTIMATIONS, pas des données mesurées) :
   - type "niche" : concurrents directs = même créneau + même ville (ex. les restaurants de fruits de mer de cette ville). Omets ce classement si la niche est trop générique pour distinguer des concurrents directs.
   - type "general" : concurrents larges = même catégorie générale + même ville (ex. les restaurants de cette ville).
   Pour chaque classement : label explicite, competitors = 10 entrées classées (rank 1 à 10), avec le commerce analysé inséré à sa position réaliste (isTarget=true ; mets isTarget=false partout ailleurs). note = un signal court (« Guide Michelin », « 4,7★ · 900 avis », « ouvert depuis 1998 ») ou null. targetRank = le rang du commerce analysé (null s'il sort du top 10). Si commerce en ligne ou localisation inconnue : renvoie un tableau vide [].
11. webPresence : évalue la notoriété éditoriale hors-site. score (0-100). qualifications = labels/guides/distinctions réels et plausibles pour ce commerce (Guide Michelin, Gault&Millau, Petit Futé, label Qualité Tourisme, certification, prix…) — chaque entrée : label, source, detail ; liste VIDE si rien de crédible. articles = apparitions presse/blogs plausibles (titre + source) ; liste vide si aucune. findings = 2 à 4 constats sur la notoriété. Reste honnête : n'invente pas de distinction si elle est invraisemblable.
12. mapsCoherence : SI une fiche Google Maps a été fournie (« ${ctx.mapsUrl ?? "(non fournie)"} »), évalue la cohérence entre la fiche et le site (nom, catégorie, localisation, NAP, positionnement). score (0-100), summary, listingName (ou null), reviewCount et rating à null si tu ne peux pas les connaître de façon fiable, matches = points vérifiés (label, consistent, detail), findings. SI aucune fiche n'a été fournie : renvoie null.
13. onPageContent : audite les ÉLÉMENTS ON-PAGE RÉELS ci-dessus. Pour chaque élément, "text" = le contenu RÉEL repris tel quel (ou null s'il est absent), "status" (ok/warn/ko), "signals" = critères attendus avec present (true/false), "note" = un diagnostic court avec un conseil concret.
   - title : signals = []. status ok si clair et descriptif (marque + activité), warn si générique, ko si absent.
   - metaDescription : signals = EXACTEMENT [{ "label": "Adresse", "present": … }, { "label": "Niche", "present": … }, { "label": "Note", "present": … }] — l'adresse/ville, la niche du commerce et la note/avis (ex. « 4,8★ ») y figurent-elles ? status ok si les 3 présents, warn si 1-2, ko si absente ou aucun. Pour un commerce EN LIGNE, "Adresse" et "Note" peuvent légitimement être absents : explique-le dans note.
   - h1 : signals = EXACTEMENT [{ "label": "Mots-clés niche", "present": … }] — le H1 contient-il les mots-clés de la niche (« ${profile.niche} ») ? status en conséquence.
   - firstSentence : signals = EXACTEMENT [{ "label": "Résume l'activité", "present": … }, { "label": "Adresse / zone", "present": … }] — la 1ʳᵉ phrase résume-t-elle l'activité ET situe-t-elle le commerce (adresse/zone) ? status en conséquence.
   - openingHours : extrais les horaires d'ouverture du site (à partir de l'indice JSON-LD ET de l'extrait de contenu). Format court et lisible, ex. « Lun-Ven 9h-19h · Sam 9h-12h ». null si réellement introuvable.
14. Réponds en français, et n'emploie jamais de tiret cadratin (—) ni de tiret demi-cadratin (–) pour séparer deux idées : une virgule, un deux-points ou un point. Ce tiret est la marque la plus reconnaissable d'un texte écrit par une IA, et ces phrases sont lues par les clients.

FORMAT DE RÉPONSE — IMPÉRATIF :
Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après, sans bloc de code markdown. L'objet doit respecter exactement ce schéma JSON :
${JSON.stringify(OUTPUT_SCHEMA)}`;
}

/** Garde le seul nom du créneau : retire parenthèses et énumérations de spécialités. */
function cleanNicheLabel(s: string | undefined): string {
  return (s ?? "")
    .replace(/\([^)]*\)/g, "") // « Restaurant (Michelin, homard…) » → « Restaurant »
    .replace(/\s*[–—:].*$/, "") // coupe une énumération après tiret/deux-points
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProfile(
  p: Omit<BusinessProfile, "mode"> | undefined,
  ctx: AnalysisContext,
  fallbackType: string | undefined,
): BusinessProfile {
  const isPhysical = ctx.mode === "physical";
  return {
    mode: ctx.mode,
    isPhysical,
    niche: cleanNicheLabel(p?.niche) || cleanNicheLabel(fallbackType) || "Activité non déterminée",
    generalCategory: cleanNicheLabel(p?.generalCategory) || cleanNicheLabel(fallbackType) || "Commerce",
    location: isPhysical ? p?.location?.trim() || null : null,
  };
}

function normalizeRankings(
  list: LocalRanking[] | undefined,
  ctx: AnalysisContext,
): LocalRanking[] {
  if (ctx.mode !== "physical" || !Array.isArray(list)) return [];
  return list
    .filter((r) => r && Array.isArray(r.competitors) && r.competitors.length > 0)
    .slice(0, 2)
    .map((r) => {
      const competitors: Competitor[] = r.competitors
        .slice(0, MAX_RANK_ITEMS)
        .map((c, i) => ({
          rank: Math.max(1, Math.round(c.rank ?? i + 1)),
          name: c.name?.trim() || "—",
          isTarget: !!c.isTarget,
          note: c.note?.trim() || null,
        }))
        .sort((a, b) => a.rank - b.rank);
      const targetRank = competitors.find((c) => c.isTarget)?.rank ?? r.targetRank ?? null;
      return {
        type: r.type === "niche" ? "niche" : ("general" as const),
        label: r.label?.trim() || "",
        targetRank: targetRank != null ? Math.round(targetRank) : null,
        competitors,
      };
    });
}

function normalizeWebPresence(w: WebPresence | undefined): WebPresence {
  return {
    score: clamp(w?.score ?? 0),
    summary: w?.summary?.trim() || "Notoriété éditoriale non évaluée.",
    qualifications: Array.isArray(w?.qualifications)
      ? w.qualifications
          .filter((q) => q?.label?.trim())
          .map((q) => ({
            label: q.label.trim(),
            source: q.source?.trim() || "",
            detail: q.detail?.trim() || "",
          }))
      : [],
    articles: Array.isArray(w?.articles)
      ? w.articles
          .filter((a) => a?.title?.trim())
          .map((a) => ({ title: a.title.trim(), source: a.source?.trim() || "" }))
      : [],
    findings: Array.isArray(w?.findings) ? w.findings.filter((f) => f?.trim()) : [],
  };
}

/** Normalise un élément on-page : statut borné, signaux filtrés, texte de repli. */
function normalizeCheck(c: OnPageCheck | undefined, fallbackText: string | null): OnPageCheck {
  const status: OnPageCheck["status"] =
    c?.status === "ok" || c?.status === "warn" || c?.status === "ko" ? c.status : "ko";
  const text = c?.text?.trim() || fallbackText || null;
  return {
    text,
    status: text ? status : "ko",
    signals: Array.isArray(c?.signals)
      ? c.signals
          .filter((s) => s?.label?.trim())
          .map((s) => ({ label: s.label.trim(), present: !!s.present }))
      : [],
    note: c?.note?.trim() || "",
  };
}

/** Audit on-page déterministe (sans IA) : présence brute des éléments clés. */
function heuristicOnPage(signals: SiteSignals): OnPageContent {
  const present = (text: string | null): OnPageCheck => ({
    text: text || null,
    status: text ? "warn" : "ko",
    signals: [],
    note: text
      ? "Analyse approfondie indisponible (clé API IA non configurée)."
      : "Élément absent de la page d'accueil.",
  });
  return {
    title: present(signals.title),
    metaDescription: present(signals.metaDescription),
    h1: present(signals.h1[0] ?? null),
    firstSentence: present(signals.firstParagraph),
    openingHours: signals.openingHoursHint,
  };
}

/** Normalise l'audit on-page : retombe sur les signaux réels si le modèle omet le texte. */
function normalizeOnPage(o: OnPageContent | undefined, signals: SiteSignals): OnPageContent {
  const hours = typeof o?.openingHours === "string" ? o.openingHours.trim() : "";
  return {
    title: normalizeCheck(o?.title, signals.title),
    metaDescription: normalizeCheck(o?.metaDescription, signals.metaDescription),
    h1: normalizeCheck(o?.h1, signals.h1[0] ?? null),
    firstSentence: normalizeCheck(o?.firstSentence, signals.firstParagraph),
    openingHours: hours || signals.openingHoursHint || null,
  };
}

function normalizeCoherence(
  c: MapsCoherence | null | undefined,
  listing?: MapsListing | null,
): MapsCoherence | null {
  if (!c) return null;
  // Les données scrapées réelles priment sur l'estimation du modèle.
  const realRating = listing?.rating ?? null;
  const realReviews = listing?.reviewCount ?? null;
  const realName = listing?.listingName ?? null;
  return {
    score: clamp(c.score ?? 0),
    summary: c.summary?.trim() || "",
    listingName: realName || c.listingName?.trim() || null,
    reviewCount: realReviews != null ? realReviews : c.reviewCount != null ? Math.max(0, Math.round(c.reviewCount)) : null,
    rating: realRating != null ? realRating : c.rating != null ? Math.max(0, Math.min(5, c.rating)) : null,
    matches: Array.isArray(c.matches)
      ? c.matches
          .filter((m) => m?.label?.trim())
          .map((m) => ({
            label: m.label.trim(),
            consistent: !!m.consistent,
            detail: m.detail?.trim() || "",
          }))
      : [],
    findings: Array.isArray(c.findings) ? c.findings.filter((f) => f?.trim()) : [],
  };
}

/* ------------------------- Schémas des réponses IA ------------------------- */

/**
 * Ce que l'on exige du modèle, et rien de plus.
 *
 * Les normaliseurs ci-dessus réparent déjà tout ce qui manque : ce schéma ne
 * sert donc qu'à repérer une réponse franchement hors-sujet, celle qui ferait
 * basculer `askJson` sur le fournisseur de secours plutôt que de remplir le
 * tableau de bord de vide. On exige le verdict, les notes et le plan d'action —
 * sans eux, il n'y a pas d'audit.
 */
const AUDIT_RESPONSE_SCHEMA = z.object({
  businessName: z.string().optional(),
  businessType: z.string().optional(),
  verdict: z.string().min(1),
  categories: z
    .array(z.object({ key: z.string() }).loose())
    .min(1),
  recommendations: z
    .array(z.object({ title: z.string() }).loose())
    .min(1),
  engines: z.array(z.unknown()).optional(),
  profile: z.unknown().optional(),
  localRankings: z.array(z.unknown()).optional(),
  webPresence: z.unknown().optional(),
  mapsCoherence: z.unknown().nullish(),
  onPageContent: z.unknown().optional(),
  googleSeo: z.unknown().optional(),
  aiSimulation: z.unknown().optional(),
});

/** Forme attendue de l'audit, une fois le garde-fou passé. */
type AuditResponse = {
  businessName: string;
  businessType: string;
  verdict: string;
  categories: CategoryScore[];
  engines: {
    engine: AiEngine;
    score?: number;
    estimatedPosition?: number | null;
    visibility?: EngineScore["visibility"];
    summary?: string;
    competitorsAhead?: string[];
  }[];
  profile: Omit<BusinessProfile, "mode">;
  localRankings: LocalRanking[];
  webPresence: WebPresence;
  onPageContent: OnPageContent;
  mapsCoherence: MapsCoherence | null;
  googleSeo: GoogleSeo;
  recommendations: Recommendation[];
  aiSimulation: AiSimulation;
};

const PROFILE_RESPONSE_SCHEMA = z.object({
  businessName: z.string().optional(),
  niche: z.string().min(1),
  generalCategory: z.string().optional(),
  location: z.string().nullish(),
});

const BACKLINKS_RESPONSE_SCHEMA = z.object({
  estimatedCount: z.number().nullish(),
  notableSources: z
    .array(z.object({ domain: z.string().optional(), note: z.string().optional() }))
    .optional(),
  summary: z.string().optional(),
});

/**
 * ÉTAPE 1 — Détection de la niche EN TOUT PREMIER.
 * C'est le pivot des recherches de concurrents : la niche et la localisation
 * relevées ici alimentent la requête « top 10 » envoyée aux trois moteurs. Appel
 * court et économe, volontairement distinct de l'audit complet.
 */
async function detectProfile(
  signals: SiteSignals,
  ctx: AnalysisContext,
): Promise<{ profile: BusinessProfile; businessName: string }> {
  const modeLabel =
    ctx.mode === "physical" ? "Commerce physique (établissement local)" : "Commerce en ligne";

  const prompt = `Tu détectes le profil commercial d'un site, à partir de ses signaux. C'est l'étape qui sert ENSUITE à chercher les concurrents : sois précis sur la niche.

Type déclaré par l'utilisateur : ${modeLabel}
URL : ${signals.url}
Domaine : ${signals.domain}
Titre : ${signals.title ?? "(absent)"}
Meta description : ${signals.metaDescription ?? "(absente)"}
H1 : ${signals.h1.join(" | ") || "(aucun)"}
Extrait de contenu :
"""
${(signals.textSample || "").slice(0, 4000)}
"""

RÈGLE IMPORTANTE pour "niche" : donne UNIQUEMENT le nom court du créneau (2 à 5 mots), SANS parenthèses, SANS énumération de spécialités, SANS qualificatifs ni labels. Exemple correct : « Restaurant de poissons et fruits de mer ». Exemple INTERDIT : « Restaurant de poissons et fruits de mer (Guide Michelin, pêche locale, homard…) ».

Renvoie UNIQUEMENT un objet JSON, sans texte ni markdown autour :
{
  "businessName": "nom de l'entreprise déduit",
  "niche": "nom court du créneau, sans parenthèses (ex. « Restaurant de fruits de mer », « Salle de sport CrossFit », « Boulangerie bio »)",
  "generalCategory": "catégorie large, sans parenthèses (ex. « Restaurant », « Salle de sport », « Boulangerie »)",
  "location": "ville/zone précise SI commerce physique et identifiable, sinon null"
}`;

  const parsed = await askJson(PROFILE_RESPONSE_SCHEMA, {
    system:
      "Tu qualifies le créneau commercial d'un site à partir de ses signaux. " +
      "Tu réponds uniquement par un objet JSON valide.",
    prompt,
    maxTokens: 600,
  });
  const profile = normalizeProfile(
    {
      niche: parsed.niche ?? "",
      generalCategory: parsed.generalCategory ?? "",
      location: parsed.location ?? null,
      isPhysical: ctx.mode === "physical",
    },
    ctx,
    parsed.niche || parsed.businessName,
  );
  return { profile, businessName: parsed.businessName?.trim() || "" };
}

/** Profil de repli (sans clé de modèle, ou si la détection échoue). */
function fallbackProfile(signals: SiteSignals, ctx: AnalysisContext): BusinessProfile {
  const name = signals.title?.split(/[|\-–—]/)[0].trim() || signals.domain;
  return {
    mode: ctx.mode,
    isPhysical: ctx.mode === "physical",
    niche: name,
    generalCategory: "Commerce",
    location: null,
  };
}

/**
 * Estimation des backlinks et des sources référentes.
 *
 * Le modèle de service ne dispose pas de recherche web : ce qu'il rend est une
 * ESTIMATION à partir de ce qu'il connaît de la niche, jamais un relevé. C'est
 * pour cela que `measured` reste à false — l'interface annonce alors une
 * estimation, et non un chiffre mesuré.
 */
async function estimateBacklinks(
  signals: SiteSignals,
  profile: BusinessProfile,
): Promise<Backlinks> {
  const loc = profile.location ? ` à ${profile.location}` : "";
  const prompt = `Estime les sources qui citent ou pointent vers le site « ${signals.domain} » (${profile.niche}${loc}). Identifie les SOURCES RÉFÉRENTES NOTABLES plausibles (annuaires, presse, guides, plateformes d'avis, partenaires) et donne un ORDRE DE GRANDEUR du nombre de domaines référents. Sois honnête : si rien de fiable, estimatedCount = null et notableSources = [].

Réponds UNIQUEMENT par un objet JSON, sans texte autour :
{
  "estimatedCount": <entier estimé de domaines référents, ou null>,
  "notableSources": [ { "domain": "exemple.fr", "note": "annuaire / presse / guide …" } ],
  "summary": "1-2 phrases de synthèse sur la notoriété de liens"
}`;

  geoLog("Backlinks — estimation par le modèle de service…");
  const parsed = await askJson(BACKLINKS_RESPONSE_SCHEMA, {
    system:
      "Tu estimes la notoriété de liens d'un site. Tu n'inventes jamais un domaine " +
      "dont tu ignores l'existence. Tu réponds uniquement par un objet JSON valide.",
    prompt,
    maxTokens: 1500,
  });
  const notableSources: ReferringSource[] = Array.isArray(parsed.notableSources)
    ? parsed.notableSources
        .filter((s) => s?.domain?.trim())
        .slice(0, 8)
        .map((s) => ({ domain: s.domain!.trim(), note: s.note?.trim() || "" }))
    : [];
  return {
    estimatedCount:
      typeof parsed.estimatedCount === "number" && parsed.estimatedCount >= 0
        ? Math.round(parsed.estimatedCount)
        : null,
    notableSources,
    summary: parsed.summary?.trim() || "Estimation des sources référentes de la niche.",
    // Estimation, pas relevé : l'interface doit pouvoir le dire.
    measured: false,
  };
}

/**
 * ÉTAPE 2 — Audit complet : produit les notes et les conclusions de TOUTES les
 * parties du tableau de bord selon la méthodologie geo-audit. Reçoit le profil
 * déjà détecté (il ne le re-détecte pas) et les classements déjà mesurés auprès
 * des moteurs (il ne les réestime pas).
 */
async function analyzeWithModel(
  signals: SiteSignals,
  ctx: AnalysisContext,
  profile: BusinessProfile,
  mapsListing: MapsListing | null,
  measured: Record<AiEngine, MeasuredEngine | null>,
): Promise<EngineCore> {
  const raw = await askJson(AUDIT_RESPONSE_SCHEMA, {
    system:
      "Tu es un expert GEO (Generative Engine Optimization) et SEO. " +
      "Tu rends un audit complet sous forme d'un unique objet JSON valide, sans texte autour.",
    prompt: buildPrompt(signals, ctx, profile, mapsListing, measured),
    maxTokens: AUDIT_MAX_TOKENS,
  });
  // Le schéma garantit le squelette ; les normaliseurs ci-dessous réparent le
  // détail. Le typage nominal reprend donc la main ici.
  const parsed = raw as unknown as AuditResponse;

  // Normalisation des scores
  const categories: CategoryScore[] = CATEGORY_KEYS.map((key) => {
    const found = parsed.categories.find((c) => c.key === key);
    return {
      key,
      score: clamp(found?.score ?? 0),
      summary: found?.summary ?? "Données insuffisantes pour évaluer cette catégorie.",
      findings: found?.findings ?? [],
    };
  });

  const estName = parsed.businessName || signals.domain;
  const directLbl = rankingLabel(profile, "direct");
  const engines: EngineScore[] = ALL_ENGINES.map((engine) => {
    const found = parsed.engines?.find((e) => e.engine === engine);
    const estPos =
      found?.estimatedPosition != null ? Math.max(1, Math.round(found.estimatedPosition)) : null;
    const ahead = Array.isArray(found?.competitorsAhead) ? found.competitorsAhead.slice(0, 3) : [];
    return {
      engine,
      score: clamp(found?.score ?? 0),
      visibility: found?.visibility ?? "absente",
      summary: found?.summary ?? "Non évalué.",
      measured: false,
      rankings: [estimateToRanking("direct", directLbl, estPos, ahead, estName)],
    };
  });

  return {
    url: signals.url,
    domain: signals.domain,
    businessName: parsed.businessName || signals.domain,
    businessType: parsed.businessType || profile.niche || "Non déterminé",
    profile, // autorité : profil détecté en amont par Sonnet 4.6
    localRankings: normalizeRankings(parsed.localRankings, ctx),
    webPresence: normalizeWebPresence(parsed.webPresence),
    onPageContent: normalizeOnPage(parsed.onPageContent, signals),
    mapsCoherence: ctx.mapsUrl ? normalizeCoherence(parsed.mapsCoherence, mapsListing) : null,
    verdict: parsed.verdict,
    categories,
    engines,
    googleSeo: {
      score: clamp(parsed.googleSeo?.score ?? 0),
      positioning: parsed.googleSeo?.positioning ?? "Non déterminé",
      summary: parsed.googleSeo?.summary ?? "",
      findings: parsed.googleSeo?.findings ?? [],
      topKeywords: parsed.googleSeo?.topKeywords ?? [],
    },
    recommendations: parsed.recommendations
      .map((r) => ({ ...r, impact: Math.max(1, Math.min(10, Math.round(r.impact || 1))) }))
      .sort((a, b) => b.impact - a.impact),
    aiSimulation: parsed.aiSimulation,
  };
}

/** Construit un EngineScore heuristique (estimation on-page, sans appel moteur). */
function deriveEngine(
  engine: AiEngine,
  score: number,
  crawlersOk: boolean,
  profile: BusinessProfile,
): EngineScore {
  const effective = crawlersOk ? score : Math.min(score, 25);
  const visibility: EngineScore["visibility"] =
    effective >= 70 ? "forte" : effective >= 50 ? "moyenne" : effective >= 30 ? "faible" : "absente";
  const estimatedPosition =
    effective >= 70 ? 2 : effective >= 50 ? 4 : effective >= 30 ? 7 : null;
  return {
    engine,
    score: effective,
    visibility,
    summary: crawlersOk
      ? `Visibilité ${visibility} estimée sur ce moteur.`
      : "Crawler IA bloqué : visibilité fortement limitée.",
    measured: false,
    rankings: [estimateToRanking("direct", rankingLabel(profile, "direct"), estimatedPosition, [], "")],
  };
}

// Fallback heuristique (sans clé API) : garde l'application fonctionnelle.
function heuristicAnalysis(
  signals: SiteSignals,
  ctx: AnalysisContext,
  profile: BusinessProfile,
): EngineCore {
  const s = signals;
  const technical = clamp(
    (s.hasHttps ? 35 : 0) +
      (s.hasViewport ? 20 : 0) +
      (s.hasRobotsTxt ? 15 : 0) +
      (s.hasSitemap ? 15 : 0) +
      (s.fetchedOk ? 15 : 0),
  );
  const structuredData = clamp(
    (s.jsonLdCount > 0 ? 40 : 0) + Math.min(60, s.jsonLdCount * 20),
  );
  const citability = clamp(
    (s.wordCount > 300 ? 30 : 10) +
      (s.headingCount > 3 ? 25 : 10) +
      (s.metaDescription ? 15 : 0) +
      (s.crawlers.every((c) => c.allowed) ? 20 : 0) +
      (s.hasLlmsTxt ? 10 : 0),
  );
  const contentEEAT = clamp(
    (s.wordCount > 600 ? 35 : 15) +
      (s.h1.length > 0 ? 20 : 0) +
      (s.title ? 15 : 0) +
      (s.imagesWithoutAlt === 0 ? 10 : 0),
  );
  const brandAuthority = clamp((s.hasOpenGraph ? 30 : 15) + (s.title ? 20 : 0) + 15);
  const platform = clamp(
    (s.jsonLdCount > 0 ? 25 : 5) +
      (s.metaDescription ? 25 : 5) +
      (s.crawlers.every((c) => c.allowed) ? 25 : 5),
  );

  const blocked = s.crawlers.filter((c) => !c.allowed).map((c) => c.name);
  const categories: CategoryScore[] = [
    {
      key: "citability",
      score: citability,
      summary: "Évaluation heuristique de la facilité d'extraction du contenu par les IA.",
      findings: [
        `Contenu : ${s.wordCount} mots, ${s.headingCount} titres.`,
        blocked.length
          ? `Crawlers IA bloqués : ${blocked.join(", ")}.`
          : "Aucun crawler IA majeur n'est bloqué.",
        s.hasLlmsTxt
          ? "Fichier llms.txt présent."
          : s.llmsTxtMisconfigured
            ? "Un llms.txt existe mais le serveur le renvoie en 404 (au lieu de 200) : les IA l'ignorent — à corriger en priorité."
            : "Pas de fichier llms.txt.",
      ],
    },
    {
      key: "brandAuthority",
      score: brandAuthority,
      summary: "Signaux d'autorité de marque détectables sur la page.",
      findings: [s.hasOpenGraph ? "Balises Open Graph présentes." : "Pas de balises Open Graph."],
    },
    {
      key: "contentEEAT",
      score: contentEEAT,
      summary: "Profondeur et signaux E-E-A-T du contenu.",
      findings: [
        `${s.wordCount} mots de contenu.`,
        s.imagesWithoutAlt > 0 ? `${s.imagesWithoutAlt} image(s) sans alt.` : "Toutes les images ont un alt.",
      ],
    },
    {
      key: "technical",
      score: technical,
      summary: "Fondations techniques nécessaires à la crawlabilité.",
      findings: [
        s.hasHttps ? "HTTPS actif." : "HTTPS absent.",
        s.hasViewport ? "Viewport mobile configuré." : "Viewport mobile manquant.",
        s.hasSitemap ? "Sitemap détecté." : "Sitemap manquant.",
      ],
    },
    {
      key: "structuredData",
      score: structuredData,
      summary: "Présence et richesse des données structurées JSON-LD.",
      findings: [
        s.jsonLdCount > 0
          ? `Types détectés : ${s.jsonLdTypes.join(", ")}.`
          : "Aucune donnée structurée JSON-LD détectée.",
      ],
    },
    {
      key: "platform",
      score: platform,
      summary: "Préparation aux plateformes de recherche IA.",
      findings: [s.metaDescription ? "Meta description présente." : "Meta description manquante."],
    },
  ];

  const recommendations: Recommendation[] = [];
  if (s.jsonLdCount === 0)
    recommendations.push({
      title: "Ajouter des données structurées JSON-LD",
      description:
        "Implémentez le schema Organization et un schema adapté à votre activité (LocalBusiness, Product, Article…) pour aider les IA à comprendre votre entité.",
      priority: "critique",
      category: "structuredData",
      impact: 9,
    });
  if (blocked.length)
    recommendations.push({
      title: "Débloquer les crawlers IA",
      description: `Votre robots.txt bloque ${blocked.join(", ")}. Autorisez-les pour apparaître dans les réponses IA.`,
      priority: "critique",
      category: "citability",
      impact: 10,
    });
  if (!s.hasLlmsTxt)
    recommendations.push({
      title: "Publier un fichier llms.txt",
      description:
        "Créez un fichier /llms.txt décrivant la structure et les contenus clés de votre site pour les modèles d'IA.",
      priority: "moyenne",
      category: "platform",
      impact: 5,
    });
  if (s.wordCount < 600)
    recommendations.push({
      title: "Enrichir le contenu avec des passages auto-portants",
      description:
        "Rédigez des paragraphes de 40-160 mots qui répondent directement à une question, avec des faits et des chiffres précis citables par les IA.",
      priority: "haute",
      category: "citability",
      impact: 8,
    });
  if (!s.hasSitemap)
    recommendations.push({
      title: "Générer un sitemap.xml",
      description: "Publiez un sitemap et déclarez-le dans robots.txt pour faciliter l'exploration.",
      priority: "moyenne",
      category: "technical",
      impact: 5,
    });
  recommendations.push({
    title: "Renforcer les mentions de marque",
    description:
      "Développez votre présence sur Wikipedia, Reddit, LinkedIn et la presse spécialisée : les mentions corrèlent 3x plus que les backlinks pour la citation par les IA.",
    priority: "haute",
    category: "brandAuthority",
    impact: 7,
  });

  // Même plafond que la note finale de l'aperçu : le verdict ne doit jamais
  // annoncer « bonne base » sur une analyse dont il manque la moitié des mesures.
  const overall = Math.min(computeOverall(categories), FREE_SCORE_CAP);

  // Scores par moteur dérivés des catégories (pondérations différenciées)
  const allCrawlersOk = s.crawlers.every((c) => c.allowed);
  const engines: EngineScore[] = [
    // ChatGPT Search : autorité + structure
    deriveEngine("ChatGPT", clamp(citability * 0.5 + brandAuthority * 0.3 + technical * 0.2), allCrawlersOk, profile),
    // Gemini : écosystème Google + données structurées
    deriveEngine("Gemini", clamp(structuredData * 0.4 + technical * 0.35 + citability * 0.25), allCrawlersOk, profile),
    // Claude : profondeur éditoriale et passages auto-portants avant tout
    deriveEngine("Claude", clamp(contentEEAT * 0.45 + citability * 0.35 + brandAuthority * 0.2), allCrawlersOk, profile),
  ];

  const googleScore = clamp(technical * 0.4 + contentEEAT * 0.35 + structuredData * 0.25);
  const googleSeo: GoogleSeo = {
    score: googleScore,
    positioning:
      googleScore >= 70 ? "Page 1 (top 5) potentielle" : googleScore >= 45 ? "Page 2-3 estimée" : "Faiblement positionné",
    summary:
      "Estimation SEO automatique basée sur les signaux on-page (clé API IA non configurée pour une analyse approfondie).",
    findings: [
      s.title ? `Balise title : « ${s.title} »` : "Balise title manquante.",
      s.metaDescription ? "Meta description présente." : "Meta description manquante.",
      s.hasSitemap ? "Sitemap détecté." : "Sitemap manquant.",
    ],
    topKeywords: s.h1.length ? s.h1.slice(0, 3) : [s.domain],
  };

  const businessName = s.title?.split(/[|\-–—]/)[0].trim() || s.domain;
  return {
    url: s.url,
    domain: s.domain,
    businessName,
    businessType: profile.niche || "Estimation automatique (clé API IA non configurée)",
    profile,
    localRankings: [],
    webPresence: {
      score: clamp(brandAuthority * 0.6),
      summary:
        "Notoriété éditoriale non analysée (clé API IA non configurée) : seuls les signaux on-page sont pris en compte.",
      qualifications: [],
      articles: [],
      findings: [
        s.hasOpenGraph
          ? "Balises Open Graph présentes : partage social facilité."
          : "Pas de balises Open Graph : faible reprise sur les réseaux.",
      ],
    },
    mapsCoherence: null,
    onPageContent: heuristicOnPage(s),
    engines,
    googleSeo,
    verdict:
      overall >= 70
        ? "Bonne base de visibilité IA, quelques optimisations à saisir."
        : overall >= 45
          ? "Visibilité IA partielle : des leviers importants restent inexploités."
          : "Visibilité IA faible : le site risque d'être invisible dans les réponses générées par l'IA.",
    categories,
    recommendations: recommendations.sort((a, b) => b.impact - a.impact),
    aiSimulation: {
      query: `meilleur ${s.title?.split(/[|\-–—]/)[0].trim() || "service"} près de chez moi`,
      engine: "ChatGPT",
      appearsInResults: overall >= 55,
      position: overall >= 55 ? 3 : null,
      competitorsAhead:
        overall >= 55 ? ["Annuaires spécialisés", "Concurrents avec schema complet"] : ["Concurrents mieux optimisés", "Plateformes d'avis"],
      explanation:
        overall >= 55
          ? "Le site dispose des bases pour être cité, mais des concurrents mieux structurés peuvent passer devant."
          : "Sans données structurées riches ni passages citables, l'IA privilégiera d'autres sources.",
    },
  };
}

type RankingScope = "direct" | "indirect";

/** Libellé d'un classement (niche précise = direct, catégorie générale = indirect). */
function rankingLabel(profile: BusinessProfile, scope: RankingScope): string {
  const loc = profile.isPhysical && profile.location ? ` à ${profile.location}` : "";
  const base =
    scope === "direct"
      ? profile.niche?.trim() || profile.generalCategory?.trim() || "commerces"
      : profile.generalCategory?.trim() || "commerces";
  return `${base}${loc}`;
}

/**
 * Requête envoyée aux moteurs (GPT/Gemini), formulée comme un utilisateur grand
 * public : TOP 10 du créneau. `direct` = niche précise (concurrents directs),
 * `indirect` = catégorie générale (concurrents indirects). Format minimal pour un
 * parsing fiable et un faible coût en tokens.
 */
function buildEngineQuery(profile: BusinessProfile, scope: RankingScope): string {
  return `Donne le classement des 10 meilleurs ${rankingLabel(profile, scope)}. Réponds UNIQUEMENT par la liste, un établissement par ligne, au format « 1. Nom de l'établissement », du meilleur au moins bon. Pas d'introduction, pas d'explication, pas de mise en gras, pas de commentaire.`;
}

/** Doit-on chercher les concurrents INDIRECTS (catégorie générale) ?
 *  Uniquement commerce physique localisé ayant une vraie niche distincte. */
function wantsIndirect(profile: BusinessProfile): boolean {
  if (!profile.isPhysical || !profile.location) return false;
  const niche = cleanNicheLabel(profile.niche).toLowerCase();
  const general = cleanNicheLabel(profile.generalCategory).toLowerCase();
  return !!niche && !!general && niche !== general;
}

/** Construit un classement RÉEL (EngineRanking) depuis la réponse d'un moteur. */
function rankingFromLive(
  live: LiveEngineResult,
  scope: RankingScope,
  label: string,
  domain: string,
  name: string,
): EngineRanking | null {
  const m = measureEngine(live, domain, name);
  if (!m.measured) return null;
  const competitors: Competitor[] = live.rankedItems.slice(0, 10).map((nm, i) => ({
    rank: i + 1,
    name: nm,
    isTarget: m.position === i + 1,
    note: null,
  }));
  return { scope, label, measured: true, targetRank: m.position, competitors };
}

/**
 * Convertit un classement de marché estimé par le modèle (LocalRanking, top 10)
 * en EngineRanking. Sert de repli quand l'appel moteur live a échoué : on
 * conserve ainsi un classement direct ET indirect par moteur.
 */
function localToEngineRanking(lr: LocalRanking, scope: RankingScope): EngineRanking {
  return {
    scope,
    label: lr.label,
    measured: false,
    targetRank: lr.targetRank,
    competitors: lr.competitors,
  };
}

/** Construit un classement ESTIMÉ depuis position + concurrents devant. */
function estimateToRanking(
  scope: RankingScope,
  label: string,
  estimatedPosition: number | null,
  competitorsAhead: string[],
  businessName: string,
): EngineRanking {
  const competitors: Competitor[] = competitorsAhead
    .slice(0, 3)
    .map((nm, i) => ({ rank: i + 1, name: nm, isTarget: false, note: null }));
  if (estimatedPosition != null) {
    competitors.push({ rank: Math.max(1, estimatedPosition), name: businessName, isTarget: true, note: null });
    competitors.sort((a, b) => a.rank - b.rank);
  }
  return { scope, label, measured: false, targetRank: estimatedPosition, competitors };
}

function visibilityFromPosition(
  pos: number | null,
  cited: boolean,
): EngineScore["visibility"] {
  if (pos == null) return cited ? "faible" : "absente";
  if (pos <= 2) return "forte";
  if (pos <= 5) return "moyenne";
  return "faible";
}

/** Score GEO d'un moteur déduit de sa position RÉELLE mesurée. */
function scoreFromMeasure(m: MeasuredEngine): number {
  if (m.position == null) return m.cited ? 45 : 20;
  if (m.position <= 1) return 95;
  if (m.position <= 2) return 85;
  if (m.position <= 3) return 75;
  if (m.position <= 5) return 60;
  if (m.position <= 10) return 45;
  return 30;
}

/** Résumé d'un moteur à partir de sa position RÉELLE mesurée. */
function summaryFromMeasure(engine: AiEngine, m: MeasuredEngine): string {
  if (m.position != null) {
    const ahead = m.competitorsAhead.length ? ` Devant lui : ${m.competitorsAhead.join(", ")}.` : "";
    return `Classé n°${m.position} par ${engine} sur la requête testée.${ahead}`;
  }
  return m.cited
    ? `${engine} mentionne ce commerce mais sans position de tête claire.`
    : `${engine} ne cite pas ce commerce dans son classement.`;
}

/**
 * Construit les scores moteurs finaux. Pour chaque moteur, si un classement
 * DIRECT réel a été mesuré → on l'utilise (score/visibilité/résumé dérivés du
 * réel) avec ses classements (direct + éventuel indirect). Sinon → estimation
 * Claude. Aucune estimation Claude n'écrase une donnée réelle.
 * Ordre garanti : ChatGPT en premier (ALL_ENGINES).
 */
function combineEngines(
  estimatedEngines: EngineScore[],
  measuredDirect: Record<AiEngine, MeasuredEngine | null>,
  measuredRankings: Record<AiEngine, EngineRanking[]>,
  localRankings: LocalRanking[],
  profile: BusinessProfile,
): EngineScore[] {
  const nicheLr = localRankings.find((r) => r.type === "niche") ?? null;
  const generalLr = localRankings.find((r) => r.type === "general") ?? null;
  const indirectWanted = wantsIndirect(profile);

  return ALL_ENGINES.map((engine) => {
    const m = measuredDirect[engine];
    const base: EngineScore = m
      ? {
          engine,
          score: scoreFromMeasure(m),
          visibility: visibilityFromPosition(m.position, m.cited),
          summary: summaryFromMeasure(engine, m),
          measured: true,
          rankings: [...measuredRankings[engine]],
        }
      : (estimatedEngines.find((e) => e.engine === engine) ?? {
          engine,
          score: 0,
          visibility: "absente" as const,
          summary: "Non évalué.",
          measured: false,
          rankings: [],
        });

    // Garantit qu'un moteur a TOUJOURS son classement direct ET indirect, même
    // si l'appel live a échoué : on retombe sur l'estimation de marché du modèle
    // (localRankings « niche » = direct, « general » = indirect).
    const rankings = [...base.rankings];
    if (!rankings.some((r) => r.scope === "direct") && nicheLr) {
      rankings.unshift(localToEngineRanking(nicheLr, "direct"));
    }
    if (indirectWanted && !rankings.some((r) => r.scope === "indirect") && generalLr) {
      rankings.push(localToEngineRanking(generalLr, "indirect"));
    }
    return { ...base, rankings };
  });
}

/**
 * Reprend UNIQUEMENT les classements, sur une analyse déjà faite.
 *
 * C'est ce que le tableau de bord relance semaine après semaine : la place du
 * commerce dans ChatGPT, Gemini et Claude bouge, pas la structure de son site.
 * On réinterroge donc les trois moteurs par leurs API respectives — eux seuls
 * connaissent leur propre réponse — sans repayer l'audit complet.
 *
 * Un moteur qui ne répond pas garde sa dernière mesure connue plutôt que de
 * disparaître : une absence de réponse n'est pas une perte de position.
 */
export async function refreshEngineRankings(
  result: GeoAnalysisResult,
): Promise<{ engines: EngineScore[]; liveQuery: string | null }> {
  const unchanged = { engines: result.engines, liveQuery: result.liveQuery ?? null };
  if (!hasAnyEngineKey()) {
    geoLog("Classements — aucune clé moteur configurée, relevé ignoré");
    return unchanged;
  }

  const profile = result.profile;
  const matchName = result.businessName || result.domain;
  const directQuery = buildEngineQuery(profile, "direct");
  const indirectQuery = wantsIndirect(profile) ? buildEngineQuery(profile, "indirect") : null;

  const measuredDirect: Record<AiEngine, MeasuredEngine | null> = {
    ChatGPT: null,
    Gemini: null,
    Claude: null,
  };
  const measuredRankings: Record<AiEngine, EngineRanking[]> = {
    ChatGPT: [],
    Gemini: [],
    Claude: [],
  };

  geoLog("Classements — relevé des trois moteurs", {
    direct: directQuery,
    indirect: indirectQuery ?? "(non — commerce non physique ou sans niche distincte)",
  });

  const [directLives, indirectLives] = await Promise.all([
    gatherLiveEngines(directQuery).catch((err) => {
      console.error("Appels moteurs (direct) échoués :", err);
      return [] as LiveEngineResult[];
    }),
    indirectQuery
      ? gatherLiveEngines(indirectQuery).catch((err) => {
          console.error("Appels moteurs (indirect) échoués :", err);
          return [] as LiveEngineResult[];
        })
      : Promise.resolve([] as LiveEngineResult[]),
  ]);

  const directLbl = rankingLabel(profile, "direct");
  const indirectLbl = rankingLabel(profile, "indirect");
  for (const live of directLives) {
    if (!live.available || !live.answered) continue;
    const m = measureEngine(live, result.domain, matchName);
    if (!m.measured) continue;
    measuredDirect[live.engine] = m;
    const r = rankingFromLive(live, "direct", directLbl, result.domain, matchName);
    if (r) measuredRankings[live.engine].push(r);
  }
  for (const live of indirectLives) {
    if (!live.available || !live.answered) continue;
    const r = rankingFromLive(live, "indirect", indirectLbl, result.domain, matchName);
    if (r) measuredRankings[live.engine].push(r);
  }

  const fresh = ALL_ENGINES.filter((e) => measuredDirect[e]);
  if (fresh.length === 0) {
    geoLog("Classements — aucun moteur n'a répondu, dernières mesures conservées");
    return unchanged;
  }

  const engines = combineEngines(
    result.engines,
    measuredDirect,
    measuredRankings,
    result.localRankings,
    profile,
  );
  geoLog(
    "Classements — relevé terminé",
    engines.map((e) => ({
      moteur: e.engine,
      mesuré: e.measured,
      rang: e.rankings.find((r) => r.scope === "direct")?.targetRank ?? null,
    })),
  );
  return { engines, liveQuery: directQuery };
}

export async function analyzeSite(
  signals: SiteSignals,
  ctx: AnalysisContext,
  /**
   * "free" : aucun appel payant (ni modèle d'audit, ni moteurs live) — seulement le
   * crawl déterministe + l'estimation heuristique. C'est l'analyse lancée à la
   * création, gratuite par défaut, pour ne JAMAIS facturer un visiteur qui ne
   * paie pas. "paid" : audit complet, déclenché une seule fois au déblocage.
   */
  tier: "free" | "paid",
): Promise<GeoAnalysisResult> {
  const useApis = tier === "paid";
  const hasKey = useApis && isAiConfigured();
  geoLog("Analyse démarrée", {
    url: signals.url,
    mode: ctx.mode,
    mapsUrl: ctx.mapsUrl,
    tier,
    modèleAudit: hasKey,
    moteursKey: useApis && hasAnyEngineKey(),
  });

  // ÉTAPE 1 — Détecter la niche EN TOUT PREMIER (Sonnet 4.6) : pivot des
  // recherches de concurrents (requête « top 10 » envoyée à OpenAI/Gemini).
  let profile: BusinessProfile;
  let detectedName = "";
  if (hasKey) {
    try {
      geoLog("Étape 1 — Détection de la niche…");
      const d = await detectProfile(signals, ctx);
      profile = d.profile;
      detectedName = d.businessName;
    } catch (err) {
      console.error("Détection de niche échouée, profil de repli :", err);
      profile = fallbackProfile(signals, ctx);
    }
  } else {
    profile = fallbackProfile(signals, ctx);
  }
  geoLog("Étape 1 — Niche détectée", {
    niche: profile.niche,
    generalCategory: profile.generalCategory,
    location: profile.location,
  });

  // Scraping best-effort de la fiche Maps (gratuit) AVANT l'audit, pour fournir
  // au modèle les vraies note/avis/nom et mesurer la cohérence.
  let mapsListing: MapsListing | null = null;
  if (ctx.mapsUrl) {
    mapsListing = await scrapeMapsListing(ctx.mapsUrl);
    geoLog("Fiche Maps — scraping", mapsListing);
  }

  // ÉTAPE 2a — Classements RÉELS d'abord (ChatGPT, Gemini, Claude), AVANT l'audit.
  // Deux requêtes : DIRECTE (niche précise = concurrents directs) toujours, et
  // INDIRECTE (catégorie générale = concurrents indirects) UNIQUEMENT pour un
  // commerce physique localisé à vraie niche. Le modèle d'audit n'estimera que
  // les moteurs restés sans classement direct réel.
  const matchName = detectedName || signals.title?.split(/[|\-–—]/)[0].trim() || signals.domain;
  const directQuery = buildEngineQuery(profile, "direct");
  const indirect = wantsIndirect(profile);
  const indirectQuery = indirect ? buildEngineQuery(profile, "indirect") : null;

  const measuredDirect: Record<AiEngine, MeasuredEngine | null> = {
    ChatGPT: null,
    Gemini: null,
    Claude: null,
  };
  const measuredRankings: Record<AiEngine, EngineRanking[]> = {
    ChatGPT: [],
    Gemini: [],
    Claude: [],
  };

  if (useApis && hasAnyEngineKey()) {
    geoLog("Étape 2a — Classements réels moteurs (avant audit)", {
      direct: directQuery,
      indirect: indirectQuery ?? "(non — commerce non physique ou sans niche distincte)",
    });
    const [directLives, indirectLives] = await Promise.all([
      gatherLiveEngines(directQuery).catch((err) => {
        console.error("Appels moteurs (direct) échoués :", err);
        return [] as LiveEngineResult[];
      }),
      indirectQuery
        ? gatherLiveEngines(indirectQuery).catch((err) => {
            console.error("Appels moteurs (indirect) échoués :", err);
            return [] as LiveEngineResult[];
          })
        : Promise.resolve([] as LiveEngineResult[]),
    ]);
    const directLbl = rankingLabel(profile, "direct");
    const indirectLbl = rankingLabel(profile, "indirect");
    for (const live of directLives) {
      if (!live.available || !live.answered) continue;
      const m = measureEngine(live, signals.domain, matchName);
      if (m.measured) {
        measuredDirect[live.engine] = m;
        const r = rankingFromLive(live, "direct", directLbl, signals.domain, matchName);
        if (r) measuredRankings[live.engine].push(r);
      }
    }
    for (const live of indirectLives) {
      if (!live.available || !live.answered) continue;
      const r = rankingFromLive(live, "indirect", indirectLbl, signals.domain, matchName);
      if (r) measuredRankings[live.engine].push(r);
    }
  }
  const realEngines = ALL_ENGINES.filter((e) => measuredDirect[e]);
  const toEstimate = ALL_ENGINES.filter((e) => !measuredDirect[e]);
  geoLog("Étape 2a — Moteurs mesurés (réels)", {
    réels: realEngines,
    àEstimerParLeModèle: toEstimate,
    classements: ALL_ENGINES.map((e) => ({ moteur: e, scopes: measuredRankings[e].map((r) => r.scope) })),
  });

  // ÉTAPE 2b — En parallèle : audit complet (n'estime QUE les moteurs restés
  // sans classement réel) + estimation des backlinks + mots-clés tendances.
  geoLog("Étape 2b — Audit + backlinks + mots-clés tendances en parallèle");
  const [core, backlinks, liveKeywords] = await Promise.all([
    (async (): Promise<EngineCore> => {
      if (!hasKey) return heuristicAnalysis(signals, ctx, profile);
      try {
        return await analyzeWithModel(signals, ctx, profile, mapsListing, measuredDirect);
      } catch (err) {
        console.error("Audit modèle échoué, fallback heuristique :", err);
        return heuristicAnalysis(signals, ctx, profile);
      }
    })(),
    hasKey
      ? estimateBacklinks(signals, profile).catch((err) => {
          console.error("Estimation backlinks échouée :", err);
          return null;
        })
      : Promise.resolve(null),
    // Mots-clés tendances : Gemini + recherche Google, payant uniquement.
    useApis
      ? fetchTrendingKeywords(profile, signals).catch((err) => {
          console.error("Mots-clés tendances échoués :", err);
          return null;
        })
      : Promise.resolve(null),
  ]);

  geoLog("Étape 2b — Audit terminé", {
    businessName: core.businessName,
    scores: Object.fromEntries(core.categories.map((c) => [c.key, c.score])),
    recommandations: core.recommendations.length,
  });

  // Combinaison finale : réel prioritaire (direct + indirect), estimation du
  // modèle d'audit pour les moteurs sans classement direct réel.
  core.engines = combineEngines(
    core.engines,
    measuredDirect,
    measuredRankings,
    core.localRankings,
    profile,
  );
  const liveQuery = realEngines.length ? directQuery : null;
  geoLog(
    "Moteurs — classements retenus",
    core.engines.map((e) => ({
      moteur: e.engine,
      mesuré: e.measured,
      visibilité: e.visibility,
      classements: e.rankings.map((r) => ({ scope: r.scope, rang: r.targetRank })),
    })),
  );

  geoLog("Backlinks — estimation", backlinks ?? "(non estimé)");

  // Mots-clés tendances de la niche (title / meta description / H1). Sans
  // réponse Gemini exploitable — et en gratuit, où l'appel n'est pas tenté — on
  // sert le repli déterministe : l'aperçu montre la livraison, floutée, sans
  // jamais déclencher d'appel facturé.
  const trendingKeywords = liveKeywords ?? fallbackTrendingKeywords(profile, signals);
  geoLog("Mots-clés tendances", {
    source: trendingKeywords.source,
    motsClés: trendingKeywords.keywords.length,
  });

  // L'aperçu gratuit ne mesure que l'architecture : sans classements moteurs, ni
  // audit éditorial, ni analyse de mots-clés, la notation reste sévère. On
  // plafonne les catégories elles-mêmes, pas seulement la note globale : tout ce
  // qui en dérive (anneaux de diagnostic, scores moteurs, note finale) reste donc
  // sous le seuil du vert, et le chiffre affiché s'accorde à sa couleur.
  if (!useApis) {
    core.categories = core.categories.map((c) => ({
      ...c,
      score: Math.min(c.score, FREE_SCORE_CAP),
    }));
    core.webPresence = {
      ...core.webPresence,
      score: Math.min(core.webPresence.score, FREE_SCORE_CAP),
    };
    core.googleSeo = {
      ...core.googleSeo,
      score: Math.min(core.googleSeo.score, FREE_SCORE_CAP),
    };
    core.engines = core.engines.map((e) => ({
      ...e,
      score: Math.min(e.score, FREE_SCORE_CAP),
    }));
  }

  const overallScore = Math.min(
    computeOverall(core.categories),
    useApis ? 100 : FREE_SCORE_CAP,
  );
  return {
    ...core,
    overallScore,
    liveQuery,
    backlinks,
    trendingKeywords,
    signals,
    createdAt: new Date().toISOString(),
  };
}
