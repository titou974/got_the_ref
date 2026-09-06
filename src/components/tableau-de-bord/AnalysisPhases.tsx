/**
 * Les six temps de la mise en route, et le nom qu'on leur donne.
 *
 * Ce module ne dessine plus rien. L'écran d'attente avait une image par étape —
 * un document, un satellite, une loupe, une fusée —, chargées en Lottie et
 * fondues l'une dans l'autre. Elles illustraient l'attente sans rien en dire, et
 * changeaient de sujet toutes les vingt secondes ; le clavier, lui, montre la
 * question du client posée aux quatre moteurs, et il occupe désormais l'écran du
 * début à la fin (cf. `AiKeysAnimation`). Ne restent ici que les libellés et
 * l'horloge qui les fait défiler.
 *
 * L'ordre n'est pas décoratif : c'est celui de `prepareDashboardAction`, puis
 * de `seedEditorialMonthAction`. Le libellé dit donc ce que le serveur fait
 * vraiment à cet instant, pendant que le clavier dit pourquoi.
 */

/** Les clés i18n des libellés, dans `dashboard.preparing`. */
export const PHASE_LABEL_KEYS = [
  "phaseSite",
  "phaseCrawlers",
  "phaseCitability",
  "phaseEngines",
  "phaseRankings",
  "phaseArticles",
] as const;

/** La dernière étape, celle de la planification des articles (seconde passe). */
export const ARTICLES_PHASE = 5;

/**
 * Le poids de chaque étape de l'audit, en parts de la montée vers 70 %.
 *
 * L'interrogation des moteurs en prend deux sur six : c'est la plus longue des
 * cinq, et de loin. Les autres se partagent le reste à parts égales — aucune ne
 * mérite qu'on s'y attarde, puisque la scène ne change plus avec le libellé.
 */
export const AUDIT_WEIGHTS = [1, 1, 1, 2, 1] as const;

const TOTAL_WEIGHT = AUDIT_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

/**
 * L'étape de l'audit correspondant à une avance donnée.
 *
 * L'étape se déduit de la barre : il n'y a qu'une horloge sur cet écran, et le
 * libellé ne peut donc pas raconter autre chose que le pourcentage.
 */
export function auditPhaseFor(progress: number, ceiling: number): number {
  const share = Math.min(1, Math.max(0, progress / ceiling));
  let consumed = 0;
  for (let index = 0; index < AUDIT_WEIGHTS.length; index++) {
    consumed += AUDIT_WEIGHTS[index] / TOTAL_WEIGHT;
    if (share < consumed) return index;
  }
  return AUDIT_WEIGHTS.length - 1;
}
