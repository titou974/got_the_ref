import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getDashboardContext, listArticles } from "@/features/dashboard/queries";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { ArticleAgenda } from "@/components/tableau-de-bord/ArticleAgenda";
import { ArticleMonth } from "@/components/tableau-de-bord/ArticleMonth";
import { PlanArticlesButton } from "@/components/tableau-de-bord/PlanArticlesButton";
import { BrandVoicePanel } from "@/components/tableau-de-bord/BrandVoicePanel";

export const maxDuration = 300;

/**
 * Articles : le planning complet et la voix de la marque.
 *
 * Les articles publiés restent dans la liste, en bas : c'est l'historique de ce
 * que les agents ont déposé, et le seul endroit où le client retrouve le lien
 * public de chacun.
 */
export default async function ArticlesPage() {
  const user = await requireUser();
  const [context, articles] = await Promise.all([
    getDashboardContext(user.id),
    listArticles(user.id),
  ]);
  const t = await getTranslations("dashboard.articles");

  const upcoming = articles.filter((article) => article.status !== "published");
  const published = articles.filter((article) => article.status === "published");

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
        subtitle={context.domain ? t("pageSubtitle", { domain: context.domain }) : null}
        actions={<PlanArticlesButton />}
      />

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
    </>
  );
}
