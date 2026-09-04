import "server-only";

import { prisma } from "@/lib/prisma";
import { ROUTES, safeNextPath } from "@/constants/routes";
import { getAccess } from "@/features/billing/access";

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
 * dont l'accueil est fait rentre chez lui, un compte entamé reprend son accueil,
 * et un compte qui vient de naître passe par les tarifs — c'est là que se prend
 * l'essai de trois jours, et c'est l'étape qui manquerait au parcours si
 * l'inscription déposait directement dans le tunnel d'accueil.
 *
 * Un compte qui a déjà ouvert un essai ou un abonnement ne repasse pas par les
 * tarifs : sa décision est prise, il continue son accueil.
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
  const [profile, subscription] = await Promise.all([
    prisma.onboardingProfile.findUnique({
      where: { userId },
      select: { completedAt: true },
    }),
    prisma.subscription.findUnique({ where: { userId }, select: { status: true } }),
  ]);

  if (profile?.completedAt) return safeNextPath(requested, ROUTES.dashboard);
  if (profile || subscription) return ROUTES.onboarding;

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
  const [profile, subscription, access, analyses] = await Promise.all([
    prisma.onboardingProfile.findUnique({
      where: { userId },
      select: { completedAt: true },
    }),
    prisma.subscription.findUnique({ where: { userId }, select: { id: true } }),
    getAccess(userId),
    prisma.analysis.count({ where: { userId } }),
  ]);

  if (profile?.completedAt || analyses > 0) return ROUTES.dashboard;
  if (subscription || access.tier !== "free") return ROUTES.onboarding;

  return null;
}
