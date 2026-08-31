import { getTranslations } from "next-intl/server";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { buildSolutionPrompt } from "@/lib/geo/solution-prompts";
import { scoreLabel } from "@/lib/score";
import { AnimatedScoreRing } from "./AnimatedScoreRing";
import { SiteScreenshot } from "./SiteScreenshot";
import { ReportTabs } from "./ReportTabs";
import { FreeReportCard } from "./FreeReportCard";
import { UrlAnalyzeForm } from "@/components/UrlAnalyzeForm";
import { DemoCta } from "@/components/DemoCta";
import { SolveAgentsBar } from "./SolveAgentsBar";
import { ROUTES } from "@/constants/routes";
import { PaidReportCard } from "./PaidReportCard";
import { UnlockPricingCta } from "./UnlockPricingCta";
import { AnimatedCard } from "./AnimatedCard";
import Link from "next/link";

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
  const tc = await getTranslations("common");
  const diagnostic = buildDiagnostic(result);

  const date = new Date(result.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Manques réellement relevés : la barre en annonce le nombre, la modale les
  // rejoue. Faute de manque, on montre les premiers contrôles d'architecture —
  // ce sont ceux que les agents tiennent à jour.
  const failing = [
    ...diagnostic.architecture.checks
      .filter((c) => c.status === "ko" || c.status === "warn")
      .map((c) => `architecture.checks.${c.key}`),
    ...diagnostic.content.checks
      .filter((c) => c.status === "ko" || c.status === "warn")
      .map((c) => `content.checks.${c.key}`),
  ];
  const issueKeys = (
    failing.length
      ? failing
      : diagnostic.architecture.checks.map((c) => `architecture.checks.${c.key}`)
  ).slice(0, 3);
  const issues = issueKeys.map((key) => t(key));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-5 py-8">
      {/* Hero : capture du site assombrie, avec la note globale centrée par-dessus */}
      <div className="mx-auto w-full max-w-3xl">
        <SiteScreenshot
          url={result.url}
          domain={result.domain}
          variant="site"
          stack={result.signals.stack ?? null}
        >
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
          <h2 className="mt-1 text-xl font-bold sm:text-2xl">
            {t("sectionTitle")}
          </h2>
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
        <h3 className="text-xl font-bold">{t("ctaAnotherTitle")}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {t("ctaAnotherSubtitle")}
        </p>
        <div className="mx-auto mt-5 max-w-lg">
          <UrlAnalyzeForm size="md" />
        </div>
        <p className="mt-4 text-sm text-muted">
          {t("ctaUnlimited")}{" "}
          <Link
            href={ROUTES.pricing}
            className="cursor-pointer font-medium text-text underline decoration-pebble underline-offset-2 hover:decoration-obsidian"
          >
            {tc("discoverOffers")}
          </Link>
        </p>
      </AnimatedCard>

      {/* CTA agence : redirige vers les services en bas de chaque rapport */}
      <DemoCta />
      {/* Bandeau de fin de rapport : mène aux tarifs, pas à la prise de rendez-vous */}
      <UnlockPricingCta analysisId={analysisId} locked={locked} />

      {/* Rapport ouvert : l'action suivante (faire corriger) reste accessible
          d'un bout à l'autre de la page. */}
      {!locked && (
        <>
        {/* La barre flotte au-dessus du bas de l'écran : cette réserve empêche
            qu'elle recouvre le dernier bloc du rapport une fois défilé. */}
        <div className="h-40 sm:h-24" aria-hidden />
        <SolveAgentsBar
          domain={result.domain}
          stack={result.signals.stack ?? null}
          issues={issues}
          // Le rapport est public : personne n'est identifié, donc rien à
          // rattacher ici. La modale sert le prompt de correction, et son bouton
          // de rattachement mène aux réglages du compte, par la connexion.
          solutionPrompt={buildSolutionPrompt("results", result, diagnostic)}
        />
        </>
      )}
    </div>
  );
}
