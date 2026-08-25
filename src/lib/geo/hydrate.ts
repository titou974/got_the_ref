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
import { RETIRED_ENGINES } from "./types";

/** Élément on-page de repli : texte réel si connu, sinon état « non audité ». */
function legacyCheck(text: string | null): OnPageCheck {
  return {
    text: text || null,
    status: text ? "warn" : "ko",
    signals: [],
    note: "Audit on-page indisponible pour cette analyse.",
    suggestion: null,
  };
}

/** Complète un élément on-page relu en base : `suggestion` peut manquer. */
function withSuggestion(check: OnPageCheck | undefined): OnPageCheck {
  if (!check) return legacyCheck(null);
  return { ...check, suggestion: check.suggestion ?? null };
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

  // Les analyses enregistrées avant le retrait du troisième assistant portent
  // encore son moteur. On l'écarte à la relecture : il n'a plus de logo, plus
  // d'API, et son classement n'était de toute façon plus relevé.
  const engines = Array.isArray(raw.engines)
    ? (raw.engines as LegacyEngine[])
        .filter((e) => !(RETIRED_ENGINES as readonly string[]).includes(e.engine))
        .map((e) => normalizeEngine(e, profile.niche))
    : [];

  const s = raw.signals;
  const stored = raw.onPageContent;
  const onPageContent: OnPageContent = stored
    ? {
        // Les analyses antérieures aux correctifs on-page ont bien un audit,
        // mais pas de réécriture : `suggestion` y manque, et le lire sans
        // repli afficherait « undefined » dans la carte du tableau de bord.
        title: withSuggestion(stored.title),
        metaDescription: withSuggestion(stored.metaDescription),
        h1: withSuggestion(stored.h1),
        firstSentence: withSuggestion(stored.firstSentence),
        openingHours: stored.openingHours ?? s?.openingHoursHint ?? null,
      }
    : {
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
    trendingKeywords: withFirstParagraph(raw.trendingKeywords, profile),
  };
}

/**
 * Les mots-clés relus en base, complétés du premier paragraphe réécrit.
 *
 * Une analyse antérieure au correctif porte bien `suggested`, mais sans
 * `firstParagraph` : on le reconstruit depuis le repli déterministe plutôt que
 * de laisser la carte du tableau de bord se remplir de vide.
 */
function withFirstParagraph(
  stored: TrendingKeywordsInsight | null | undefined,
  profile: BusinessProfile,
): TrendingKeywordsInsight {
  const fallback = legacyKeywords(profile);
  if (!stored) return fallback;
  return {
    ...stored,
    suggested: {
      ...stored.suggested,
      firstParagraph: stored.suggested?.firstParagraph || fallback.suggested.firstParagraph,
    },
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
      firstParagraph: `${profile.niche}${cityLabel} : cette page réunit l'adresse, les horaires, ce qui est proposé et la marche à suivre pour réserver.`,
    },
    notes: ["Analyse antérieure à la recherche de mots-clés : relancez l'audit pour les requêtes réellement en hausse."],
  };
}
