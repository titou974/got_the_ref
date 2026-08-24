import "server-only";

import { prisma } from "@/lib/prisma";
import { FIRST_STEP, ONBOARDING_STEPS, isOnboardingStep, type OnboardingStep } from "./steps";

/**
 * L'accès à la fiche d'accueil. Une ligne par compte, créée à la première
 * visite du tunnel — on ne la crée pas à l'inscription : beaucoup de comptes
 * naissent d'un paiement et n'entreront jamais ici.
 */

export type OnboardingProfile = NonNullable<
  Awaited<ReturnType<typeof getOnboardingProfile>>
>;

export async function getOnboardingProfile(userId: string) {
  return prisma.onboardingProfile.findUnique({
    where: { userId },
    include: { competitors: { orderBy: { rank: "asc" } } },
  });
}

/** La fiche du compte, créée à la volée si c'est sa première venue. */
export async function ensureOnboardingProfile(userId: string) {
  const existing = await getOnboardingProfile(userId);
  if (existing) return existing;

  await prisma.onboardingProfile.create({ data: { userId } });
  return getOnboardingProfile(userId) as Promise<OnboardingProfile>;
}

/** Vrai si le tunnel est derrière ce compte : on ne l'y ramène plus. */
export async function isOnboardingComplete(userId: string): Promise<boolean> {
  const profile = await prisma.onboardingProfile.findUnique({
    where: { userId },
    select: { completedAt: true },
  });
  return Boolean(profile?.completedAt);
}

/**
 * L'étape réellement ouverte, à partir de celle demandée dans l'URL.
 *
 * On autorise le retour en arrière — relire ou corriger une réponse est normal
 * — mais pas le saut en avant : l'étape 5 n'a rien à afficher tant que
 * l'activité de l'étape 4 n'a pas été décrite. Une URL trop ambitieuse est donc
 * ramenée à l'étape courante plutôt que refusée.
 */
export function resolveStep(
  profile: { step: string },
  requested: unknown,
): OnboardingStep {
  const current = isOnboardingStep(profile.step) ? profile.step : FIRST_STEP;
  if (!isOnboardingStep(requested)) return current;

  const requestedIndex = ONBOARDING_STEPS.indexOf(requested);
  const currentIndex = ONBOARDING_STEPS.indexOf(current);
  return requestedIndex <= currentIndex ? requested : current;
}
