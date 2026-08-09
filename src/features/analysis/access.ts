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
 * — l'analyse a été payée (déblocage définitif, attaché à l'analyse elle-même,
 *   pour qu'un visiteur anonyme puisse payer puis créer son compte après) ;
 * — ou le visiteur est un compte agence (accompagnement, tout est ouvert) ;
 * — ou le visiteur possède l'analyse et dispose d'une offre payante.
 *
 * Sinon : aperçu gratuit, les sections premium passent derrière l'overlay.
 */
export function isReportUnlocked(
  analysis: AnalysisAccessRecord,
  viewer: AnalysisViewer,
): boolean {
  if (analysis.unlocked) return true;
  if (!viewer) return false;

  const plan = viewer.plan as PlanKey;
  if (plan === "agency") return true;
  return plan === "pro" && analysis.userId === viewer.id;
}
