import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getDashboardContext } from "@/features/dashboard/queries";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { CATEGORY_META } from "@/lib/geo/types";
import { Card, CardTitle, PageHeader } from "@/components/tableau-de-bord/Card";
import { SolutionPrompt } from "@/components/tableau-de-bord/SolutionPrompt";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { AnimatedCard } from "@/components/dashboard/AnimatedCard";
import { AnimatedScoreRing } from "@/components/dashboard/AnimatedScoreRing";
import { CategoryRadar } from "@/components/dashboard/CategoryRadar";
import { DiagnosticGrid } from "@/components/geo/DiagnosticGrid";
import { CrawlerGrid, StackCard } from "@/components/geo/SiteProfile";

export const maxDuration = 300;

/**
 * Architecture : ce que le crawl a trouvé, contrôle par contrôle, plus l'état
 * des robots d'IA.
 *
 * L'écran reprend l'onglet Architecture du rapport d'analyse : même anneau,
 * même radar, mêmes contrôles, même carte de plateforme. Le client retrouve
 * donc à l'identique la page qu'il a lue en achetant, rejouée sur le dernier
 * passage — avec, en plus, ce que le crawl a compté.
 */
export default async function ArchitecturePage() {
  const user = await requireUser();
  const context = await getDashboardContext(user.id);
  const t = await getTranslations("dashboard.architecture");
  const ta = await getTranslations("analysisReport");

  if (!context.analysis) return <PreparingAnalysis />;

  const analysis = context.analysis;
  const diagnostic = buildDiagnostic(analysis);
  const crawl = analysis.signals.crawl;

  const radarData = analysis.categories
    .filter((c) => ["technical", "structuredData", "platform"].includes(c.key))
    .map((c) => ({ label: CATEGORY_META[c.key].short, score: c.score }));

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AnimatedCard className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left lg:col-span-2">
          <AnimatedScoreRing
            score={diagnostic.architecture.score}
            size={140}
            stroke={12}
            label={ta("architecture.scoreLabel")}
          />
          <div className="flex-1">
            <h2 className="text-lg font-bold">{ta("architecture.title")}</h2>
            <p className="mt-2 text-pretty text-sm text-muted">{ta("architecture.subtitle")}</p>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.05}>
          <h3 className="mb-2 font-semibold">{CATEGORY_META.technical.short}</h3>
          <CategoryRadar data={radarData} />
        </AnimatedCard>

        <AnimatedCard delay={0.1} className="lg:col-span-3">
          <DiagnosticGrid section={diagnostic.architecture} labelNs="architecture" />
        </AnimatedCard>

        <AnimatedCard delay={0.12} className="lg:col-span-3">
          <h3 className="mb-3 font-semibold">{ta("content.title")}</h3>
          <DiagnosticGrid section={diagnostic.content} labelNs="content" />
        </AnimatedCard>

        <StackCard stack={analysis.signals.stack ?? null} />

        <CrawlerGrid crawlers={analysis.signals.crawlers} />
      </div>

      <Card>
        <CardTitle title={t("crawl")} hint={t("crawlHint")} />
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label={t("pages")} value={String(crawl.pagesCrawled)} />
          <Metric label={t("words")} value={crawl.totalWordCount.toLocaleString("fr-FR")} />
          <Metric label={t("internalLinks")} value={String(crawl.internalLinks)} />
          <Metric
            label={t("schemas")}
            value={crawl.schemaTypes.length ? crawl.schemaTypes.join(", ") : t("noSchema")}
          />
        </dl>
      </Card>

      <SolutionPrompt tab="architecture" result={analysis} diagnostic={diagnostic} />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-steel">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
