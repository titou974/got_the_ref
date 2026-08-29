import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AnalysisCheckoutButton } from "@/components/AnalysisCheckoutButton";
import { SubscriptionCheckoutButton } from "@/components/SubscriptionCheckoutButton";
import { BrandProof } from "@/components/BrandProof";
import { PricingOffers } from "@/components/pricing/PricingOffers";
import { PricingFaq } from "@/components/pricing/PricingFaq";
import { ResultsCarousel } from "@/components/ResultsCarousel";
import { JsonLd } from "@/lib/seo/json-ld";
import { REDIRECT_REASONS, ROUTES } from "@/constants/routes";
import { BOOST, SUBSCRIPTION_PRICE, YEARLY_MONTHLY_PRICE } from "@/constants/plans";
import { SITE } from "@/constants/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: t("keywords").split(",").map((k) => k.trim()),
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
      description: "Agents IA qui mesurent et corrigent en continu la visibilité d'un site sur ChatGPT, Gemini et Google.",
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

  return (
    <main className="flex min-h-[100dvh] flex-col">
      {offersJsonLd().map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}
      <Nav minimal />

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
        </div>

        <ResultsCarousel className="py-10 sm:py-14" />

        <div className="mx-auto w-full max-w-6xl flex-1 px-5 pb-12 sm:pb-16">
          {/* Les deux offres, l'une sous l'autre : le Coup de Boost en carte
              sombre, puis l'abonnement Tout-en-un. */}
          <div className="mx-auto w-full">
            <PricingOffers
              analysisId={analyse}
              subscriptionCta={
                analyse ? (
                  // Venu d'un rapport précis : on le rattache à l'abonnement souscrit.
                  <AnalysisCheckoutButton analysisId={analyse} label={t("plan.cta")} tone="dark" />
                ) : (
                  // Sans rapport à rattacher, le bouton part quand même sur Stripe :
                  // renvoyer vers la home faisait reculer d'un cran un visiteur déjà
                  // venu voir le prix.
                  <SubscriptionCheckoutButton label={t("plan.cta")} tone="dark" />
                )
              }
            />
          </div>

          <p className="mt-10 text-sm text-muted">{t("secureNote")}</p>
        </div>
      </div>

      <PricingFaq className="pb-16" />

      <Footer />
    </main>
  );
}
