import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/constants/plans";
import {
  boostArticlesOpenUntil,
  canOpen,
  resolveTier,
  type AccessTier,
  type DashboardSection,
} from "@/constants/access";
import { AppError } from "@/lib/errors";

/**
 * Le niveau d'accès d'un compte, relu une seule fois par requête.
 *
 * Deux tables suffisent : l'offre portée par le compte (`User.plan`, où vivent
 * le Coup de Boost et la démonstration, tous deux sans abonnement Stripe) et
 * l'abonnement lui-même. La règle, elle, est ailleurs — `resolveTier` est une
 * fonction pure, celle que les cartes tarifaires et la barre latérale relisent.
 */

export type AccessState = {
  tier: AccessTier;
  /**
   * Fin de la semaine de rédaction ouverte par le Coup de Boost, ou `null` :
   * soit le compte n'est pas au Coup de Boost, soit la semaine est passée.
   */
  boostArticlesUntil: Date | null;
};

export const getAccess = cache(async function getAccess(userId: string): Promise<AccessState> {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, boostGrantedAt: true },
    }),
    prisma.subscription.findUnique({ where: { userId }, select: { status: true } }),
  ]);

  const tier = resolveTier({
    plan: user?.plan,
    subscribed: hasActiveSubscription(subscription),
    boostGrantedAt: user?.boostGrantedAt,
  });

  return { tier, boostArticlesUntil: boostArticlesOpenUntil(tier, user?.boostGrantedAt) };
});

/**
 * Garde-fou des actions serveur : une section fermée ne doit pas seulement être
 * floutée à l'écran.
 *
 * Le voile est une affaire de mise en page ; ce qui protège réellement, c'est ce
 * refus-ci. Sans lui, un appel direct à l'action de rédaction ouvrirait les
 * articles à un compte gratuit, quelle que soit la barre latérale.
 */
export async function requireSection(
  userId: string,
  section: DashboardSection,
): Promise<AccessState> {
  const access = await getAccess(userId);
  if (!canOpen(access.tier, section)) {
    throw new AppError("Cette section n'est pas ouverte sur votre offre.", "TIER_LOCKED", 403);
  }
  return access;
}
