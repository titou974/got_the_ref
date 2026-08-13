import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BookCallButton } from "@/components/BookCallButton";
import { ContactForm } from "@/components/ContactForm";
import { Faq } from "@/components/home/Faq";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: t("keywords").split(",").map((k) => k.trim()),
    alternates: { canonical: ROUTES.contact },
    openGraph: {
      title: `${t("metaTitle")} · ${SITE.name}`,
      description: t("metaDescription"),
      type: "website",
      locale: SITE.locale,
    },
  };
}

/**
 * Page contact : deux portes d'entrée (client prioritaire, question générale),
 * un formulaire qui passe la main à la messagerie du visiteur, puis la FAQ de
 * la home — la plupart des messages reçus y trouvent déjà leur réponse.
 */
export default async function ContactPage() {
  const t = await getTranslations("contact");
  const tf = await getTranslations("footer");

  const policies = [
    { href: ROUTES.legal.terms, label: tf("terms") },
    { href: ROUTES.legal.privacy, label: tf("privacy") },
    { href: ROUTES.legal.mentions, label: tf("legalMentions") },
    { href: ROUTES.pricing, label: tf("pricing") },
  ];

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Nav />

      <div className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-8 pt-10 text-center sm:pt-16">
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

        {/* Deux portes d'entrée */}
        <section className="mx-auto w-full max-w-5xl px-5 py-8">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="card-cal flex flex-col p-6 sm:p-7">
              <h2 className="font-display text-lg font-semibold">{t("priorityTitle")}</h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{t("priorityBody")}</p>
              <a
                href={`mailto:${SITE.contactEmail}`}
                className="mt-5 inline-flex w-fit cursor-pointer items-center justify-center rounded-full bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
              >
                {t("priorityCta")}
              </a>
            </div>

            <div className="card-cal flex flex-col p-6 sm:p-7">
              <h2 className="font-display text-lg font-semibold">{t("generalTitle")}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{t("generalBody")}</p>
              <ul className="mt-3 flex flex-1 flex-wrap gap-x-4 gap-y-1.5 text-sm">
                {policies.map((p) => (
                  <li key={p.href}>
                    <Link
                      href={p.href}
                      className="cursor-pointer text-muted underline underline-offset-4 transition-colors duration-200 hover:text-text"
                    >
                      {p.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <BookCallButton label={t("generalCta")} variant="secondary" />
              </div>
            </div>
          </div>
        </section>

        {/* Formulaire */}
        <section className="mx-auto w-full max-w-3xl px-5 py-10">
          <div className="sweep relative overflow-hidden rounded-[36px] border border-fog bg-snow p-7 shadow-[var(--shadow-md)] sm:p-10">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold sm:text-3xl">{t("formTitle")}</h2>
              <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted">
                {t("formSubtitle")}
              </p>
            </div>

            <ContactForm
              to={SITE.contactEmail}
              labels={{
                name: t("formName"),
                namePlaceholder: t("formNamePlaceholder"),
                email: t("formEmail"),
                emailPlaceholder: t("formEmailPlaceholder"),
                site: t("formSite"),
                sitePlaceholder: t("formSitePlaceholder"),
                subject: t("formSubject"),
                subjectPlaceholder: t("formSubjectPlaceholder"),
                message: t("formMessage"),
                messagePlaceholder: t("formMessagePlaceholder"),
                submit: t("formSubmit"),
              }}
            />

            <p className="mt-5 text-xs text-muted">
              {t("formNote", { email: SITE.contactEmail })}
            </p>
          </div>
        </section>

        {/* Les questions qui reviennent le plus souvent */}
        <Faq />

        {/* CTA final */}
        <div className="px-5 pb-12">
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
