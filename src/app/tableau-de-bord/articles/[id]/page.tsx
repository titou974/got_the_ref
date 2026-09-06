import { notFound } from "next/navigation";
import { Newsreader } from "next/font/google";
import { requireUser } from "@/lib/auth";
import { getArticle, getArticleQuota, getDashboardContext } from "@/features/dashboard/queries";
import { parseOutline } from "@/features/dashboard/outline";
import { canDraftArticle, isQueuedForDrafting } from "@/features/dashboard/upcoming-drafts";
import { connectSetupFor } from "@/features/dashboard/connect-setup";
import { canOpen, tierAtLeast } from "@/constants/access";
import { formatPublishDate, formatPublishTime } from "@/constants/publishing";
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

/**
 * L'atelier prend l'écran entier.
 *
 * La page ne pose plus ni bandeau de titre ni bouton de retour : l'atelier se
 * déploie par-dessus la coque du tableau de bord, et porte lui-même sa barre —
 * la sortie à gauche, le jour de départ au centre. Un en-tête de page au-dessus
 * aurait répété le titre de l'article à trente pixels du titre de l'article.
 */
export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [article, context, quota] = await Promise.all([
    getArticle(user.id, id),
    getDashboardContext(user.id),
    getArticleQuota(user.id),
  ]);
  if (!article) notFound();

  // Cet article-là est-il dans la file qui écrit les deux semaines à venir ?
  // La question porte sur son état et sa date : elle ne se pose qu'une fois
  // l'article lu.
  const [queued, draftable] = await Promise.all([
    isQueuedForDrafting(user.id, article),
    canDraftArticle(user.id, article.id),
  ]);

  return (
    <div className={editorial.variable}>
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
        // Rattaché ou non : sans site, le bouton mène au rattachement plutôt
        // que de composer un texte à déposer sur une porte qui n'existe pas.
        linked={Boolean(context.site)}
        // De quoi rattacher le site sans quitter l'atelier : il monte sa propre
        // modale, la barre des agents n'étant pas là pour la porter.
        connect={connectSetupFor(context, context.analysis?.signals.stack?.id)}
        // Le sujet se lit à tous les niveaux — c'est ce que le calendrier de
        // l'accueil promet — mais l'écrire et le publier s'achètent : sur une
        // offre qui ne les ouvre pas, les boutons mènent aux tarifs.
        locked={!canOpen(context.tier, "articles")}
        // Le Coup de Boost au-delà de sa semaine : le sujet, son mot-clé et son
        // plan restent lisibles, mais la rédaction ne s'ouvre pas ici. Un texte
        // déjà écrit ne retombe jamais sous ce voile — c'est du travail rendu.
        beyondPlan={!draftable && !article.body.trim()}
        quotaRemaining={quota.remaining}
        // Mise en forme ici : l'atelier est rendu chez le client, et son fuseau
        // ferait diverger le premier rendu de l'hydratation.
        quotaRenewsAt={
          quota.renewsAt
            ? `${formatPublishDate(quota.renewsAt)} à ${formatPublishTime(quota.renewsAt)}`
            : null
        }
        domain={context.domain}
        platform={context.analysis?.signals.stack?.name ?? null}
        // Le ton relevé sur le site du client, au pied du rail : c'est la voix
        // sous laquelle l'article a été écrit, et celle sous laquelle on le
        // relit. Réservé aux offres qui font écrire — démo, abonnement, Coup de
        // Boost : ce sont les seules où le relevé est lancé (cf.
        // `ensureBrandIdentity`), et une carte vide sur un compte gratuit ne
        // ferait que nommer un manque qu'on ne lui a pas vendu.
        tone={tierAtLeast(context.tier, "boost") ? context.tone : null}
        voice={context.brandVoice}
        // Son tour vient : l'atelier montre la rédaction en cours plutôt qu'une
        // feuille blanche sans explication.
        autoWriting={queued}
      />
    </div>
  );
}
