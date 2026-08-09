import type { PlanKey } from "@/constants/plans";

/** Ce dont on a besoin pour décider de l'accès au rapport complet. */
export type AnalysisAccessRecord = {
  unlocked: boolean;
  userId: string | null;
};

export type AnalysisViewer = {
  id: string;
  plan: string;
} | null;

/**
 * Le rapport complet est visible si :
 * — l'analyse a été ouverte lors d'une souscription (rattachement définitif à
 *   l'analyse elle-même, pour qu'un visiteur anonyme puisse s'abonner puis créer
 *   son compte après) ;
 * — ou le visiteur a un abonnement actif : l'abonnement donne accès à tout Visia.
 *
 * Sinon : aperçu gratuit, les sections mesurées restent floutées.
 */
export function isReportUnlocked(
  analysis: AnalysisAccessRecord,
  viewer: AnalysisViewer,
): boolean {
  if (analysis.unlocked) return true;
  if (!viewer) return false;

  const plan = viewer.plan as PlanKey;
  return plan === "pro" || plan === "agency";
}
