import type { PlanKey } from "@/constants/plans";

/** Ce dont on a besoin pour décider de l'accès au rapport complet. */
export type AnalysisAccessRecord = {
  unlocked: boolean;
  userId: string | null;
  /** Offre du compte qui a lancé l'analyse (null si analyse anonyme). */
  ownerPlan?: string | null;
};

export type AnalysisViewer = {
  id: string;
  plan: string;
} | null;

/** Une offre payante (l'analyse d'un abonné est publique, voir plus bas). */
function isPaidPlan(plan: string | null | undefined): boolean {
  return plan === ("pro" satisfies PlanKey) || plan === ("agency" satisfies PlanKey);
}

/**
 * Le rapport complet est visible si :
 * — l'analyse a été ouverte lors d'une souscription (rattachement définitif à
 *   l'analyse elle-même, pour qu'un visiteur anonyme puisse s'abonner puis créer
 *   son compte après) ;
 * — ou l'analyse a été lancée depuis un compte abonné : elle devient alors
 *   publique, lisible par n'importe qui avec le lien et sans compte. C'est ce
 *   qui rend un rapport partageable (client, associé, prestataire) ;
 * — ou le visiteur a un abonnement actif : l'abonnement donne accès à tout got_the_ref.
 *
 * Sinon : aperçu gratuit, les sections mesurées restent floutées.
 */
export function isReportUnlocked(
  analysis: AnalysisAccessRecord,
  viewer: AnalysisViewer,
): boolean {
  if (analysis.unlocked) return true;
  if (isPaidPlan(analysis.ownerPlan)) return true;
  if (!viewer) return false;

  return isPaidPlan(viewer.plan);
}
