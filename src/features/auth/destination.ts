import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { ROUTES, safeNextPath } from "@/constants/routes";
import { getAccess } from "@/features/billing/access";


/**
 * L'espace de travail de ce compte est-il en état de marche ?
 *
 * Deux signes, et l'un suffit : la fiche d'accueil est signée, ou une analyse a
 * déjà tourné (le compte né de la démonstration de la page d'accueil n'a jamais
 * vu le tunnel, sa fiche est remplie d'office). Tant que ni l'un ni l'autre, le
 * tableau de bord n'a rien à montrer — l'y envoyer, c'est ouvrir un écran vide.
 *
 * `cache` : la barre de navigation et la page se posent la même question dans le
 * même rendu, et elles ne doivent pas la payer deux fois.
 */
export const hasReadyWorkspace = cache(async function hasReadyWorkspace(
  userId: string,
): Promise<boolean> {
  const [profile, analyses] = await Promise.all([
    prisma.onboardingProfile.findUnique({
      where: { userId },
      select: { completedAt: true },
    }),
    prisma.analysis.count({ where: { userId } }),
  ]);

  return Boolean(profile?.completedAt) || analyses > 0;
});

/**
 * Ce compte a-t-il pris quelque chose ?
 *
 * Les trois jours d'essai, le Coup de Boost, un abonnement — même résilié : la
 * ligne d'abonnement suffit, la décision a été prise une fois. C'est la seule
 * chose qui ouvre le tunnel d'accueil, et donc la seule qui autorise à y
 * emmener quelqu'un de force.
 *
 * Une fiche d'accueil entamée ne compte pas, et c'était le nœud du problème : un
 * compte gratuit qui avait poussé la porte du tunnel une fois s'y voyait
 * renvoyé à chaque passage, y compris en cliquant sur « Commencer gratuitement »
 * — le bouton qui devait justement lui présenter les offres.
 */
export const hasCommittedAccess = cache(async function hasCommittedAccess(
  userId: string,
): Promise<boolean> {
  const [subscription, access] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId }, select: { id: true } }),
    getAccess(userId),
  ]);

  return subscription !== null || access.tier !== "free";
});

/**
 * Où déposer quelqu'un qui vient de s'identifier.
 *
 * Le parcours par e-mail sait dire « cet e-mail est déjà pris ». Google, lui,
 * ne peut pas : le compte existant porte la même adresse, la liaison se fait
 * (cf. `accountLinking`) et la personne se retrouve simplement connectée. Un
 * client qui paie depuis six mois cliquait donc sur « S'inscrire avec Google »
 * et atterrissait sur la grille tarifaire, comme un inconnu.
 *
 * D'où cet arbitrage, posé une fois et valable pour tout le monde : un compte
 * dont l'espace tourne rentre chez lui ; un compte qui a pris quelque chose sans
 * avoir fini de se mettre en route reprend son accueil ; tous les autres passent
 * par les tarifs — c'est là que se prend l'essai de trois jours, et c'est
 * l'étape qui manquerait au parcours si l'inscription déposait directement dans
 * le tunnel d'accueil.
 *
 * Une fiche d'accueil entamée ne suffit pas à rouvrir le tunnel : un compte
 * gratuit qui y a mis un pied puis fait demi-tour doit revoir les offres, pas
 * retomber dans le questionnaire qu'il vient de quitter.
 *
 * Le `suite` (la page visée avant l'identification) n'est honoré qu'une fois
 * l'accueil terminé : y renvoyer un compte qui n'a pas encore donné son site
 * ouvrirait des écrans vides. Et il ne l'est **pas** pour un compte neuf, même
 * s'il désigne un chemin valable : les formulaires d'identification portent tous
 * un `suite` par défaut — le tableau de bord —, et l'honorer sautait par-dessus
 * les tarifs pour déposer l'inscrit sur un tableau de bord vide, qui le
 * renvoyait aussitôt au questionnaire d'accueil. L'essai de trois jours ne lui
 * était jamais proposé.
 */
export async function resolveAuthDestination(
  userId: string,
  requested: unknown,
): Promise<string> {
  if (await hasReadyWorkspace(userId)) return safeNextPath(requested, ROUTES.dashboard);
  if (await hasCommittedAccess(userId)) return ROUTES.onboarding;

  return ROUTES.pricing;
}

/**
 * Où déposer quelqu'un qui arrive sur la page d'accueil déjà identifié.
 *
 * Ce n'est pas la même question qu'après une identification. Là, la personne
 * vient de donner ses identifiants et attend qu'on l'emmène quelque part ; ici,
 * elle a seulement cliqué sur le logo, ou fait retour depuis les tarifs. La page
 * d'accueil doit donc pouvoir répondre « nulle part » — c'est le sens du `null`.
 *
 * Deux cas seulement justifient de lui prendre la main. Son espace est en état
 * de marche — l'accueil est fait, ou une analyse a déjà tourné — et la home ne
 * lui apprendrait rien : direction le tableau de bord. Ou bien il a pris quelque
 * chose — les trois jours d'essai, le Coup de Boost, un abonnement — sans avoir
 * fini de donner son site : le tunnel d'accueil est ce qui le sépare de ce
 * qu'il a payé, on l'y ramène.
 *
 * Tout le reste — un compte gratuit ouvert il y a deux minutes, qui n'a rien
 * pris et rien lancé — reste sur la page d'accueil. C'est le trou que cette
 * fonction bouche : la flèche de retour des tarifs le renvoyait dans un tunnel
 * qu'il n'avait pas demandé, et dont aucun retour arrière ne le sortait.
 */
export async function resolveHomeDestination(userId: string): Promise<string | null> {
  if (await hasReadyWorkspace(userId)) return ROUTES.dashboard;
  if (await hasCommittedAccess(userId)) return ROUTES.onboarding;

  return null;
}
