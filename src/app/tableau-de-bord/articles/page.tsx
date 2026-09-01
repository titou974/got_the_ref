import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import {
  getArticleQuota,
  getDashboardContext,
  getPublishPlan,
  listArticles,
} from "@/features/dashboard/queries";
import {
  formatPublishDate,
  formatPublishTime,
  nextPublishPass,
  publishDayGap,
} from "@/constants/publishing";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { ArticleAgenda } from "@/components/tableau-de-bord/ArticleAgenda";
import { ArticleMonth } from "@/components/tableau-de-bord/ArticleMonth";
import { PublishDock } from "@/components/tableau-de-bord/PublishDock";
import { PlanArticlesButton } from "@/components/tableau-de-bord/PlanArticlesButton";
import { ArticleQuotaBar } from "@/components/tableau-de-bord/ArticleQuotaBar";
import { BrandVoicePanel } from "@/components/tableau-de-bord/BrandVoicePanel";
import { SectionGate } from "@/components/tableau-de-bord/SectionGate";
import { canOpen } from "@/constants/access";

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
  const [context, articles, quota, plan] = await Promise.all([
    getDashboardContext(user.id),
    listArticles(user.id),
    getArticleQuota(user.id),
    getPublishPlan(user.id),
  ]);
  const t = await getTranslations("dashboard.articles");

  // Le moment annoncé au client est celui du départ, pas celui de la consigne :
  // la file ne tourne pas en continu, et une date de 14 h 20 part au passage
  // suivant. Le calcul se fait ici, une fois, dans le fuseau de publication —
  // le composant reçoit des chaînes déjà composées et ne peut pas en dériver
  // d'autres au premier rendu du navigateur.
  const now = new Date();
  const departure = plan.next ? nextPublishPass(plan.next.scheduledFor, now) : null;

  const upcoming = articles.filter((article) => article.status !== "published");
  const published = articles.filter((article) => article.status === "published");

  // La rédaction s'achète : avec le Coup de Boost pour une semaine, avec
  // l'abonnement pour la durée.
  //
  // Ce qui reste en clair, quel que soit le niveau, c'est le planning lui-même —
  // les sujets datés, les mêmes que l'accueil montre. Il n'y a rien à cacher
  // là-dedans : ce sont des titres, et les voir est justement ce qui donne
  // envie de les faire écrire. Le voile se resserre donc sur ce qui coûte un
  // appel au modèle — la demande de planning, le budget de rédaction, la voix
  // de marque — et les sujets, eux, mènent aux tarifs plutôt qu'à l'atelier.
  const locked = !canOpen(context.tier, "articles");

  return (
    <>
      <PageHeader title={t("pageTitle")} />

      {/* Le quai de départ ouvre la page : avant de choisir quoi écrire, le
          client veut savoir ce qui part et quand. Il ne s'affiche pas sur une
          offre qui n'ouvre pas la publication — il n'y aurait rien à y armer. */}
      {locked ? null : (
        <PublishDock
          next={
            plan.next && departure
              ? {
                  id: plan.next.id,
                  title: plan.next.title,
                  status: plan.next.status,
                  dateLabel: formatPublishDate(departure),
                  timeLabel: formatPublishTime(departure),
                  days: publishDayGap(departure, now),
                  iso: plan.next.scheduledFor.toISOString(),
                }
              : null
          }
          queued={plan.queued}
          blocked={plan.blocked}
          autoPublish={plan.autoPublish}
          linked={plan.linked}
          canPublish={plan.canPublish}
        />
      )}

      <SectionGate section="articles" locked={locked} compact>
        {/* La demande de planning est posée sur la page, pas dans l'en-tête :
            le temps que le modèle réponde, elle laisse place à l'attente
            annoncée. */}
        <PlanArticlesButton />

        <ArticleQuotaBar quota={quota} />
      </SectionGate>

        <ArticleMonth
          today={now.toISOString().slice(0, 10)}
          articles={articles.map((article) => ({
            id: article.id,
            title: article.title,
            status: article.status,
            scheduledFor: article.scheduledFor?.toISOString() ?? null,
          }))}
        />

        <ArticleAgenda articles={upcoming} />

        {published.length ? <ArticleAgenda articles={published} variant="published" /> : null}

      <SectionGate section="articles" locked={locked} compact>
        <BrandVoicePanel
          instructions={context.brandVoice?.instructions ?? ""}
          banned={context.brandVoice?.banned ?? []}
        />
      </SectionGate>
    </>
  );
}
