import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandProof } from "@/components/BrandProof";
import { PlanCard } from "@/components/pricing/PlanCard";
import { ROUTES } from "@/constants/routes";

/**
 * Le tarif, en bas de home : après la démonstration, une seule carte, la même
 * que sur la page tarifs — mêmes onglets, même garantie, même montant du jour.
 * Le roster d'agents reste à la page tarifs : ici, la home a déjà montré le
 * produit, et la carte doit se lire d'un écran.
 */
export async function HomePricing() {
  const t = await getTranslations("homePricing");
  const tp = await getTranslations("pricing");

  return (
    <section id="tarif" className="mx-auto w-full max-w-3xl scroll-mt-8 px-5 py-16 sm:py-20">
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
        showAgents={false}
        cta={
          <Link
            href="#analyser"
            className="block w-full cursor-pointer rounded-full bg-white py-3 text-center font-medium text-obsidian transition-colors duration-200 hover:bg-white/90"
          >
            {tp("plan.cta")}
          </Link>
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
