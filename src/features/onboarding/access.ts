import "server-only";

import { prisma } from "@/lib/prisma";
import { getAccess } from "@/features/billing/access";

/**
 * Qui a le droit d'entrer dans le tunnel d'accueil.
 *
 * Le tunnel n'est pas une page publique : c'est la mise en route d'un espace de
 * travail, et il n'a de sens qu'une fois la décision prise. Un compte tout juste
 * ouvert qui y tombait — par la flèche de retour des tarifs, par le lien
 * « tableau de bord » de la barre, par un lien gardé, par l'historique du
 * navigateur — se voyait demander la forme de son commerce et l'adresse de son
 * site avant même d'avoir vu ce qu'il achetait. Il repartait de là sur un
 * tableau de bord qu'il n'avait pas choisi.
 *
 * La porte s'ouvre donc sur une seule condition : que quelque chose ait été
 * pris — les trois jours d'essai, le Coup de Boost, l'abonnement, ou un accès de
 * démonstration. Une ligne d'abonnement compte, même résiliée, parce que le
 * tunnel a commencé et qu'on ne le referme pas au milieu.
 *
 * Il n'y a pas de seconde porte. La démonstration gratuite ne s'ouvre plus
 * d'ici : elle part du formulaire d'analyse de la page d'accueil, qui ouvre le
 * compte, remplit la fiche et la marque terminée d'un coup (cf.
 * `features/analysis/demo.ts`). Ce compte-là ne passe donc jamais par ce
 * tunnel, et aucun bouton — barre de navigation, appel flottant, sortie des
 * tarifs — ne doit y déposer quelqu'un à la place du formulaire.
 */
export async function canEnterOnboarding(userId: string): Promise<boolean> {
  const [access, subscription] = await Promise.all([
    getAccess(userId),
    prisma.subscription.findUnique({ where: { userId }, select: { id: true } }),
  ]);

  return access.tier !== "free" || subscription !== null;
}
