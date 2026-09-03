import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { BusinessKindForm } from "@/components/onboarding/steps/BusinessKindForm";
import { SiteForm } from "@/components/onboarding/steps/SiteForm";
import { ensureOnboardingProfile } from "@/features/onboarding/queries";
import { canEnterOnboarding } from "@/features/onboarding/access";
import {
  FIRST_STEP,
  hasPhysicalPresence,
  isOnboardingStep,
  normalizeStep,
} from "@/features/onboarding/steps";

export const metadata: Metadata = {
  title: "Configurer votre espace",
  robots: { index: false, follow: false },
};

/**
 * Les actions de ce segment héritent de cette durée. L'étape du site crawle un
 * site entier puis le fait relire par un modèle : sous les dix secondes par
 * défaut de Vercel, elle finirait systématiquement en 504. Cinq minutes est le
 * plafond de l'offre Hobby sur Fluid Compute, et couvre largement une vitrine.
 */
export const maxDuration = 300;

type Props = {
  params: Promise<{ etape: string }>;
};

/**
 * Les deux questions de l'accueil : la forme du commerce, puis son adresse web.
 *
 * Le segment reste dynamique — des liens déjà envoyés pointent sur d'anciennes
 * étapes, et une URL périmée doit ramener sur une question vivante plutôt que
 * sur une 404.
 */
export default async function OnboardingStepPage({ params }: Props) {
  const user = await requireUser();
  const profile = await ensureOnboardingProfile(user.id);

  if (profile.completedAt) redirect(ROUTES.dashboard);
  // Même garde que l'entrée du tunnel : une étape se rejoint aussi par son URL,
  // et la porte doit tenir aux deux endroits.
  if (!(await canEnterOnboarding(user.id))) redirect(ROUTES.pricing);

  const requested = (await params).etape;
  if (!isOnboardingStep(requested)) {
    redirect(ROUTES.onboardingStep(normalizeStep(requested) ?? FIRST_STEP));
  }

  if (requested === "activite") {
    return (
      <OnboardingShell
        step="activite"
        title="Vos clients viennent-ils sur place ?"
        subtitle="La réponse change ce que nous cherchons : une position dans votre ville, ou une position sur tout le web. Elle décide aussi si nous vous demandons votre fiche Google Maps juste après."
      >
        <BusinessKindForm initialValue={profile.businessKind} />
      </OnboardingShell>
    );
  }

  const physical = hasPhysicalPresence(profile.businessKind);

  return (
    <OnboardingShell
      step="site"
      title="Quelle est l'adresse de votre site ?"
      subtitle={
        physical
          ? "Nous le lisons page par page pour comprendre ce que vous vendez, où et à qui. Ajoutez votre fiche Google Maps si vous en avez une, et votre tableau de bord s'ouvre juste après."
          : "Nous le lisons page par page pour comprendre ce que vous vendez et à qui. Vous n'avez rien à préparer, et votre tableau de bord s'ouvre juste après."
      }
    >
      <SiteForm
        physical={physical}
        initialSiteUrl={profile.siteUrl}
        initialMapsUrl={profile.mapsUrl}
      />
    </OnboardingShell>
  );
}
