import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getDashboardContext, listArticles, listProspects } from "@/features/dashboard/queries";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { Card, CardTitle, PageHeader } from "@/components/tableau-de-bord/Card";
import { ProspectTable } from "@/components/tableau-de-bord/ProspectTable";
import { SolutionPrompt } from "@/components/tableau-de-bord/SolutionPrompt";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { ArticleMonth } from "@/components/tableau-de-bord/ArticleMonth";

export const maxDuration = 300;

/**
 * Présence web : ce que le web dit déjà du commerce, et à qui écrire pour qu'il
 * en dise davantage.
 *
 * Le calendrier éditorial est posé au milieu, entre la réputation constatée et
 * les sites à démarcher. C'est sa place : publier est justement le moyen par
 * lequel cette notoriété grandit, et le client voit d'un écran ce qui est dit
 * de lui aujourd'hui et ce qui va être publié demain.
 */
export default async function PresencePage() {
  const user = await requireUser();
  const [context, prospects, articles] = await Promise.all([
    getDashboardContext(user.id),
    listProspects(user.id),
    listArticles(user.id),
  ]);
  const t = await getTranslations("dashboard.presence");

  if (!context.analysis) return <PreparingAnalysis />;

  const analysis = context.analysis;
  const diagnostic = buildDiagnostic(analysis);
  const presence = analysis.webPresence;
  const backlinks = analysis.backlinks ?? null;

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
        subtitle={context.domain ? t("pageSubtitle", { domain: context.domain }) : null}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle title={t("reputation")} hint={presence.summary} />
          {presence.qualifications.length === 0 && presence.articles.length === 0 ? (
            <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">
              {t("noMentions")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {presence.qualifications.map((qualification) => (
                <li key={qualification.label} className="py-3">
                  <p className="text-sm font-medium">{qualification.label}</p>
                  <p className="text-xs text-muted">
                    {qualification.source} · {qualification.detail}
                  </p>
                </li>
              ))}
              {presence.articles.map((article) => (
                <li key={article.title} className="py-3">
                  <p className="text-sm font-medium">{article.title}</p>
                  <p className="text-xs text-muted">{article.source}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle
            title={t("backlinks")}
            hint={backlinks?.summary ?? t("backlinksUnknown")}
            action={
              backlinks?.estimatedCount !== null && backlinks?.estimatedCount !== undefined ? (
                <span className="rounded-xl bg-mist px-3 py-1 text-sm font-semibold tabular-nums">
                  {backlinks.estimatedCount}
                </span>
              ) : undefined
            }
          />
          {backlinks?.notableSources.length ? (
            <ul className="divide-y divide-border">
              {backlinks.notableSources.map((source) => (
                <li key={source.domain} className="py-3">
                  <p className="text-sm font-medium">{source.domain}</p>
                  <p className="text-xs text-muted">{source.note}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">
              {t("noBacklinks")}
            </p>
          )}
        </Card>
      </div>

      <ArticleMonth
        articles={articles.map((article) => ({
          id: article.id,
          title: article.title,
          status: article.status,
          scheduledFor: article.scheduledFor,
        }))}
      />

      <ProspectTable
        prospects={prospects.map((prospect) => ({
          id: prospect.id,
          name: prospect.name,
          domain: prospect.domain,
          reason: prospect.reason,
          contactEmail: prospect.contactEmail,
          contactUrl: prospect.contactUrl,
          authority: prospect.authority,
          status: prospect.status,
          message: prospect.message,
        }))}
      />

      <SolutionPrompt tab="presence" result={analysis} diagnostic={diagnostic} />
    </>
  );
}
