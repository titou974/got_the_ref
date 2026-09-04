import "server-only";

import { prisma } from "@/lib/prisma";
import { hasCommittedAccess } from "@/features/auth/destination";

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
 * La porte s'ouvre donc sur une décision prise — les trois jours d'essai, le
 * Coup de Boost, l'abonnement, ou un accès de démonstration. Une ligne
 * d'abonnement compte, même résiliée, parce que le tunnel a commencé et qu'on ne
 * le referme pas au milieu.
 *
 * Elle s'ouvre aussi sur une analyse déjà passée, et pour une raison mécanique :
 * la home renvoie au tableau de bord dès qu'une analyse existe
 * (`resolveHomeDestination`), et le tableau de bord renvoie ici tant que la
 * fiche n'est pas terminée. Refuser ce compte-là le ferait rebondir vers les
 * tarifs à chaque fois. Ce n'est pas une porte d'entrée : il faut une analyse
 * pour la franchir, et l'analyse ne se lance que depuis le formulaire.
 *
 * Il n'y a pas de seconde porte. La démonstration gratuite ne s'ouvre plus
 * d'ici : elle part du formulaire d'analyse de la page d'accueil, qui ouvre le
 * compte, remplit la fiche et la marque terminée d'un coup (cf.
 * `features/analysis/demo.ts`). Aucun bouton — barre de navigation, appel
 * flottant, sortie des tarifs — ne doit y déposer quelqu'un à sa place.
 */
export async function canEnterOnboarding(userId: string): Promise<boolean> {
  const [committed, analyses] = await Promise.all([
    // La même question que celle posée par la barre et la page d'accueil, et
    // donc la même réponse : deux définitions de « ce compte a pris quelque
    // chose » finiraient par diverger, et l'une des deux ouvrirait le tunnel à
    // qui l'autre le ferme.
    hasCommittedAccess(userId),
    prisma.analysis.count({ where: { userId } }),
  ]);

  return committed || analyses > 0;
}
