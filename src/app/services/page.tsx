import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BookCallButton } from "@/components/BookCallButton";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: t("keywords").split(",").map((k) => k.trim()),
    alternates: { canonical: ROUTES.services },
    openGraph: {
      title: `${t("metaTitle")} · ${SITE.name}`,
      description: t("metaDescription"),
      type: "website",
      locale: SITE.locale,
    },
  };
}

type Step = { step: string; title: string; body: string };

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="mt-0.5 shrink-0">
      <circle cx="10" cy="10" r="9" fill="#11b48c" opacity="0.2" />
      <path d="M6 10.5 8.5 13 14 7" stroke="#11b48c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function ServicesPage() {
  const t = await getTranslations("services");
  const includes = t.raw("offerIncludes") as string[];
  const steps = t.raw("processSteps") as Step[];

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Nav />

      <div className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-10 pt-10 text-center sm:pt-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">
            {t("heroEyebrow")}
          </p>
          <h1 className="mx-auto mt-3 max-w-3xl text-balance text-4xl font-bold leading-[1.05] sm:text-5xl">
            {t("heroTitleBefore")}
            <span className="text-gradient">{t("heroTitleHighlight")}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted sm:text-lg">
            {t("heroSubtitle")}
          </p>
        </section>

        {/* Offre principale (sans prix : sur estimation) */}
        <section className="mx-auto w-full max-w-3xl px-5 py-8">
          <div className="sweep relative overflow-hidden rounded-[36px] border border-fog bg-snow p-7 shadow-[var(--shadow-md)] sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">{t("offerTitle")}</h2>
                <p className="mt-2 max-w-md text-sm text-muted">{t("offerSubtitle")}</p>
              </div>
              <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent">
                {t("offerBadge")}
              </span>
            </div>

            <div className="mt-7 border-t border-fog pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-steel">
                {t("offerIncludesTitle")}
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                {includes.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check />
                    <span className="text-muted">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <div>
                <span className="font-display text-3xl font-bold text-text">{t("offerPriceLabel")}</span>
              </div>
              <p className="text-xs text-muted">{t("offerPriceNote")}</p>
              <BookCallButton label={t("offerCta")} className="mt-2 w-full sm:w-auto" />
            </div>
          </div>
        </section>

        {/* Comment ça se passe */}
        <section className="mx-auto w-full max-w-6xl px-5 py-12">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-steel">
            {t("processEyebrow")}
          </p>
          <h2 className="mt-1 text-center text-2xl font-bold sm:text-3xl">{t("processTitle")}</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.step} className="card-cal p-6">
                <span className="font-display text-3xl font-bold text-obsidian">{s.step}</span>
                <h3 className="mt-3 font-display text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pour qui */}
        <section className="mx-auto w-full max-w-3xl px-5 py-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">
            {t("forEyebrow")}
          </p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{t("forTitle")}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty leading-relaxed text-muted">
            {t("forBody")}
          </p>
        </section>

        {/* CTA final : prise de rendez-vous */}
        <div className="px-5 py-12">
          <section className="card-cal sweep relative mx-auto w-full max-w-6xl overflow-hidden px-6 py-12 text-center sm:px-10">
            <h2 className="mx-auto max-w-2xl text-balance text-2xl font-bold sm:text-3xl">
              {t("ctaTitle")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-muted">{t("ctaSubtitle")}</p>
            <div className="mt-7 flex justify-center">
              <BookCallButton label={t("ctaButton")} />
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
