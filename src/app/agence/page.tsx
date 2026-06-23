import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ServicesCta } from "@/components/ServicesCta";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agency");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: t("keywords").split(",").map((k) => k.trim()),
    alternates: { canonical: ROUTES.agency },
    openGraph: {
      title: `${t("metaTitle")} · ${SITE.name}`,
      description: t("metaDescription"),
      type: "website",
      locale: SITE.locale,
    },
  };
}

type Card = { term: string; definition: string };
type Method = { title: string; body: string };
type Stat = { value: string; label: string };
type Faq = { q: string; a: string };

export default async function AgencyPage() {
  const t = await getTranslations("agency");

  const whatCards = t.raw("whatCards") as Card[];
  const storyParagraphs = t.raw("storyParagraphs") as string[];
  const methodCards = t.raw("methodCards") as Method[];
  const statsItems = t.raw("statsItems") as Stat[];
  const faqItems = t.raw("faqItems") as Faq[];

  // JSON-LD : l'agence applique son propre GEO (Organization + Person + FAQ).
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: SITE.name,
        url: `${SITE.url}${ROUTES.agency}`,
        slogan: SITE.tagline,
        description: t("metaDescription"),
        founder: {
          "@type": "Person",
          name: SITE.founder.name,
          alternateName: SITE.founder.alias,
          url: SITE.founder.url,
          sameAs: [SITE.founder.url],
        },
        areaServed: "FR",
        knowsAbout: [
          "Generative Engine Optimization",
          "GEO",
          "Référencement IA",
          "SEO",
          "Optimisation pour ChatGPT, Gemini et Perplexity",
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Nav />

      <div className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-12 pt-10 text-center sm:pt-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-semibold text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            {t("heroEyebrow")}
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-balance text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            {t("heroTitleBefore")}
            <span className="text-gradient">{t("heroTitleHighlight")}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted sm:text-lg">
            {t("heroSubtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={ROUTES.home}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-cta px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {t("heroCtaPrimary")}
            </Link>
            <Link
              href={ROUTES.services}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface/60 px-6 py-3 text-sm font-semibold text-text transition-colors duration-200 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {t("heroCtaSecondary")}
            </Link>
          </div>
        </section>

        {/* Définition du GEO */}
        <section className="mx-auto w-full max-w-6xl px-5 py-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {t("whatEyebrow")}
          </p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{t("whatTitle")}</h2>
          <p className="mt-4 max-w-3xl text-pretty leading-relaxed text-muted">
            {t("whatBody")}
          </p>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {whatCards.map((c) => (
              <div key={c.term} className="card-cal p-6">
                <h3 className="font-display text-lg font-semibold text-accent">{c.term}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.definition}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Notre histoire */}
        <section className="mx-auto w-full max-w-6xl px-5 py-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {t("storyEyebrow")}
              </p>
              <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{t("storyTitle")}</h2>
              <div className="mt-5 space-y-4 text-pretty leading-relaxed text-muted">
                {storyParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
            <div className="glass-strong sweep relative overflow-hidden rounded-2xl p-7">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {t("storyResultLabel")}
              </p>
              <p className="mt-3 font-display text-2xl font-bold leading-tight text-gradient">
                {t("storyResultValue")}
              </p>
              <p className="mt-3 text-sm text-muted">{t("storyResultMeta")}</p>
            </div>
          </div>
        </section>

        {/* Le fondateur */}
        <section className="mx-auto w-full max-w-6xl px-5 py-12">
          <div className="card-cal flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:p-9">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-accent/15 font-display text-2xl font-bold text-accent">
              TH
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {t("founderEyebrow")}
              </p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">{t("founderName")}</h2>
              <p className="mt-0.5 text-sm text-muted">{t("founderRole")}</p>
              <p className="mt-3 text-pretty leading-relaxed text-muted">{t("founderBody")}</p>
              <a
                href={SITE.founder.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-accent hover:underline"
              >
                {t("founderLink")}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* Notre méthode */}
        <section className="mx-auto w-full max-w-6xl px-5 py-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {t("methodEyebrow")}
          </p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{t("methodTitle")}</h2>
          <p className="mt-3 max-w-2xl text-pretty text-muted">{t("methodSubtitle")}</p>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {methodCards.map((m, i) => (
              <div key={m.title} className="card-cal p-6">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 font-display text-sm font-bold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 font-display text-base font-semibold">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{m.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats marché */}
        <section className="mx-auto w-full max-w-6xl px-5 py-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {t("statsEyebrow")}
          </p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{t("statsTitle")}</h2>
          <div className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {statsItems.map((s) => (
              <div key={s.label} className="glass rounded-2xl p-6 text-center">
                <p className="font-display text-3xl font-bold text-gradient sm:text-4xl">{s.value}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-3xl px-5 py-12">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-accent">
            {t("faqEyebrow")}
          </p>
          <h2 className="mt-1 text-center text-2xl font-bold sm:text-3xl">{t("faqTitle")}</h2>
          <div className="mt-8 space-y-3">
            {faqItems.map((f) => (
              <details key={f.q} className="card-cal group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                  {f.q}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="shrink-0 text-accent transition-transform duration-200 group-open:rotate-45"
                  >
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA services */}
        <div className="px-5 py-12">
          <ServicesCta />
        </div>
      </div>

      <Footer />
    </main>
  );
}
