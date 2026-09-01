import "server-only";

import { prisma } from "@/lib/prisma";
import { ROUTES, safeNextPath } from "@/constants/routes";

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
 * ouvrirait des écrans vides.
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

  return safeNextPath(requested, ROUTES.pricing);
}
