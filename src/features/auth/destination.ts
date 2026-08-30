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
 * dont l'accueil est fait rentre chez lui, les autres passent par l'accueil.
 * Plus personne n'est renvoyé vers les tarifs à l'identification — l'accueil ne
 * demande plus qu'une adresse de site, et le tableau de bord qui s'ouvre
 * derrière montre déjà ce qu'il y a à acheter. Vendre avant d'avoir montré,
 * c'était le réflexe de l'époque où le produit commençait au paiement.
 *
 * Le `suite` (la page visée avant l'identification) n'est honoré qu'une fois
 * l'accueil terminé : y renvoyer un compte qui n'a pas encore donné son site
 * ouvrirait des écrans vides.
 */
export async function resolveAuthDestination(
  userId: string,
  requested: unknown,
): Promise<string> {
  const profile = await prisma.onboardingProfile.findUnique({
    where: { userId },
    select: { completedAt: true },
  });

  if (profile?.completedAt) return safeNextPath(requested, ROUTES.dashboard);
  return ROUTES.onboarding;
}
