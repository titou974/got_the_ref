import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getArticleQuota, getDashboardContext, listArticles } from "@/features/dashboard/queries";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { ArticleAgenda } from "@/components/tableau-de-bord/ArticleAgenda";
import { ArticleMonth } from "@/components/tableau-de-bord/ArticleMonth";
import { PlanArticlesButton } from "@/components/tableau-de-bord/PlanArticlesButton";
import { ArticleQuotaBar } from "@/components/tableau-de-bord/ArticleQuotaBar";
import { BrandVoicePanel } from "@/components/tableau-de-bord/BrandVoicePanel";
import { SolutionPrompt } from "@/components/tableau-de-bord/SolutionPrompt";
import { buildDiagnostic } from "@/lib/geo/diagnostic";

export const maxDuration = 300;

/**
 * Articles : le planning complet et la voix de la marque.
 *
 * Les articles publiés restent dans la liste, en bas : c'est l'historique de ce
 * que les agents ont déposé, et le seul endroit où le client retrouve le lien
 * public de chacun.
 *
 * Le prompt de publication ferme l'écran. C'est le seul de l'application qui
 * embarque du contenu long : les articles rédigés y partent en entier, pour que
 * le client — ou son développeur — colle une fois et publie, sans revenir
 * chercher le texte article par article.
 */
export default async function ArticlesPage() {
  const user = await requireUser();
  const [context, articles, quota] = await Promise.all([
    getDashboardContext(user.id),
    listArticles(user.id),
    getArticleQuota(user.id),
  ]);
  const t = await getTranslations("dashboard.articles");

  const upcoming = articles.filter((article) => article.status !== "published");
  const published = articles.filter((article) => article.status === "published");

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
      />

      {/* La demande de planning est posée sur la page, pas dans l'en-tête : le
          temps que le modèle réponde, elle laisse place à l'attente annoncée. */}
      <PlanArticlesButton />

      <ArticleQuotaBar quota={quota} />

      <ArticleMonth
        articles={articles.map((article) => ({
          id: article.id,
          title: article.title,
          status: article.status,
          scheduledFor: article.scheduledFor,
        }))}
      />

      <ArticleAgenda articles={upcoming} />

      {published.length ? <ArticleAgenda articles={published} variant="published" /> : null}

      <BrandVoicePanel
        instructions={context.brandVoice?.instructions ?? ""}
        banned={context.brandVoice?.banned ?? []}
      />

      {context.analysis ? (
        <SolutionPrompt
          tab="articles"
          result={context.analysis}
          diagnostic={buildDiagnostic(context.analysis)}
          articles={articles.map((article) => ({
            title: article.title,
            keyword: article.keyword,
            status: article.status,
            scheduledFor: article.scheduledFor,
            excerpt: article.excerpt,
            outline: article.outline,
            body: article.body,
          }))}
        />
      ) : null}
    </>
  );
}
