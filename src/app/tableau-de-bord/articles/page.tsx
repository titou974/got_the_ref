import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import {
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
import { ArticleMonth } from "@/components/tableau-de-bord/ArticleMonth";
import { PublishDock } from "@/components/tableau-de-bord/PublishDock";
import { PlanArticlesButton } from "@/components/tableau-de-bord/PlanArticlesButton";
import { ArticlesIntroModal } from "@/components/tableau-de-bord/ArticlesIntroModal";
import { canOpen } from "@/constants/access";

export const maxDuration = 300;

/**
 * Articles : ce qui part, ce qu'on attend de vous, et le calendrier.
 *
 * L'écran en montrait sept fois plus — quai de départ armé de trois boutons,
 * demande de planning, budget de rédaction, liste des prochains articles, liste
 * des publiés, voix de la marque, et le calendrier au milieu de tout ça. Les
 * trois quarts répétaient le calendrier sous une autre forme, et le client
 * devait choisir entre quatre représentations du même planning avant de savoir
 * ce qu'on attendait de lui.
 *
 * Il en reste deux blocs. Le bandeau répond aux deux questions qu'on se pose en
 * arrivant : qu'est-ce qui part ensuite, et combien d'articles attendent ma
 * validation. Le calendrier montre le reste — c'est lui la vue du planning, et
 * il n'y en a plus d'autre.
 *
 * Ce qui est parti ailleurs n'est pas perdu : les décisions de publication se
 * prennent dans l'article, barre du bas ; la voix de la marque et le pilote
 * automatique se règlent une fois pour toutes dans les réglages ; le budget de
 * rédaction s'affiche sous le bouton qui le consomme, dans l'atelier.
 */
export default async function ArticlesPage() {
  const user = await requireUser();
  const [context, articles, plan] = await Promise.all([
    getDashboardContext(user.id),
    listArticles(user.id),
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

  // La rédaction s'achète : avec le Coup de Boost pour une semaine, avec
  // l'abonnement pour la durée. Ce qui reste en clair, quel que soit le niveau,
  // c'est le planning lui-même — les sujets datés, les mêmes que l'accueil
  // montre. Il n'y a rien à cacher là-dedans : ce sont des titres, et les voir
  // est justement ce qui donne envie de les faire écrire.
  const locked = !canOpen(context.tier, "articles");

  return (
    <>
      <PageHeader title={t("pageTitle")} />

      {/* La marche à suivre, une seule fois, pour les offres qui ouvrent la
          rédaction. Un compte gratuit n'a ni site à rattacher ni article à
          valider : la chaîne ne lui servirait qu'à vendre. */}
      {locked ? null : <ArticlesIntroModal />}

      {/* Le quai de départ. Il ne s'affiche pas sur une offre qui n'ouvre pas la
          publication — il n'y aurait rien à y annoncer. */}
      {locked ? null : (
        <PublishDock
          next={
            plan.next && departure
              ? {
                  id: plan.next.id,
                  title: plan.next.title,
                  dateLabel: formatPublishDate(departure),
                  timeLabel: formatPublishTime(departure),
                  days: publishDayGap(departure, now),
                }
              : null
          }
          toApprove={plan.toApprove}
          firstToApprove={plan.firstToApprove}
          blocked={plan.blocked}
          linked={plan.linked}
          canPublish={plan.canPublish}
        />
      )}

      {/* La demande de sujets est posée dans l'en-tête du calendrier : c'est le
          calendrier qu'elle remplit, et une carte à part au-dessus obligeait à
          la lire avant d'arriver au planning. */}
      <ArticleMonth
        today={now.toISOString().slice(0, 10)}
        locked={locked}
        action={locked ? null : <PlanArticlesButton />}
        articles={articles.map((article) => ({
          id: article.id,
          title: article.title,
          status: article.status,
          scheduledFor: article.scheduledFor?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
