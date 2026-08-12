import { getTranslations } from "next-intl/server";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { scoreLabel } from "@/lib/score";
import { AnimatedScoreRing } from "./AnimatedScoreRing";
import { SiteScreenshot } from "./SiteScreenshot";
import { ReportTabs } from "./ReportTabs";
import { FreeReportCard } from "./FreeReportCard";
import { PaidReportCard } from "./PaidReportCard";
import { UnlockPricingCta } from "./UnlockPricingCta";

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
          {/* L'anneau se resserre sur mobile : le titre, la ligne de méta et le
              verdict doivent tenir dans le cadre avec lui. */}
          <AnimatedScoreRing
            score={result.overallScore}
            sizeSm={124}
            label={scoreLabel(result.overallScore)}
            trackColor="rgba(255,255,255,0.18)"
            labelClassName="text-white/80"
          />
          <div>
            <h1 className="text-balance text-xl font-bold text-white sm:text-3xl">
              {result.businessName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[13px] text-white/80 sm:text-sm">
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
            <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-white/90 sm:text-base">
              {result.verdict}
            </p>
          </div>
        </SiteScreenshot>
      </div>

      {/* Constat écrit à la frappe. En aperçu : ce qui tient, ce qui manque, ce
          qui reste à mesurer. Rapport complet : ce que l'audit a relevé. */}
      {locked ? (
        <FreeReportCard result={result} diagnostic={diagnostic} />
      ) : (
        <PaidReportCard result={result} diagnostic={diagnostic} />
      )}

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

      {/* Bandeau de fin de rapport : mène aux tarifs, pas à la prise de rendez-vous */}
      <UnlockPricingCta analysisId={analysisId} locked={locked} />
    </div>
  );
}
