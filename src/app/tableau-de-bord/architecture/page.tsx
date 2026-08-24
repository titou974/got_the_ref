import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getDashboardContext } from "@/features/dashboard/queries";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { buildSolutionPrompt } from "@/lib/geo/solution-prompts";
import { connectorForStack } from "@/constants/site-platforms";
import { Card, CardTitle, PageHeader, StatusDot } from "@/components/tableau-de-bord/Card";
import { ChecksList } from "@/components/tableau-de-bord/ChecksList";
import { ConnectStrip } from "@/components/tableau-de-bord/ConnectStrip";
import { PromptCard } from "@/components/tableau-de-bord/PromptCard";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";

export const maxDuration = 300;

/**
 * Architecture : ce que le crawl a trouvé, contrôle par contrôle, plus l'état
 * des robots d'IA. La liste est celle du rapport, rejouée sur le dernier passage.
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

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
        subtitle={context.domain ? t("pageSubtitle", { domain: context.domain }) : null}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChecksList
          section={diagnostic.architecture}
          namespace="architecture"
          title={ta("architecture.title")}
          hint={ta("architecture.subtitle")}
        />
        <ChecksList
          section={diagnostic.content}
          namespace="content"
          title={ta("content.title")}
          hint={ta("content.subtitle")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle title={t("crawlers")} hint={t("crawlersHint")} />
          <ul className="divide-y divide-border">
            {analysis.signals.crawlers.map((crawler) => (
              <li key={crawler.name} className="flex items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <StatusDot status={crawler.allowed ? "ok" : "ko"} />
                  <span className="truncate text-sm">{crawler.name}</span>
                </span>
                <span className="shrink-0 text-sm text-muted">
                  {crawler.allowed ? t("allowed") : t("blocked")}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle title={t("crawl")} hint={t("crawlHint")} />
          <dl className="grid grid-cols-2 gap-4">
            <Metric label={t("pages")} value={String(crawl.pagesCrawled)} />
            <Metric label={t("words")} value={crawl.totalWordCount.toLocaleString("fr-FR")} />
            <Metric label={t("internalLinks")} value={String(crawl.internalLinks)} />
            <Metric
              label={t("schemas")}
              value={crawl.schemaTypes.length ? crawl.schemaTypes.join(", ") : t("noSchema")}
            />
          </dl>

          {analysis.signals.stack ? (
            <p className="mt-4 border-t border-border pt-4 text-sm text-muted">
              {t("stack", {
                name: analysis.signals.stack.name,
                evidence: analysis.signals.stack.evidence,
              })}
            </p>
          ) : null}
        </Card>
      </div>

      <ConnectStrip
        analyticsConnected={context.google.analytics}
        propertyName={context.google.propertyName}
        site={context.site}
        suggestedPlatform={connectorForStack(analysis.signals.stack?.id).id}
      />

      <PromptCard prompt={buildSolutionPrompt("architecture", analysis, diagnostic)} />
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
