import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RotatingWord } from "./RotatingWord";
import { ROUTES } from "@/constants/routes";
import { SUBSCRIPTION_PRICE, TRIAL } from "@/constants/plans";

/** Les trois moteurs dont on parle en haut de page — logos servis depuis /public. */
const ENGINES = [
  { src: "/chatgpt.png", altKey: "logoOpenaiAlt" },
  { src: "/gemini.webp", altKey: "logoGeminiAlt" },
  { src: "/perplexity.png", altKey: "logoPerplexityAlt" },
] as const;

/**
 * Haut de page : une promesse, un bouton. L'analyse gratuite vit désormais plus
 * bas (section « Analyse gratuite ») — ici, le seul geste proposé est de démarrer
 * l'essai, pour ne pas diviser l'attention au moment où elle est la plus forte.
 */
export async function HomeHero() {
  const t = await getTranslations("homeHero");
  const th = await getTranslations("home");

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-5 pb-10 pt-8 text-center sm:pt-14">
      <div className="flex items-center gap-3">
        {ENGINES.map((engine) => (
          <div
            key={engine.src}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-fog bg-snow p-2"
          >
            <Image src={engine.src} alt={th(engine.altKey)} width={100} height={100} />
          </div>
        ))}
      </div>

      <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
        {t("headingBefore")}{" "}
        <RotatingWord words={t.raw("engines") as string[]} />{" "}
        {t("headingAfter")}
      </h1>

      <p className="mt-5 max-w-xl text-pretty text-base text-muted sm:text-lg">{t("subtitle")}</p>

      {/* CTA unique. Le tunnel d'essai vit sur /tarifs, où le débit est expliqué. */}
      <Link
        href={ROUTES.pricing}
        className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-full bg-cta px-7 py-4 text-base font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
      >
        {t("cta", { days: TRIAL.days })}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      <p className="mt-4 text-xs text-muted">
        {t("ctaNote", {
          price: TRIAL.activationPrice,
          monthly: SUBSCRIPTION_PRICE,
        })}
      </p>
      <p className="mt-1 text-xs text-ash">{t("guarantee")}</p>

      <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-ash">
        {t("trustLabel")}
      </p>
    </section>
  );
}
