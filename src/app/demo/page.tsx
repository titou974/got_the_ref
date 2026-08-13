import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BookCallButton } from "@/components/BookCallButton";
import { ResultsCarousel } from "@/components/ResultsCarousel";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("demo");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: t("keywords").split(",").map((k) => k.trim()),
    alternates: { canonical: ROUTES.demo },
    openGraph: {
      title: `${t("metaTitle")} · ${SITE.name}`,
      description: t("metaDescription"),
      type: "website",
      locale: SITE.locale,
    },
  };
}

type Step = { step: string; title: string; body: string };

/** Cinq étoiles pleines, dessinées plutôt qu'importées : une image de moins à charger. */
function Stars() {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="15" height="15" viewBox="0 0 20 20" fill="#f5a623">
          <path d="M10 1.6l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z" />
        </svg>
      ))}
    </div>
  );
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="mt-0.5 shrink-0">
      <circle cx="10" cy="10" r="9" fill="#11b48c" opacity="0.2" />
      <path
        d="M6 10.5 8.5 13 14 7"
        stroke="#11b48c"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Page de prise de rendez-vous. Elle remplace l'ancienne page « Nos services » :
 * un seul geste est proposé — réserver la démo — et tout le reste de la page
 * n'est là que pour lever les objections avant le clic (preuves, programme de
 * l'appel, déroulé de la mission).
 *
 * Aucun prix ici : le chiffrage se fait après l'appel, comme sur la page tarifs.
 */
export default async function DemoPage() {
  const t = await getTranslations("demo");
  const agenda = t.raw("agendaItems") as string[];
  const steps = t.raw("processSteps") as Step[];

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Nav />

      <div className="flex-1">
        {/* Hero : la promesse, le bouton, puis les réassurances */}
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

          <div className="mt-8 flex justify-center">
            <BookCallButton label={t("heroCta")} />
          </div>
          <p className="mt-3 text-xs text-muted">{t("heroNote")}</p>

          <div className="mt-8 flex flex-col items-center gap-2">
            <Stars />
            <p className="text-sm text-muted">{t("trustLabel")}</p>
          </div>

          <p className="mx-auto mt-6 max-w-md text-pretty text-sm font-medium text-text">
            {t("guarantee")}
          </p>
        </section>

        {/* Ils y gagnent : le ruban de preuves de la home */}
        <ResultsCarousel className="py-10 sm:py-14" />

        {/* Le programme de l'appel : ce qu'on regarde, point par point */}
        <section className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-steel">
              {t("agendaEyebrow")}
            </p>
            <h2 className="mt-2 text-balance text-2xl font-bold sm:text-3xl">{t("agendaTitle")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-muted">{t("agendaSubtitle")}</p>
          </div>

          <ul className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agenda.map((item) => (
              <li key={item} className="card-cal flex gap-3 px-5 py-4 text-sm">
                <Check />
                <span className="text-muted">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex justify-center">
            <BookCallButton label={t("heroCta")} />
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
            <div className="mt-7 flex flex-col items-center gap-3">
              <BookCallButton label={t("ctaButton")} />
              <Stars />
              <p className="text-sm text-muted">{t("trustLabel")}</p>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
