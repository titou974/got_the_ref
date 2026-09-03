import "server-only";

import { prisma } from "@/lib/prisma";
import { getAccess } from "@/features/billing/access";

/**
 * Qui a le droit d'entrer dans le tunnel d'accueil.
 *
 * Le tunnel n'est pas une page publique : c'est la mise en route d'un espace de
 * travail, et il n'a de sens qu'une fois la décision prise. Un compte tout juste
 * ouvert qui y tombait — par la flèche de retour des tarifs, par un lien gardé,
 * par l'historique du navigateur — se voyait demander la forme de son commerce
 * et l'adresse de son site avant même d'avoir vu ce qu'il achetait. Il repartait
 * de là sur un tableau de bord qu'il n'avait pas choisi.
 *
 * La porte s'ouvre donc sur une seule condition : que quelque chose ait été pris
 * — les trois jours d'essai, le Coup de Boost, l'abonnement, ou un accès de
 * démonstration. Une ligne d'abonnement suffit, même résiliée : le tunnel a
 * commencé, on ne le referme pas au milieu.
 *
 * Le compte ouvert par l'analyse de la page d'accueil, lui, ne passe jamais par
 * ici : sa fiche est déjà remplie et marquée terminée au moment où le compte
 * naît (cf. `features/analysis/demo.ts`).
 */
export async function canEnterOnboarding(userId: string): Promise<boolean> {
  const [access, subscription] = await Promise.all([
    getAccess(userId),
    prisma.subscription.findUnique({ where: { userId }, select: { id: true } }),
  ]);

  return access.tier !== "free" || subscription !== null;
}
