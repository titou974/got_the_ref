import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ROUTES } from "@/constants/routes";
import { BookCallButton } from "./BookCallButton";

/**
 * Carte CTA réutilisable vers la prise de rendez-vous.
 * Affichée en bas de la page agence, en bas de chaque rapport d'analyse
 * et sous chaque prompt-solution pour rediriger vers /demo.
 */
export async function DemoCta() {
  const t = await getTranslations("ctaDemo");

  return (
    <section className="card-cal sweep relative mx-auto w-full max-w-6xl overflow-hidden px-6 py-10 text-center sm:px-10 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-wider text-steel">
        {t("eyebrow")}
      </p>
      <h2 className="mx-auto mt-2 max-w-2xl text-balance text-2xl font-bold sm:text-3xl">
        {t("title")}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-pretty text-muted">{t("subtitle")}</p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href={ROUTES.demo}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-cta px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
        >
          {t("button")}
        </Link>
        <BookCallButton label={t("secondary")} variant="secondary" />
      </div>
    </section>
  );
}
