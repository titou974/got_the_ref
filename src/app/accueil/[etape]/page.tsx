import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { BusinessKindForm } from "@/components/onboarding/steps/BusinessKindForm";
import { SiteForm } from "@/components/onboarding/steps/SiteForm";
import { MarketForm } from "@/components/onboarding/steps/MarketForm";
import { DescriptionForm } from "@/components/onboarding/steps/DescriptionForm";
import { CompetitorsForm } from "@/components/onboarding/steps/CompetitorsForm";
import { ToneForm } from "@/components/onboarding/steps/ToneForm";
import {
  GoogleConnectStep,
  type GoogleConnectionState,
} from "@/components/onboarding/steps/GoogleConnectStep";
import { ensureOnboardingProfile, resolveStep } from "@/features/onboarding/queries";
import { grantedScopes } from "@/features/onboarding/google";
import { hasPhysicalPresence, type OnboardingStep } from "@/features/onboarding/steps";

export const metadata: Metadata = {
  title: "Configurer votre espace",
  robots: { index: false, follow: false },
};

/**
 * Les actions de ce segment héritent de cette durée. L'étape 2 crawle un site
 * entier puis le fait relire par un modèle : sous les dix secondes par défaut
 * de Vercel, elle finirait systématiquement en 504. Cinq minutes est le plafond
 * de l'offre Hobby sur Fluid Compute, et couvre largement un site de vitrine.
 */
export const maxDuration = 300;

type Props = {
  params: Promise<{ etape: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Le titre et la phrase d'appui de chaque étape. */
const COPY: Record<OnboardingStep, { title: string; subtitle: string }> = {
  activite: {
    title: "Quel type de commerce tenez-vous ?",
    subtitle:
      "Votre réponse décide des villes que nous suivrons et des concurrents que nous surveillerons.",
  },
  site: {
    title: "Quelle est l'adresse de votre site ?",
    subtitle:
      "Nous le lisons page par page pour comprendre ce que vous vendez, où et à qui. Vous n'avez rien à préparer.",
  },
  marche: {
    title: "Où voulez-vous être trouvé ?",
    subtitle:
      "Le marché que vous visez, et les villes où l'on peut pousser votre porte. C'est ce qui décide des questions que nous poserons aux IA.",
  },
  description: {
    title: "Parlez-nous de votre activité",
    subtitle:
      "Nous avons prérempli ces champs avec ce que votre site nous a appris. Corrigez ce qui ne va pas : c'est ce texte que liront nos agents.",
  },
  concurrents: {
    title: "Voici vos concurrents directs",
    subtitle:
      "Ceux qui vous disputent la même place dans les réponses des IA. Décochez ceux qui ne vous concernent pas.",
  },
  tonalite: {
    title: "À quoi ressemble votre marque ?",
    subtitle:
      "Votre couleur, et un texte que vous avez écrit. Les contenus que nous produirons vous ressembleront.",
  },
  "search-console": {
    title: "Connectez vos outils Google",
    subtitle:
      "C'est ce qui nous permet de vous montrer, chiffres à l'appui, ce que notre travail vous rapporte.",
  },
};

export default async function OnboardingStepPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const profile = await ensureOnboardingProfile(user.id);

  if (profile.completedAt) redirect(ROUTES.account);

  const requested = (await params).etape;
  const step = resolveStep(profile, requested);

  // L'URL demandait une étape encore fermée : on la remplace plutôt que
  // d'afficher un formulaire sans les réponses dont il dépend.
  if (step !== requested) redirect(ROUTES.onboardingStep(step));

  // « Voici vos concurrents directs » au-dessus d'une liste vide sonnerait faux.
  // Quand la recherche n'a rien donné, l'étape s'annonce pour ce qu'elle est.
  const copy =
    step === "concurrents" && profile.competitors.length === 0
      ? {
          title: "Vos concurrents directs",
          subtitle:
            "Nous cherchons qui vous dispute la même place dans les réponses des IA. Cette fois, sans résultat.",
        }
      : COPY[step];

  const physical = hasPhysicalPresence(profile.businessKind);

  return (
    <OnboardingShell step={step} title={copy.title} subtitle={copy.subtitle}>
      {step === "activite" && <BusinessKindForm initialValue={profile.businessKind} />}

      {step === "site" && (
        <SiteForm
          physical={physical}
          initialSiteUrl={profile.siteUrl}
          initialMapsUrl={profile.mapsUrl}
        />
      )}

      {step === "marche" && (
        <MarketForm
          physical={physical}
          initialMarket={profile.targetMarket}
          initialCities={profile.cities.length > 0 ? profile.cities : profile.detectedCities}
          detectedCountry={profile.detectedCountry}
          detectedLanguage={profile.detectedLanguage}
        />
      )}

      {step === "description" && (
        <DescriptionForm
          initialDescription={profile.description}
          initialAudience={profile.audience}
          initialNiche={profile.niche}
        />
      )}

      {step === "concurrents" && (
        <CompetitorsForm
          competitors={profile.competitors.map((competitor) => ({
            id: competitor.id,
            name: competitor.name,
            url: competitor.url,
            domain: competitor.domain,
            reason: competitor.reason,
            selected: competitor.selected,
          }))}
        />
      )}

      {step === "tonalite" && (
        <ToneForm
          initialColor={profile.brandColor}
          initialSampleUrl={profile.toneSampleUrl}
        />
      )}

      {step === "search-console" && (
        <GoogleConnectStep
          {...(await googleState(user.id))}
          status={readStatus((await searchParams).google)}
        />
      )}
    </OnboardingShell>
  );
}

/**
 * L'état des deux rattachements Google.
 *
 * Un service compte pour rattaché quand le scope a été accordé *et* qu'une
 * propriété a été retenue : un consentement sans propriété visible ne nous
 * donne aucun chiffre, et l'annoncer comme un succès mentirait au client.
 */
async function googleState(userId: string): Promise<GoogleConnectionState> {
  const connection = await prisma.googleConnection.findUnique({
    where: { userId },
    select: {
      scope: true,
      siteUrl: true,
      ga4PropertyId: true,
      ga4PropertyName: true,
    },
  });

  const granted = grantedScopes(connection?.scope);

  return {
    gscConnected: granted.gsc && Boolean(connection?.siteUrl),
    gscSiteUrl: connection?.siteUrl ?? null,
    ga4Connected: granted.ga4 && Boolean(connection?.ga4PropertyId),
    ga4PropertyName: connection?.ga4PropertyName ?? null,
  };
}

const readStatus = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;
