import "server-only";

import { prisma } from "@/lib/prisma";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/constants/plans";
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
 * D'où cet arbitrage, posé une fois : un compte qui a déjà un abonnement ou un
 * tunnel d'accueil entamé retourne chez lui — tableau de bord si l'accueil est
 * fini, tunnel sinon. Un compte réellement neuf continue là où il allait, les
 * tarifs par défaut.
 */
export async function resolveAuthDestination(
  userId: string,
  requested: unknown,
): Promise<string> {
  const fallback = safeNextPath(requested, ROUTES.pricing);

  const [subscription, profile] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId },
      select: { status: true },
    }),
    prisma.onboardingProfile.findUnique({
      where: { userId },
      select: { completedAt: true },
    }),
  ]);

  const subscribed =
    subscription !== null &&
    (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(subscription.status);

  if (profile?.completedAt) return ROUTES.dashboard;
  if (subscribed || profile) return ROUTES.onboarding;

  return fallback;
}
