import "server-only";

import { prisma } from "@/lib/prisma";
import { getAccess } from "@/features/billing/access";

/**
 * La démonstration gratuite est-elle encore devant ce compte ?
 *
 * Une seule question : ce compte a-t-il déjà fait tourner une analyse ? Tant
 * que non, il n'a rien vu du produit, et la porte reste ouverte — c'est celle
 * que la page tarifs lui tend en bas des offres, « continuer sans abonnement ».
 * Dès qu'une analyse existe, la démonstration a eu lieu : la porte se ferme, et
 * ce sont les tarifs pleins (même règle que `getTrialState`).
 *
 * Elle sert deux fois, et c'est le but : le lien s'affiche exactement quand le
 * tunnel s'ouvre. Un appel visible sur une porte fermée serait pire qu'un appel
 * absent.
 */
export async function isFreeDemoOpen(userId: string): Promise<boolean> {
  const analyses = await prisma.analysis.count({ where: { userId } });
  return analyses === 0;
}

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
 * La porte s'ouvre donc sur deux conditions, dont une seule suffit. Que quelque
 * chose ait été pris — les trois jours d'essai, le Coup de Boost, l'abonnement,
 * ou un accès de démonstration ; une ligne d'abonnement compte, même résiliée,
 * parce que le tunnel a commencé et qu'on ne le referme pas au milieu. Ou bien
 * que la démonstration gratuite soit encore devant lui : c'est la porte que la
 * page tarifs lui tend en bas des offres, et elle doit s'ouvrir sur clic.
 *
 * Le compte ouvert par l'analyse de la page d'accueil, lui, ne passe jamais par
 * ici : sa fiche est déjà remplie et marquée terminée au moment où le compte
 * naît (cf. `features/analysis/demo.ts`).
 */
export async function canEnterOnboarding(userId: string): Promise<boolean> {
  const [access, subscription, demoOpen] = await Promise.all([
    getAccess(userId),
    prisma.subscription.findUnique({ where: { userId }, select: { id: true } }),
    isFreeDemoOpen(userId),
  ]);

  return access.tier !== "free" || subscription !== null || demoOpen;
}
