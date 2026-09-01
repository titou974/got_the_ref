import type { Recommendation } from "@/lib/geo/types";
import type { AnalysisDiagnostic } from "@/lib/geo/diagnostic";
import {
  FREE_RECOMMENDATION_LIMIT,
  PENDING_FIXES_RANGE,
  VEILED_RECOMMENDATION_PREVIEW,
  canSee,
  seesRecommendation,
  type AccessTier,
} from "@/constants/access";

/**
 * Le plan d'action, découpé selon ce que l'offre ouvre.
 *
 * Deux écrans montrent la même liste de correctifs : l'accueil du tableau de
 * bord, et l'aperçu public d'une analyse. Ils la découpent exactement pareil —
 * ce qui se lit, ce qui reste sous voile, et combien de corrections séparent le
 * site du haut des réponses. Écrit deux fois, ce découpage aurait divergé au
 * premier ajustement, et les deux écrans auraient annoncé deux comptes
 * différents pour le même site.
 */

/** L'ordre d'urgence des correctifs, pour ne montrer que les plus pressants. */
const PRIORITY_RANK: Record<Recommendation["priority"], number> = {
  critique: 0,
  haute: 1,
  moyenne: 2,
  basse: 3,
};

export type RecommendationPlan = {
  /** Les correctifs lisibles tout de suite, bornés sur une offre gratuite. */
  open: Recommendation[];
  /** L'aperçu voilé : deux cartes, les plus urgentes de ce qui reste. */
  veiled: Recommendation[];
  /** Tout ce que l'offre n'ouvre pas, voile compris. */
  locked: Recommendation[];
  /** Combien de corrections séparent ce site du haut des réponses IA. */
  pendingFixes: number;
};

/**
 * Combien de corrections séparent ce site du haut des réponses IA.
 *
 * Le compte est réel : chaque contrôle raté du diagnostic — structure et
 * contenu — est une correction à faire, et chaque correctif encore fermé en est
 * une autre. C'est le seul chiffre du voile qui reste en clair, et il ne doit
 * donc rien à une estimation.
 *
 * Il est ensuite ramené dans la fourchette annoncée sur la barre d'appel : un
 * site déjà propre n'a pas de quoi remplir une passe, et un site en ruine en
 * afficherait quarante, ce qui décourage au lieu de vendre.
 */
export function countPendingFixes(
  diagnostic: AnalysisDiagnostic,
  lockedCount: number,
): number {
  const failed = [...diagnostic.architecture.checks, ...diagnostic.content.checks].filter(
    (check) => check.status === "ko" || check.status === "warn",
  ).length;

  const [min, max] = PENDING_FIXES_RANGE;
  return Math.min(max, Math.max(min, failed + lockedCount));
}

/**
 * Découpe le plan d'action pour une offre donnée.
 *
 * Le plan se coupe en deux sur un compte gratuit : les correctifs de contenu se
 * lisent — l'onglet qui les exécute est ouvert —, les autres gardent leur forme
 * sous voile. Les premiers sont bornés : quelques cartes démontrent, la liste
 * entière remplacerait l'offre.
 *
 * Sous voile, deux cartes suffisent. Une liste de quinze correctifs floutés
 * faisait défiler un écran entier de gris avant d'arriver à l'appel : le client
 * n'y lisait rien de plus qu'en deux cartes, et l'offre arrivait trop tard.
 */
export function buildRecommendationPlan(
  recommendations: Recommendation[],
  diagnostic: AnalysisDiagnostic,
  tier: AccessTier,
): RecommendationPlan {
  const open = recommendations
    .filter((r) => seesRecommendation(tier, r.category))
    .slice(0, canSee(tier, "recommendations") ? undefined : FREE_RECOMMENDATION_LIMIT);

  const locked = recommendations.filter((r) => !open.includes(r));

  const veiled = [...locked]
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, VEILED_RECOMMENDATION_PREVIEW);

  return {
    open,
    veiled,
    locked,
    pendingFixes: countPendingFixes(diagnostic, locked.length),
  };
}
