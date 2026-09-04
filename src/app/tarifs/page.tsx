import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AnalysisCheckoutButton } from "@/components/AnalysisCheckoutButton";
import { SubscriptionCheckoutButton } from "@/components/SubscriptionCheckoutButton";
import { TrialCheckoutButton } from "@/components/TrialCheckoutButton";
import { BrandProof } from "@/components/BrandProof";
import { PricingOffers } from "@/components/pricing/PricingOffers";
import { PricingFaq } from "@/components/pricing/PricingFaq";
import { ResultsCarousel } from "@/components/ResultsCarousel";
import { TrafficGainCards } from "@/components/geo/TrafficGainCards";
import { totalGainFor } from "@/lib/geo/traffic-gain";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardContext } from "@/features/dashboard/queries";
import { isOnboardingComplete } from "@/features/onboarding/queries";
import { JsonLd } from "@/lib/seo/json-ld";
import { REDIRECT_REASONS, ROUTES } from "@/constants/routes";
import {
  BOOST,
  SUBSCRIPTION_PRICE,
  TRIAL,
  YEARLY_MONTHLY_PRICE,
} from "@/constants/plans";
import { SITE } from "@/constants/site";
import { ANONYMOUS_TRIAL_STATE, getTrialState } from "@/features/billing/trial";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: t("keywords")
      .split(",")
      .map((k) => k.trim()),
    alternates: { canonical: ROUTES.pricing },
    openGraph: {
      title: `${t("metaTitle")} · ${SITE.name}`,
      description: t("metaDescription"),
      type: "website",
      locale: SITE.locale,
    },
  };
}

/**
 * Offres en `Product` + `Offer` : les IA extraient plus facilement un prix
 * porté par un schema dédié qu'un chiffre noyé dans du texte marketing.
 */
function offersJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `${SITE.name} — Tout-en-un`,
      description:
        "Agents IA qui mesurent et corrigent en continu la visibilité d'un site sur ChatGPT, Gemini et Google.",
      brand: { "@type": "Brand", name: SITE.name },
      offers: [
        {
          "@type": "Offer",
          name: "Abonnement mensuel",
          price: SUBSCRIPTION_PRICE,
          priceCurrency: "EUR",
          priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
          availability: "https://schema.org/InStock",
          url: `${SITE.url}${ROUTES.pricing}`,
        },
        {
          "@type": "Offer",
          name: "Abonnement annuel (mensualisé)",
          price: YEARLY_MONTHLY_PRICE,
          priceCurrency: "EUR",
          priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
          availability: "https://schema.org/InStock",
          url: `${SITE.url}${ROUTES.pricing}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `${SITE.name} — Coup de Boost`,
      description: `Passe unique des agents IA : mesure, corrections et ${BOOST.articles} articles publiés, sans abonnement.`,
      brand: { "@type": "Brand", name: SITE.name },
      offers: {
        "@type": "Offer",
        price: BOOST.price,
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `${SITE.url}${ROUTES.pricing}`,
      },
    },
  ];
}

type Props = { searchParams: Promise<{ raison?: string; analyse?: string }> };

export default async function TarifsPage({ searchParams }: Props) {
  const { raison, analyse } = await searchParams;
  const t = await getTranslations("pricing");
  const tg = await getTranslations("trafficGain");

  // Deux questions posées au même compte, et une seule identification.
  //
  // L'essai n'est proposé qu'à qui peut encore le prendre : un visiteur sans
  // compte, ou un compte gratuit qui n'a jamais ouvert d'abonnement. Pendant
  // l'essai comme après, la page reprend sa forme habituelle — Coup de Boost en
  // tête, abonnement à son prix dessous — sans reproposer trois jours déjà
  // consommés (cf. `features/billing/trial.ts`).
  //
  // Les visites à gagner, elles, ne s'affichent que si elles sont calculées sur
  // le site du visiteur. Sans session, ou avec un compte dont l'analyse n'a pas
  // encore tourné, il n'y a rien d'honnête à annoncer : un chiffre de site type
  // se lirait comme une promesse chiffrée faite à quelqu'un dont on n'a rien lu.
  const user = await getCurrentUser();
  const [{ available: trial }, analysis, hasDashboard] = user
    ? await Promise.all([
        getTrialState(user.id),
        getDashboardContext(user.id).then((context) => context.analysis),
        isOnboardingComplete(user.id),
      ])
    : [ANONYMOUS_TRIAL_STATE, null, false];

  return (
    <main className="flex min-h-[100dvh] flex-col">
      {offersJsonLd().map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}
      {/* La flèche de retour ne s'affiche que s'il y a un tableau de bord à
          retrouver. Un compte qui vient de naître n'en a pas : la flèche le
          renvoyait sur une page qui, faute de fiche d'accueil, le déposait dans
          le tunnel de mise en route — c'est-à-dire exactement l'écran qu'on ne
          lui ouvre plus avant qu'il ait pris quelque chose. Sans tableau de
          bord derrière, pas de retour : il ne reste que la décision.

          Et jamais « Tableau de bord » ni « Déconnexion » à droite : sur une
          page de prix, la première mène à un espace que ce compte n'a pas
          encore, la seconde ferme la session en plein choix. */}
      <Nav minimal showSession={false} backTo={hasDashboard ? ROUTES.dashboard : null} />

      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-6xl px-5 pt-12 sm:pt-16">
          <header className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-steel">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 text-balance text-3xl font-bold leading-[1.1] sm:text-[40px]">
              {t("headingBefore")}
              <span className="text-gradient">{t("headingHighlight")}</span>
            </h1>
            <BrandProof className="mt-7" />

            {raison === REDIRECT_REASONS.quota && (
              <p className="mt-6 rounded-2xl bg-warning/10 px-4 py-3 text-sm text-warning">
                {t("quotaNote")}
              </p>
            )}
          </header>

          {/* Ce que le client vient chercher avant le prix : ce que ça
              rapporte, calculé sur son propre site. */}
          {analysis && (
            <div className="mt-10">
              <TrafficGainCards
                gain={totalGainFor(analysis)}
                title={tg("pricingTitle")}
                caption={tg("pricingCaption")}
              />
            </div>
          )}
        </div>

        <ResultsCarousel className="py-10 sm:py-14" />

        <div className="mx-auto w-full max-w-6xl flex-1 px-5 pb-12 sm:pb-16">
          {/* Les deux offres, côte à côte sur ordinateur. Qui n'a pas encore
              ouvert son essai voit l'abonnement d'abord, en carte sombre, à 0 €
              aujourd'hui ; les autres — essai en cours, essai passé, client —
              retrouvent le Coup de Boost en tête et l'abonnement à côté. */}
          <div className="mx-auto w-full">
            <PricingOffers
              analysisId={analyse}
              trial={trial}
              subscriptionCta={
                analyse ? (
                  // Venu d'un rapport précis : on le rattache à l'abonnement souscrit.
                  // Pas d'essai sur ce chemin — c'est le rapport qu'on vient ouvrir,
                  // et trois jours de niveau gratuit ne l'ouvriraient pas.
                  <AnalysisCheckoutButton
                    analysisId={analyse}
                    label={t("plan.cta")}
                    tone="dark"
                  />
                ) : trial ? (
                  // L'essai : même abonnement, ouvert sur trois jours gratuits.
                  <TrialCheckoutButton
                    label={t("plan.ctaTrial", { days: TRIAL.days })}
                  />
                ) : (
                  // Sans rapport à rattacher, le bouton part quand même sur Stripe :
                  // renvoyer vers la home faisait reculer d'un cran un visiteur déjà
                  // venu voir le prix.
                  <SubscriptionCheckoutButton
                    label={t("plan.cta")}
                    tone="dark"
                  />
                )
              }
            />
          </div>
        </div>
      </div>
      <PricingFaq className="pb-16" />
      <Footer />
    </main>
  );
}
