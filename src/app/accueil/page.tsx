import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import {
  ensureOnboardingProfile,
  isOnboardingComplete,
} from "@/features/onboarding/queries";
import { canEnterOnboarding } from "@/features/onboarding/access";
import { FIRST_STEP, normalizeStep } from "@/features/onboarding/steps";

/**
 * L'entrée du tunnel : elle ne montre rien, elle oriente.
 *
 * Un client revenu deux jours plus tard tape `/accueil` et retombe sur l'étape
 * qu'il avait laissée. Un client qui a fini est renvoyé sur son tableau de bord
 * — on ne refait pas signer ce qui est signé. Et un compte qui n'a encore rien
 * pris repart sur les tarifs : le tunnel se franchit après la décision, jamais
 * avant (cf. `canEnterOnboarding`).
 *
 * L'ordre compte : on tranche avant d'écrire. Créer la fiche d'abord marquait
 * « accueil entamé » un compte qu'on refuse à la ligne suivante, et
 * `resolveAuthDestination` le renvoyait alors ici à chaque visite — la home
 * comme la connexion le déposaient dans une boucle dont il ne sortait plus.
 */
export default async function AccueilPage() {
  const user = await requireUser();

  if (await isOnboardingComplete(user.id)) redirect(ROUTES.dashboard);
  if (!(await canEnterOnboarding(user.id))) redirect(ROUTES.pricing);

  const profile = await ensureOnboardingProfile(user.id);

  redirect(ROUTES.onboardingStep(normalizeStep(profile.step) ?? FIRST_STEP));
}
