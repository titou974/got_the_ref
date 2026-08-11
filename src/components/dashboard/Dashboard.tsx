import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { scoreLabel } from "@/lib/score";
import { AnimatedScoreRing } from "./AnimatedScoreRing";
import { AnimatedCard } from "./AnimatedCard";
import { SiteScreenshot } from "./SiteScreenshot";
import { ReportTabs } from "./ReportTabs";
import { FreeReportCard } from "./FreeReportCard";
import { UrlAnalyzeForm } from "@/components/UrlAnalyzeForm";
import { UnlockPricingCta } from "./UnlockPricingCta";
import { ROUTES } from "@/constants/routes";

export async function Dashboard({
  result,
  analysisId,
  locked,
}: {
  result: GeoAnalysisResult;
  analysisId: string;
  /** Analyse non payée : classements IA, recommandations, prompts, contenu,
   * présence et Maps passent derrière l'overlay. L'architecture reste ouverte. */
  locked: boolean;
}) {
  const t = await getTranslations("analysisReport");
  const td = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const diagnostic = buildDiagnostic(result);

  const date = new Date(result.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-5 py-8">
      {/* Hero : capture du site assombrie, avec la note globale centrée par-dessus */}
      <div className="mx-auto w-full max-w-3xl">
        <SiteScreenshot url={result.url} domain={result.domain} variant="site">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {t("heroEyebrow")}
          </p>
          <AnimatedScoreRing
            score={result.overallScore}
            label={scoreLabel(result.overallScore)}
            trackColor="rgba(255,255,255,0.18)"
            labelClassName="text-white/80"
          />
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {result.businessName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-white/80">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer font-medium text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
              >
                {result.domain}
              </a>
              <span aria-hidden>·</span>
              <span>{result.businessType}</span>
              <span aria-hidden>·</span>
              <span>{date}</span>
            </div>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-white/90">
              {result.verdict}
            </p>
          </div>
        </SiteScreenshot>
      </div>

      {/* Constat livré d'office : ce qui tient, ce qui manque, ce qui reste à mesurer. */}
      {locked && <FreeReportCard result={result} diagnostic={diagnostic} />}

      {/* Diagnostic complet (onglets) */}
      <div>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">
            {t("sectionEyebrow")}
          </p>
          <h2 className="mt-1 text-xl font-bold sm:text-2xl">{t("sectionTitle")}</h2>
        </div>
        <ReportTabs
          result={result}
          diagnostic={diagnostic}
          locked={locked}
          analysisId={analysisId}
        />
      </div>

      {/* CTA */}
      <AnimatedCard className="text-center">
        <h3 className="text-xl font-bold">{td("ctaAnotherTitle")}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{td("ctaAnotherSubtitle")}</p>
        <div className="mx-auto mt-5 max-w-lg">
          <UrlAnalyzeForm size="md" />
        </div>
        <p className="mt-4 text-sm text-muted">
          {td("ctaUnlimited")}{" "}
          <Link href={ROUTES.pricing} className="cursor-pointer font-medium text-text underline decoration-pebble underline-offset-2 hover:decoration-obsidian">
            {tc("discoverOffers")}
          </Link>
        </p>
      </AnimatedCard>

      {/* Bandeau de fin de rapport : mène aux tarifs, pas à la prise de rendez-vous */}
      <UnlockPricingCta analysisId={analysisId} locked={locked} />
    </div>
  );
}
