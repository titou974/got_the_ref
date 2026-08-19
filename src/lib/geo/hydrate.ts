import type {
  GeoAnalysisResult,
  BusinessProfile,
  WebPresence,
  OnPageContent,
  OnPageCheck,
  EngineScore,
  EngineRanking,
  Competitor,
  TrendingKeywordsInsight,
} from "./types";

/** Élément on-page de repli : texte réel si connu, sinon état « non audité ». */
function legacyCheck(text: string | null): OnPageCheck {
  return {
    text: text || null,
    status: text ? "warn" : "ko",
    signals: [],
    note: "Audit on-page indisponible pour cette analyse.",
  };
}

/** Ancien format de moteur (avant les classements direct/indirect). */
type LegacyEngine = {
  engine: EngineScore["engine"];
  score?: number;
  visibility?: EngineScore["visibility"];
  summary?: string;
  measured?: boolean;
  estimatedPosition?: number | null;
  competitorsAhead?: string[];
  rankings?: EngineRanking[];
};

/** Convertit un moteur (ancien ou nouveau format) vers le format à classements. */
function normalizeEngine(e: LegacyEngine, label: string): EngineScore {
  if (Array.isArray(e.rankings)) {
    return {
      engine: e.engine,
      score: e.score ?? 0,
      visibility: e.visibility ?? "absente",
      summary: e.summary ?? "",
      measured: !!e.measured,
      rankings: e.rankings,
    };
  }
  // Ancien format : reconstruit un classement « direct » depuis les champs legacy.
  const competitors: Competitor[] = (e.competitorsAhead ?? [])
    .slice(0, 3)
    .map((name, i) => ({ rank: i + 1, name, isTarget: false, note: null }));
  if (e.estimatedPosition != null) {
    competitors.push({ rank: Math.max(1, e.estimatedPosition), name: "Vous", isTarget: true, note: null });
    competitors.sort((a, b) => a.rank - b.rank);
  }
  return {
    engine: e.engine,
    score: e.score ?? 0,
    visibility: e.visibility ?? "absente",
    summary: e.summary ?? "",
    measured: !!e.measured,
    rankings: [
      {
        scope: "direct",
        label,
        measured: !!e.measured,
        targetRank: e.estimatedPosition ?? null,
        competitors,
      },
    ],
  };
}

/**
 * Rétro-compatibilité : les analyses créées avant les Phases 5/6 ne contiennent
 * ni profil, ni présence web, ni classements moteurs au nouveau format. On comble
 * ces champs pour que le rendu ne casse jamais sur un ancien enregistrement.
 */
export function hydrateAnalysisResult(
  raw: GeoAnalysisResult &
    Partial<{
      profile: BusinessProfile;
      localRankings: GeoAnalysisResult["localRankings"];
      webPresence: WebPresence;
      onPageContent: OnPageContent;
    }>,
): GeoAnalysisResult {
  const hasMaps = !!raw.mapsUrl;

  const profile: BusinessProfile = raw.profile ?? {
    mode: hasMaps ? "physical" : "online",
    isPhysical: hasMaps,
    niche: raw.businessType || raw.businessName || "Activité non déterminée",
    generalCategory: raw.businessType || "Commerce",
    location: null,
  };

  const webPresence: WebPresence = raw.webPresence ?? {
    score: 0,
    summary: "Notoriété éditoriale non analysée pour cette analyse.",
    qualifications: [],
    articles: [],
    findings: [],
  };

  const engines = Array.isArray(raw.engines)
    ? (raw.engines as LegacyEngine[]).map((e) => normalizeEngine(e, profile.niche))
    : [];

  const s = raw.signals;
  const onPageContent: OnPageContent = raw.onPageContent ?? {
    title: legacyCheck(s?.title ?? null),
    metaDescription: legacyCheck(s?.metaDescription ?? null),
    h1: legacyCheck(s?.h1?.[0] ?? null),
    firstSentence: legacyCheck(s?.firstParagraph ?? null),
    openingHours: s?.openingHoursHint ?? null,
  };

  // Les analyses antérieures à la détection de plateforme n'ont pas de `stack`.
  const signals = s ? { ...s, stack: s.stack ?? null } : s;

  return {
    ...raw,
    signals,
    profile,
    engines,
    localRankings: Array.isArray(raw.localRankings) ? raw.localRankings : [],
    webPresence,
    onPageContent,
    trendingKeywords: raw.trendingKeywords ?? legacyKeywords(profile),
  };
}

/**
 * Analyses antérieures aux mots-clés tendances : on reconstruit la même
 * structure depuis la niche, pour que la section s'affiche au lieu de
 * disparaître. `measured: false` la présente pour ce qu'elle est — une
 * déduction, pas un relevé Google.
 */
function legacyKeywords(profile: BusinessProfile): TrendingKeywordsInsight {
  const niche = profile.niche.toLowerCase();
  const category = (profile.generalCategory || profile.niche).toLowerCase();
  const inCity = profile.location ? ` ${profile.location}` : "";
  const cityLabel = profile.location ? ` à ${profile.location}` : "";

  return {
    measured: false,
    source: "heuristic",
    period: new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    keywords: [
      { keyword: `${niche}${inCity}`, intent: "recherche principale", trend: "stable", placements: ["title", "h1", "metaDescription"] },
      { keyword: `meilleur ${category}${inCity}`, intent: "comparaison", trend: "montant", placements: ["title", "metaDescription"] },
      { keyword: `${category}${inCity} avis`, intent: "réassurance", trend: "montant", placements: ["metaDescription"] },
      { keyword: `où trouver ${niche}${inCity}`, intent: "question conversationnelle", trend: "émergent", placements: ["h1"] },
    ],
    suggested: {
      title: `${profile.niche}${cityLabel} | Avis & réservation`,
      metaDescription: `${profile.niche}${cityLabel} : avis clients, horaires, adresse et réservation en ligne.`,
      h1: `${profile.niche}${cityLabel}`,
    },
    notes: ["Analyse antérieure à la recherche de mots-clés : relancez l'audit pour les requêtes réellement en hausse."],
  };
}
