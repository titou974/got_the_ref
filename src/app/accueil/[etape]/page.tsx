import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { SiteForm } from "@/components/onboarding/steps/SiteForm";
import { ensureOnboardingProfile } from "@/features/onboarding/queries";
import { FIRST_STEP, hasPhysicalPresence, isOnboardingStep } from "@/features/onboarding/steps";

export const metadata: Metadata = {
  title: "Configurer votre espace",
  robots: { index: false, follow: false },
};

/**
 * Les actions de ce segment héritent de cette durée. L'étape crawle un site
 * entier puis le fait relire par un modèle : sous les dix secondes par défaut
 * de Vercel, elle finirait systématiquement en 504. Cinq minutes est le plafond
 * de l'offre Hobby sur Fluid Compute, et couvre largement un site de vitrine.
 */
export const maxDuration = 300;

type Props = {
  params: Promise<{ etape: string }>;
};

/**
 * L'unique question de l'accueil : l'adresse du site.
 *
 * Le segment reste dynamique — les liens déjà envoyés pointent sur les
 * anciennes étapes, et une URL périmée doit ramener ici plutôt que sur une 404.
 */
export default async function OnboardingStepPage({ params }: Props) {
  const user = await requireUser();
  const profile = await ensureOnboardingProfile(user.id);

  if (profile.completedAt) redirect(ROUTES.dashboard);

  const requested = (await params).etape;
  if (!isOnboardingStep(requested)) redirect(ROUTES.onboardingStep(FIRST_STEP));

  return (
    <OnboardingShell
      title="Quelle est l'adresse de votre site ?"
      subtitle="Nous le lisons page par page pour comprendre ce que vous vendez, où et à qui. Vous n'avez rien à préparer, et votre tableau de bord s'ouvre juste après."
    >
      <SiteForm
        physical={hasPhysicalPresence(profile.businessKind)}
        initialSiteUrl={profile.siteUrl}
        initialMapsUrl={profile.mapsUrl}
      />
    </OnboardingShell>
  );
}
