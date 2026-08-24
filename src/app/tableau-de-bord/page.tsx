import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { getDashboardContext, listArticles } from "@/features/dashboard/queries";
import { fetchAiTraffic } from "@/features/dashboard/ga4";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { scoreLabel } from "@/lib/score";
import { connectorForStack } from "@/constants/site-platforms";
import { Card, CardTitle } from "@/components/tableau-de-bord/Card";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { Gauge } from "@/components/tableau-de-bord/Charts";
import { HomeStats } from "@/components/tableau-de-bord/HomeStats";
import { ConnectStrip } from "@/components/tableau-de-bord/ConnectStrip";
import { AiTrafficCard } from "@/components/tableau-de-bord/AiTrafficCard";
import { AiPositions } from "@/components/tableau-de-bord/AiPositions";
import { ArticleAgenda } from "@/components/tableau-de-bord/ArticleAgenda";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";

/** L'audit d'entrée peut durer plusieurs minutes sur un gros site. */
export const maxDuration = 300;

export default async function DashboardHomePage() {
  const user = await requireUser();
  const context = await getDashboardContext(user.id);
  const t = await getTranslations("dashboard.home");

  if (!context.analysis) return <PreparingAnalysis />;

  const analysis = context.analysis;
  const diagnostic = buildDiagnostic(analysis);
  const [traffic, articles] = await Promise.all([
    fetchAiTraffic(user.id, 30),
    listArticles(user.id),
  ]);

  const pendingFixes = [...diagnostic.architecture.checks, ...diagnostic.content.checks].filter(
    (check) => check.status === "ko" || check.status === "warn",
  ).length;

  const sessionsDelta =
    traffic && traffic.previousTotalSessions > 0
      ? ((traffic.totalSessions - traffic.previousTotalSessions) / traffic.previousTotalSessions) *
        100
      : null;

  const upcoming = articles.filter((article) => article.status !== "published");

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={context.domain ? t("subtitle", { domain: context.domain }) : null}
        actions={
          context.analysisId ? (
            <Link
              href={ROUTES.analysis(context.analysisId)}
              className="inline-flex cursor-pointer items-center rounded-pill border border-graphite px-5 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist"
            >
              {t("fullReport")}
            </Link>
          ) : null
        }
      />

      <ConnectStrip
        analyticsConnected={context.google.analytics}
        propertyName={context.google.propertyName}
        site={context.site}
        suggestedPlatform={connectorForStack(analysis.signals.stack?.id).id}
      />

      <HomeStats
        score={analysis.overallScore}
        scoreLabel={scoreLabel(analysis.overallScore)}
        sessions={traffic?.totalSessions ?? null}
        sessionsDelta={sessionsDelta}
        series={
          traffic?.series.map((point) => ({ date: point.date, value: point.sessions })) ?? []
        }
        pendingFixes={pendingFixes}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <AiTrafficCard report={traffic} />
          <AiPositions engines={analysis.engines} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle title={t("health")} />
            <Gauge
              value={analysis.overallScore}
              label={scoreLabel(analysis.overallScore)}
              caption={analysis.verdict}
            />
          </Card>

          <Card>
            <CardTitle title={t("priorities")} hint={t("prioritiesHint")} />
            <ul className="space-y-2.5">
              {analysis.recommendations.slice(0, 5).map((recommendation) => (
                <li key={recommendation.title} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      recommendation.priority === "critique"
                        ? "bg-danger"
                        : recommendation.priority === "haute"
                          ? "bg-warning"
                          : "bg-pebble"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{recommendation.title}</span>
                    <span className="block text-xs text-muted">{recommendation.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <ArticleAgenda articles={upcoming} limit={4} />
        </div>
      </div>
    </>
  );
}
