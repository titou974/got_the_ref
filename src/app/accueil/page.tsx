import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { ensureOnboardingProfile } from "@/features/onboarding/queries";
import { FIRST_STEP, normalizeStep } from "@/features/onboarding/steps";

/**
 * L'entrée du tunnel : elle ne montre rien, elle oriente.
 *
 * Un client revenu deux jours plus tard tape `/accueil` et retombe sur l'étape
 * qu'il avait laissée. Un client qui a fini est renvoyé sur son tableau de bord
 * — on ne refait pas signer ce qui est signé.
 */
export default async function AccueilPage() {
  const user = await requireUser();
  const profile = await ensureOnboardingProfile(user.id);

  if (profile.completedAt) redirect(ROUTES.dashboard);

  redirect(ROUTES.onboardingStep(normalizeStep(profile.step) ?? FIRST_STEP));
}
