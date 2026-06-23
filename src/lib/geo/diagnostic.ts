import type { GeoAnalysisResult } from "./types";

/**
 * Couche de dérivation : transforme les signaux bruts d'une analyse en
 * deux diagnostics lisibles — Architecture (structure technique citable par
 * les IA) et Contenu (matière éditoriale et signaux locaux).
 *
 * Les libellés des contrôles sont résolus côté UI via i18n
 * (`analysisReport.architecture.checks.<key>` / `…content.checks.<key>`) ;
 * cette couche ne renvoie que l'état et les valeurs dynamiques.
 */

export type DiagnosticStatus = "ok" | "warn" | "ko" | "unknown";

export type DiagnosticCheck = {
  key: string;
  status: DiagnosticStatus;
  /** Valeur dynamique injectée dans le libellé i18n (compteur, liste…). */
  value?: string;
};

export type DiagnosticSection = {
  score: number; // 0-100
  checks: DiagnosticCheck[];
};

export type AnalysisDiagnostic = {
  architecture: DiagnosticSection;
  content: DiagnosticSection;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Score moyen d'un sous-ensemble de catégories GEO (0 si absent). */
function categoryScore(result: GeoAnalysisResult, keys: string[]): number {
  const found = result.categories.filter((c) => keys.includes(c.key));
  if (!found.length) return 0;
  return clamp(found.reduce((sum, c) => sum + c.score, 0) / found.length);
}

/** Détecte une FAQ structurée ou éditoriale dans les signaux. */
function detectFaq(result: GeoAnalysisResult): DiagnosticStatus {
  const types = result.signals.jsonLdTypes.map((t) => t.toLowerCase());
  if (types.some((t) => t.includes("faq"))) return "ok";
  const sample = (result.signals.textSample ?? "").toLowerCase();
  if (sample.includes("foire aux questions") || /\bfaq\b/.test(sample)) return "warn";
  return "ko";
}

/** Statut dérivé d'un score 0-100. */
function fromScore(score: number): DiagnosticStatus {
  if (score >= 70) return "ok";
  if (score >= 45) return "warn";
  return "ko";
}

export function buildDiagnostic(result: GeoAnalysisResult): AnalysisDiagnostic {
  const s = result.signals;

  // ---- Architecture (structure technique citable) ----
  const h1Count = s.h1.filter((h) => h.trim().length > 0).length;
  const blockedAiCrawlers = s.crawlers.filter((c) => !c.allowed).length;
  const hasIntro = (s.textSample ?? "").trim().length >= 120;

  const architectureChecks: DiagnosticCheck[] = [
    { key: "llmsTxt", status: s.hasLlmsTxt ? "ok" : "ko" },
    {
      key: "schema",
      status: s.jsonLdCount > 0 ? "ok" : "ko",
      value: s.jsonLdTypes.length ? s.jsonLdTypes.join(", ") : String(s.jsonLdCount),
    },
    {
      key: "h1",
      status: h1Count === 1 ? "ok" : h1Count === 0 ? "ko" : "warn",
      value: String(h1Count),
    },
    { key: "title", status: s.title ? "ok" : "ko" },
    { key: "metaDescription", status: s.metaDescription ? "ok" : "ko" },
    { key: "firstParagraph", status: hasIntro ? "ok" : "warn" },
    {
      key: "aiCrawlers",
      status: blockedAiCrawlers === 0 ? "ok" : blockedAiCrawlers < s.crawlers.length ? "warn" : "ko",
      value: String(blockedAiCrawlers),
    },
    { key: "https", status: s.hasHttps ? "ok" : "ko" },
  ];

  // ---- Contenu (matière éditoriale + signaux locaux) ----
  const eeat = categoryScore(result, ["contentEEAT"]);
  const citability = categoryScore(result, ["citability"]);
  const coherence = result.mapsCoherence;

  const contentChecks: DiagnosticCheck[] = [
    { key: "faq", status: detectFaq(result) },
    { key: "editorialQuality", status: fromScore(eeat), value: String(eeat) },
    { key: "citability", status: fromScore(citability), value: String(citability) },
    {
      key: "wordCount",
      status: s.wordCount >= 600 ? "ok" : s.wordCount >= 250 ? "warn" : "ko",
      value: String(s.wordCount),
    },
    {
      key: "mapsReviews",
      status: coherence?.reviewCount != null ? "ok" : "unknown",
      value: coherence?.reviewCount != null ? String(coherence.reviewCount) : undefined,
    },
    {
      key: "mapsCoherence",
      status: coherence ? fromScore(coherence.score) : "unknown",
      value: coherence ? String(coherence.score) : undefined,
    },
  ];

  return {
    architecture: {
      score: categoryScore(result, ["technical", "structuredData"]),
      checks: architectureChecks,
    },
    content: {
      score: categoryScore(result, ["contentEEAT", "citability"]),
      checks: contentChecks,
    },
  };
}
