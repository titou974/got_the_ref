import { Nav } from "@/components/Nav";
import { UrlAnalyzeForm } from "@/components/UrlAnalyzeForm";
import { AiSearchSimulation } from "@/components/AiSearchSimulation";
import { ProofSection } from "@/components/ProofSection";
import { ResultsCarousel } from "@/components/ResultsCarousel";
import { WorksWith } from "@/components/WorksWith";
import { ScrollTopCta } from "@/components/ScrollTopCta";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
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

            {/* Lève l'objection « ça marche avec mon site ? » là où elle se pose. */}
            <WorksWith className="mt-7" />
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

      <ResultsCarousel className="py-14" />
      <ScrollTopCta label={t("scrollTopCta")} />
    </main>
  );
}
