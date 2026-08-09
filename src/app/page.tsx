import { Nav } from "@/components/Nav";
import { GeoQuoteCard } from "@/components/GeoQuoteCard";
import { UrlAnalyzeForm } from "@/components/UrlAnalyzeForm";
import { AiSearchSimulation } from "@/components/AiSearchSimulation";
import { ProofSection } from "@/components/ProofSection";
import { ScrollTopCta } from "@/components/ScrollTopCta";
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ROUTES } from "@/constants/routes";
import { AI_ENGINE_LOGOS } from "@/constants/site";

const LOGO_ALT_KEYS = {
  openai: "logoOpenaiAlt",
  gemini: "logoGeminiAlt",
} as const;

export default async function Home() {
  const t = await getTranslations("home");

  return (
    <main className="flex min-h-dvh flex-col">
      <Nav />
      <section
        id="analyser"
        className="mx-auto grid w-full max-w-6xl flex-1 scroll-mt-4 grid-cols-1 items-center gap-10 px-5 py-2 lg:grid-cols-2 lg:gap-14 lg:py-6"
      >
        {/* Colonne gauche : message + input central */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="flex gap-3">
            {AI_ENGINE_LOGOS.map((logo) => (
              <div key={logo.key} className="flex h-10 w-10 items-center justify-center rounded-xl border border-fog bg-snow p-2 sm:h-11 sm:w-11 sm:rounded-2xl">
                <Image
                  src={logo.src}
                  alt={t(LOGO_ALT_KEYS[logo.key])}
                  width={100}
                  height={100}
                />
              </div>
            ))}
          </div>

          <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            {t("headingBefore")}
            <span className="text-gradient">{t("headingHighlight")}</span>
            {t("headingAfter")}
          </h1>

          <p className="mt-4 max-w-md text-pretty text-base text-muted sm:text-lg">
            {t("subtitle")}
          </p>

          <div className="mt-7 w-full max-w-lg">
            <UrlAnalyzeForm size="lg" />
            <p className="mt-3 text-center text-xs text-muted lg:text-left">
              {t("freeAnalysisNote")}
              <Link
                href={ROUTES.pricing}
                className="cursor-pointer font-medium text-text underline decoration-pebble underline-offset-2 hover:decoration-obsidian"
              >
                {t("viewPricing")}
              </Link>
            </p>

            {/* Lien vers la page agence (Visia, 1ère agence de GEO française) */}
            <div className="mt-4 flex flex-col items-center gap-1 lg:items-start">
              <Link
                href={ROUTES.agency}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-fog bg-snow px-3.5 py-2 text-[13px] font-medium text-text transition-colors duration-200 hover:border-pebble focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
              >
                {t("discoverAgency")}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                  className="text-accent transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <span className="text-xs text-muted">{t("discoverAgencyNote")}</span>
            </div>
          </div>
        </div>

        {/* Colonne droite : simulation IA animée */}
        <div className="w-full">
          <AiSearchSimulation />
          <p className="mt-3 text-center text-xs text-muted">
            {t("simulationCaption")}
          </p>
        </div>
      </section>
      {/* Preuve : un commerce réel cité par les IA, et le client qui en est venu */}
      <ProofSection />

      <div className="px-5 py-12">
        <GeoQuoteCard />
      </div>
      <ScrollTopCta label={t("scrollTopCta")} />
    </main>
  );
}
