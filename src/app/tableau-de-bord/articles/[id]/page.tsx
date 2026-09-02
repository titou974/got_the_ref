import Link from "next/link";
import { notFound } from "next/navigation";
import { Newsreader } from "next/font/google";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { getArticle, getArticleQuota, getDashboardContext } from "@/features/dashboard/queries";
import { parseOutline } from "@/features/dashboard/outline";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { canOpen } from "@/constants/access";
import { ArticleWorkspace } from "@/components/tableau-de-bord/article/ArticleWorkspace";

export const maxDuration = 300;

/**
 * La serif du document. Elle ne sert qu'ici : le texte de l'article s'écrit
 * dans la forme où il sera lu une fois publié, pendant que le reste du tableau
 * de bord garde sa sans. Déclarée dans la page, elle n'est chargée que sur
 * cette route.
 */
const editorial = Newsreader({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [article, context, quota] = await Promise.all([
    getArticle(user.id, id),
    getDashboardContext(user.id),
    getArticleQuota(user.id),
  ]);
  if (!article) notFound();

  const t = await getTranslations("dashboard.article");

  return (
    <div className={`${editorial.variable} space-y-6`}>
      {/* Le titre et la porte de sortie. La date de départ n'est plus répétée
          ici : elle se lit — et se change — dans le sélecteur en tête de
          l'atelier, à trente pixels en dessous. */}
      <PageHeader
        title={article.title}
        actions={
          <Link
            href={ROUTES.dashboardArticles}
            className="inline-flex cursor-pointer items-center rounded-pill border border-graphite px-5 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist"
          >
            {t("back")}
          </Link>
        }
      />

      <div>
        <ArticleWorkspace
          article={{
            id: article.id,
            title: article.title,
            keyword: article.keyword,
            outline: parseOutline(article.outline),
            body: article.body,
            excerpt: article.excerpt,
            status: article.status,
            revisions: article.revisions,
            scheduledFor: article.scheduledFor?.toISOString() ?? null,
            externalUrl: article.externalUrl,
          }}
          canPublish={
            context.site?.status === "connected" && context.site.capabilities.includes("publish")
          }
          // Le sujet se lit à tous les niveaux — c'est ce que le calendrier de
          // l'accueil promet — mais l'écrire et le publier s'achètent : sur une
          // offre qui ne les ouvre pas, les boutons mènent aux tarifs.
          locked={!canOpen(context.tier, "articles")}
          quotaRemaining={quota.remaining}
          domain={context.domain}
          platform={context.analysis?.signals.stack?.name ?? null}
        />
      </div>
    </div>
  );
}
