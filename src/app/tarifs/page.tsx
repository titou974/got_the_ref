import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AnalysisCheckoutButton } from "@/components/AnalysisCheckoutButton";
import { TrialCheckoutButton } from "@/components/TrialCheckoutButton";
import { BrandProof } from "@/components/BrandProof";
import { PlanCard } from "@/components/pricing/PlanCard";
import { ResultsCarousel } from "@/components/ResultsCarousel";
import { REDIRECT_REASONS } from "@/constants/routes";
import { TRIAL } from "@/constants/plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return { title: t("metaTitle") };
}

type Props = { searchParams: Promise<{ raison?: string; analyse?: string }> };

/** Montant formaté à la française, sans décimales (20 000 €). */
const euros = (amount: number) => `${amount.toLocaleString("fr-FR")} €`;

export default async function TarifsPage({ searchParams }: Props) {
  const { raison, analyse } = await searchParams;
  const t = await getTranslations("pricing");

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Nav minimal />

      <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:py-16">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 text-balance text-3xl font-bold leading-[1.1] sm:text-[40px]">
            {t("headingBefore")}
            <span className="text-gradient">{t("headingHighlight")}</span>
          </h1>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted">{t("subtitle")}</p>

          <BrandProof className="mt-7" />

          {raison === REDIRECT_REASONS.quota && (
            <p className="mt-6 rounded-2xl bg-warning/10 px-4 py-3 text-sm text-warning">
              {t("quotaNote")}
            </p>
          )}
        </header>

        {/* L'abonnement : onglets de facturation, garantie, puis la carte sombre. */}
        <div className="mx-auto mt-12 w-full max-w-2xl">
          <PlanCard
            cta={
              analyse ? (
                // Venu d'un rapport précis : on le rattache à l'abonnement souscrit.
                <AnalysisCheckoutButton
                  analysisId={analyse}
                  label={t("trialCta", { price: euros(TRIAL.activationPrice) })}
                />
              ) : (
                // Sans rapport à rattacher, le bouton part quand même sur Stripe :
                // renvoyer vers la home faisait reculer d'un cran un visiteur déjà
                // venu voir le prix.
                <TrialCheckoutButton
                  label={t("plan.cta", { price: euros(TRIAL.activationPrice) })}
                />
              )
            }
          />
        </div>

        <p className="mt-10 text-sm text-muted">{t("secureNote", { days: TRIAL.days })}</p>
      </div>

      <ResultsCarousel className="pb-16" />

      <Footer />
    </main>
  );
}
