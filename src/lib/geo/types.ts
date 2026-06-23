// Modèle de scoring GEO (issu du skill /geo)
// Pondérations officielles :
//   AI Citability & Visibility   25%
//   Brand Authority Signals      20%
//   Content Quality & E-E-A-T    20%
//   Technical Foundations        15%
//   Structured Data              10%
//   Platform Optimization        10%

export type CategoryKey =
  | "citability"
  | "brandAuthority"
  | "contentEEAT"
  | "technical"
  | "structuredData"
  | "platform";

export const CATEGORY_META: Record<
  CategoryKey,
  { label: string; weight: number; short: string }
> = {
  citability: { label: "Citabilité & Visibilité IA", weight: 0.25, short: "Citabilité IA" },
  brandAuthority: { label: "Autorité de marque", weight: 0.2, short: "Autorité" },
  contentEEAT: { label: "Qualité du contenu & E-E-A-T", weight: 0.2, short: "Contenu E-E-A-T" },
  technical: { label: "Fondations techniques", weight: 0.15, short: "Technique" },
  structuredData: { label: "Données structurées", weight: 0.1, short: "Schema" },
  platform: { label: "Optimisation par plateforme", weight: 0.1, short: "Plateformes" },
};

export type CategoryScore = {
  key: CategoryKey;
  score: number; // 0-100
  summary: string;
  findings: string[];
};

export type Recommendation = {
  title: string;
  description: string;
  priority: "critique" | "haute" | "moyenne" | "basse";
  category: CategoryKey;
  impact: number; // 1-10
};

export type CrawlerAccess = {
  name: string;
  operator: string;
  allowed: boolean;
};

/** Synthèse du crawl multi-pages (gratuit, sans IA) — nourrit l'architecture. */
export type CrawlSummary = {
  pagesCrawled: number; // nombre de pages explorées (page d'accueil incluse)
  sampledUrls: string[]; // URLs réellement analysées
  schemaTypes: string[]; // types JSON-LD agrégés sur toutes les pages
  hasFaqSchema: boolean; // un FAQPage détecté quelque part
  totalWordCount: number; // volume de contenu cumulé
  internalLinks: number; // liens internes détectés sur l'accueil
};

/** Signaux techniques collectés de manière déterministe (sans IA). */
export type SiteSignals = {
  url: string;
  domain: string;
  fetchedOk: boolean;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  headingCount: number;
  wordCount: number;
  hasHttps: boolean;
  hasViewport: boolean;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  hasLlmsTxt: boolean; // llms.txt correctement servi (statut 200)
  llmsTxtMisconfigured: boolean; // contenu llms présent mais statut ≠ 200 (ex. 404) → ignoré par les IA
  jsonLdTypes: string[];
  jsonLdCount: number;
  hasOpenGraph: boolean;
  imagesWithoutAlt: number;
  crawlers: CrawlerAccess[];
  textSample: string; // extrait de contenu pour l'IA
  crawl: CrawlSummary; // synthèse du crawl multi-pages
};

/** Données réelles extraites de la fiche Google Maps (best-effort scraping). */
export type MapsListing = {
  listingName: string | null;
  rating: number | null; // note moyenne (0-5)
  reviewCount: number | null; // nombre d'avis
  scraped: boolean; // true si au moins une donnée a été récupérée
};

/** Backlinks / sources référentes estimées via recherche web (Claude). */
export type ReferringSource = { domain: string; note: string };
export type Backlinks = {
  estimatedCount: number | null; // estimation (null si inconnu)
  notableSources: ReferringSource[];
  summary: string;
  measured: boolean; // true si issu d'une recherche web réelle
};

export type AiEngine = "ChatGPT" | "Gemini";

/** Score GEO et positionnement estimé pour un moteur IA donné. */
export type EngineScore = {
  engine: AiEngine;
  score: number; // 0-100 : préparation GEO pour ce moteur
  estimatedPosition: number | null; // position estimée dans les citations (1 = top), null = non cité
  visibility: "forte" | "moyenne" | "faible" | "absente";
  summary: string;
  competitorsAhead?: string[]; // concurrents que ce moteur cite avant le site
  measured?: boolean; // true = position issue d'un appel réel à l'API du moteur
};

/**
 * Profil détecté du commerce : pivot de toute l'analyse localisée.
 * `mode` est fourni par l'utilisateur (onglet physique/en ligne) ;
 * la niche, la catégorie et la localisation sont déduites par Claude.
 */
export type BusinessProfile = {
  mode: BusinessMode; // déclaré par l'utilisateur
  isPhysical: boolean; // dérivé : true si commerce physique
  niche: string; // niche précise (ex. « Restaurant de fruits de mer »)
  generalCategory: string; // catégorie large (ex. « Restaurant »)
  location: string | null; // ville / zone si commerce physique, sinon null
};

export type BusinessMode = "physical" | "online";

/** Un commerce dans un classement local (estimé par l'IA). */
export type Competitor = {
  rank: number; // 1 = meilleure position
  name: string;
  isTarget: boolean; // true = le commerce analysé
  note: string | null; // qualif / signal (ex. « Guide Michelin », « 4,8★ · 1 200 avis »)
};

/**
 * Classement local du commerce face à ses concurrents (top 10).
 * Double lecture : `niche` (même créneau + même ville) et `general`
 * (même ville, toutes activités proches). `null` si non pertinent.
 */
export type LocalRanking = {
  type: "niche" | "general";
  label: string; // ex. « Restaurants de fruits de mer à La Rochelle »
  targetRank: number | null; // rang du commerce analysé (null = hors top 10)
  competitors: Competitor[]; // top 10 estimé
};

/**
 * Présence web & notoriété : signaux d'autorité hors-site qui pèsent sur
 * la citation IA — qualifications (guides, labels) et apparitions presse.
 */
export type WebPresence = {
  score: number; // 0-100 : notoriété éditoriale estimée
  summary: string;
  qualifications: { label: string; source: string; detail: string }[]; // Guide Michelin, Gault&Millau, label, certification…
  articles: { title: string; source: string }[]; // mentions presse / articles
  findings: string[];
};

/** Analyse SEO Google classique (positionnement organique). */
export type GoogleSeo = {
  score: number; // 0-100
  positioning: string; // ex. "Page 1 (top 5)", "Page 2-3", "Non positionné"
  summary: string;
  findings: string[];
  topKeywords: string[]; // mots-clés sur lesquels le site pourrait/devrait ressortir
};

/**
 * Cohérence entre la fiche Google Maps et le site (volet local).
 * Optionnel : alimenté par le moteur localisé (Phase 5) lorsqu'une fiche
 * Maps est fournie. `null` tant que non analysé.
 */
export type MapsCoherence = {
  score: number; // 0-100 : cohérence globale fiche ↔ site
  summary: string;
  listingName: string | null; // nom de l'établissement sur la fiche
  reviewCount: number | null; // nombre d'avis
  rating: number | null; // note moyenne (0-5)
  matches: { label: string; consistent: boolean; detail: string }[]; // NAP, horaires, catégorie…
  findings: string[];
};

/** Réponse complète de l'analyse (sérialisée en base). */
export type GeoAnalysisResult = {
  url: string;
  domain: string;
  businessName: string;
  businessType: string;
  profile: BusinessProfile; // niche + localisation + mode (pivot de l'analyse)
  overallScore: number; // note IA générale (moyenne pondérée des catégories GEO)
  verdict: string;
  categories: CategoryScore[];
  engines: EngineScore[]; // score GEO par moteur IA
  localRankings: LocalRanking[]; // classements concurrents (niche + général) — vide si non physique
  webPresence: WebPresence; // qualifications & apparitions presse
  googleSeo: GoogleSeo; // volet SEO Google (conservé en données, masqué de l'UI)
  recommendations: Recommendation[];
  aiSimulation: AiSimulation;
  aiVisibility: AiVisibility; // comparatif des vues IA estimées par moteur
  signals: SiteSignals;
  createdAt: string;
  mapsUrl?: string | null; // fiche Google Maps fournie par l'utilisateur (facultatif)
  mapsCoherence?: MapsCoherence | null; // analyse de cohérence locale (Phase 5)
  liveQuery?: string | null; // requête réellement testée sur les moteurs (Phase 6)
  backlinks?: Backlinks | null; // sources référentes estimées (Phase 6b, recherche web)
};

/** Simulation de recherche IA affichée sur le dashboard. */
export type AiSimulation = {
  query: string;
  engine: "ChatGPT" | "Gemini";
  appearsInResults: boolean;
  position: number | null;
  competitorsAhead: string[];
  explanation: string;
};

/** Une requête témoin et si le site y est cité par le moteur. */
export type SampleQuery = {
  query: string;
  cited: boolean;
  position: number | null;
};

/** Visibilité de citation + vues IA estimées (modélisées) pour un moteur. */
export type AiVisibilityEngine = {
  engine: AiEngine;
  citationRate: number; // 0-100 : citabilité estimée (présence dans les réponses)
  shareOfVoice: number; // 0-100 : part de voix relative
  estimatedMonthlyVisits: number; // visites IA estimées / mois (modèle)
  sampleQueries: SampleQuery[];
};

/** Comparatif global des vues IA estimées par moteur. */
export type AiVisibility = {
  totalEstimatedMonthlyVisits: number;
  topEngine: AiEngine | null;
  engines: AiVisibilityEngine[]; // triées par visites estimées (desc)
  methodologyNote: string;
};
