import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandProof } from "@/components/BrandProof";
import { TrialCheckoutButton } from "@/components/TrialCheckoutButton";
import { PlanCard } from "@/components/pricing/PlanCard";
import { ROUTES } from "@/constants/routes";
import { TRIAL } from "@/constants/plans";

/** Montant formaté à la française, sans décimales (20 000 €). */
const euros = (amount: number) => `${amount.toLocaleString("fr-FR")} €`;

/**
 * Le tarif, en bas de home : après la démonstration, une seule carte, la même
 * que sur la page tarifs — mêmes onglets, même garantie, même montant du jour.
 *
 * Version resserrée, et bouton qui part droit sur Stripe : à ce stade de la
 * page, le visiteur a déjà vu le produit tourner ; le renvoyer vers l'analyse
 * gratuite serait le faire reculer d'un cran.
 */
export async function HomePricing() {
  const t = await getTranslations("homePricing");
  const tp = await getTranslations("pricing");

  return (
    <section id="tarif" className="mx-auto w-full max-w-xl scroll-mt-8 px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
        <h2 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 text-pretty text-muted">{t("subtitle")}</p>
        <BrandProof className="mt-7" />
      </div>

      <PlanCard
        className="mt-10"
        compact
        showAgents={false}
        ctaNote={tp("plan.ctaStripeNote")}
        cta={
          <TrialCheckoutButton
            label={tp("plan.ctaStripe", { price: euros(TRIAL.activationPrice) })}
          />
        }
      />

      <div className="mt-5 text-center">
        <Link
          href={ROUTES.pricing}
          className="cursor-pointer text-sm text-muted underline underline-offset-4 transition-colors duration-200 hover:text-text"
        >
          {t("allDetails")}
        </Link>
      </div>
    </section>
  );
}
