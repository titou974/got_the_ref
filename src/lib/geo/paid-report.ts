import type { AiEngine, GeoAnalysisResult } from "./types";
import type { AnalysisDiagnostic } from "./diagnostic";
import { buildFreeReport } from "./free-report";

/**
 * Constat du rapport complet, pendant payant de `buildFreeReport`.
 *
 * L'aperçu gratuit argumente sur ce qu'il n'a PAS mesuré ; ici tout l'a été. Le
 * constat change donc de nature : il rend compte des relevés — position par
 * moteur, notes éditoriale et de notoriété, mots-clés tendances, plan d'action
 * — au lieu d'annoncer ce qui reste fermé.
 *
 * Les faits sont les mêmes pour les deux surfaces qui affichent ce constat ;
 * c'est la carte qui choisit lesquels elle montre (voir `PaidReportCard`).
 *
 * Comme pour l'aperçu, cette couche ne produit que des faits et une graine ; les
 * formulations vivent dans l'i18n (`paidReport.*`).
 */

export type MeasuredEngineFact = {
  engine: AiEngine;
  /** Rang du commerce sur la requête directe (null = hors classement). */
  rank: number | null;
  /** true = classement réellement obtenu du moteur, false = estimation. */
  measured: boolean;
};

export type PaidReportFacts = {
  /** Graine déterministe : même rapport, même formulation. */
  seed: number;
  score: number;
  /** Clés de contrôles au vert (`analysisReport.architecture.checks.*`). */
  strengths: string[];
  /** Clés de contrôles en échec ou à corriger. */
  gaps: string[];
  engines: MeasuredEngineFact[];
  /** Nombre de moteurs dont le classement a été réellement relevé. */
  measuredEngineCount: number;
  contentScore: number;
  /** Note de notoriété hors-site (présence web). */
  presenceScore: number;
  /** Nombre de mots-clés tendances relevés sur la niche. */
  keywordCount: number;
  recommendationCount: number;
  /** Titre du correctif le plus prioritaire, s'il y en a un. */
  topRecommendation: string | null;
  /** Cohérence de la fiche Google Maps, `null` si aucune fiche analysée. */
  mapsScore: number | null;
};

/** Ordre de priorité des recommandations, du plus urgent au moins urgent. */
const PRIORITY_ORDER = ["critique", "haute", "moyenne", "basse"] as const;

export function buildPaidReport(
  result: GeoAnalysisResult,
  diagnostic: AnalysisDiagnostic,
): PaidReportFacts {
  // Forces, manques, graine et note se lisent de la même façon qu'en aperçu :
  // ce sont les mêmes contrôles d'architecture, sans plafond cette fois.
  const base = buildFreeReport(result, diagnostic);

  const engines: MeasuredEngineFact[] = result.engines.map((e) => {
    const direct = e.rankings.find((r) => r.scope === "direct") ?? e.rankings[0];
    return {
      engine: e.engine,
      rank: direct?.targetRank ?? null,
      measured: e.measured,
    };
  });

  const sorted = [...result.recommendations].sort(
    (a, b) =>
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
      b.impact - a.impact,
  );

  return {
    seed: base.seed,
    score: result.overallScore,
    strengths: base.strengths,
    gaps: base.gaps,
    engines,
    measuredEngineCount: engines.filter((e) => e.measured).length,
    contentScore: diagnostic.content.score,
    presenceScore: result.webPresence.score,
    keywordCount: result.trendingKeywords?.keywords.length ?? 0,
    recommendationCount: result.recommendations.length,
    topRecommendation: sorted[0]?.title ?? null,
    mapsScore: result.mapsCoherence?.score ?? null,
  };
}
