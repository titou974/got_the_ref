import type { GeoAnalysisResult } from "./types";
import type { AnalysisDiagnostic } from "./diagnostic";

/**
 * Constat livré par défaut sur une analyse gratuite.
 *
 * L'aperçu ne mesure que l'architecture : ce constat dit honnêtement ce qui
 * tient déjà, ce qui manque, et ce que l'on n'a PAS encore mesuré — c'est cette
 * dernière partie qui porte le potentiel de classement sur les IA et Google.
 *
 * Cette couche ne produit que des faits et un `seed` ; les formulations vivent
 * dans l'i18n (`freeReport.*`), et le composant y pioche via le seed. Deux sites
 * n'obtiennent donc jamais la même tournure, mais un même rapport reste stable
 * d'un chargement à l'autre.
 */

/** Pans de l'analyse non mesurés en gratuit, qui portent le potentiel de gain. */
export type UnmeasuredAngle = "rankings" | "recommendations" | "content" | "presence" | "maps";

export type FreeReportFacts = {
  /** Graine déterministe : même analyse, même formulation. */
  seed: number;
  score: number;
  /** Clés de contrôles au vert (`analysisReport.architecture.checks.*`). */
  strengths: string[];
  /** Clés de contrôles en échec ou à corriger. */
  gaps: string[];
  /** Ce qui reste à mesurer, dans l'ordre d'impact. */
  unmeasured: UnmeasuredAngle[];
};

/** Hash 32 bits stable (FNV-1a) : même chaîne, même graine, à chaque rendu. */
function seedFrom(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Choisit un élément d'une liste à partir d'une graine et d'un numéro de champ.
 *
 * Le mélange (splitmix32) est indispensable : un simple décalage additif rendrait
 * les champs solidaires — deux listes de même longueur tomberaient toujours sur
 * le même écart, et le titre déterminerait la conclusion. Ici chaque champ tire
 * dans son propre flux, donc les combinaisons se multiplient au lieu de s'aligner.
 */
export function pickVariant<T>(items: readonly T[], seed: number, offset: number): T {
  if (items.length === 0) throw new Error("pickVariant : liste vide.");
  let z = (seed + offset * 0x9e3779b9) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  return items[z % items.length];
}

export function buildFreeReport(
  result: GeoAnalysisResult,
  diagnostic: AnalysisDiagnostic,
): FreeReportFacts {
  const checks = diagnostic.architecture.checks;

  const strengths = checks.filter((c) => c.status === "ok").map((c) => c.key);
  // « warn » compte comme un manque : c'est un point à corriger, pas un acquis.
  const gaps = checks.filter((c) => c.status === "ko" || c.status === "warn").map((c) => c.key);

  // Ordre d'impact : le classement moteurs d'abord, c'est la mesure qui manque
  // le plus cruellement quand on veut savoir où l'on se situe réellement.
  const unmeasured: UnmeasuredAngle[] = ["rankings", "recommendations", "content", "presence"];
  if (result.profile.isPhysical) unmeasured.push("maps");

  return {
    seed: seedFrom(`${result.domain}|${result.createdAt}`),
    score: result.overallScore,
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 4),
    unmeasured,
  };
}
