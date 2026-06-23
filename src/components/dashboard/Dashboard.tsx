import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { scoreLabel } from "@/lib/score";
import { AnimatedScoreRing } from "./AnimatedScoreRing";
import { AnimatedCard } from "./AnimatedCard";
import { ReportTabs } from "./ReportTabs";
import { AiVisibilityComparison } from "./AiVisibilityComparison";
import { UrlAnalyzeForm } from "@/components/UrlAnalyzeForm";
import { ServicesCta } from "@/components/ServicesCta";
import { ROUTES } from "@/constants/routes";

export async function Dashboard({ result }: { result: GeoAnalysisResult }) {
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
      {/* Note principale + bilan général court */}
      <AnimatedCard className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
        <AnimatedScoreRing score={result.overallScore} label={scoreLabel(result.overallScore)} />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {t("heroEyebrow")}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{result.businessName}</h1>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted sm:justify-start">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-accent hover:underline"
            >
              {result.domain}
            </a>
            <span aria-hidden>·</span>
            <span>{result.businessType}</span>
            <span aria-hidden>·</span>
            <span>{date}</span>
          </div>
          <p className="mt-3 text-pretty text-base text-text">{result.verdict}</p>
        </div>
      </AnimatedCard>

      {/* Diagnostic complet (onglets) */}
      <div>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {t("sectionEyebrow")}
          </p>
          <h2 className="mt-1 text-xl font-bold sm:text-2xl">{t("sectionTitle")}</h2>
        </div>
        <ReportTabs result={result} diagnostic={diagnostic} />
      </div>

      {/* Comparatif des vues IA estimées par moteur */}
      {result.aiVisibility && (
        <div>
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              {t("visibilityEyebrow")}
            </p>
            <h2 className="mt-1 text-xl font-bold sm:text-2xl">{t("visibilityTitle")}</h2>
          </div>
          <AiVisibilityComparison data={result.aiVisibility} />
        </div>
      )}

      {/* CTA */}
      <AnimatedCard className="text-center">
        <h3 className="text-xl font-bold">{td("ctaAnotherTitle")}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{td("ctaAnotherSubtitle")}</p>
        <div className="mx-auto mt-5 max-w-lg">
          <UrlAnalyzeForm size="md" />
        </div>
        <p className="mt-4 text-sm text-muted">
          {td("ctaUnlimited")}{" "}
          <Link href={ROUTES.pricing} className="cursor-pointer text-accent hover:underline">
            {tc("discoverOffers")}
          </Link>
        </p>
      </AnimatedCard>

      {/* CTA agence : redirige vers les services en bas de chaque rapport */}
      <ServicesCta />
    </div>
  );
}
