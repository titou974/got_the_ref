import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import {
  getDashboardContext,
  listArticles,
} from "@/features/dashboard/queries";
import { fetchAiTraffic } from "@/features/dashboard/ga4";
import { buildDemoAiTraffic } from "@/features/dashboard/demoTraffic";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { scoreLabel } from "@/lib/score";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { AiTrafficCard } from "@/components/tableau-de-bord/AiTrafficCard";
import { ArticleAgenda } from "@/components/tableau-de-bord/ArticleAgenda";
import { SolveAgentsDock } from "@/components/tableau-de-bord/SolveAgentsDock";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { RankingsSection } from "@/components/tableau-de-bord/RankingsSection";
import { SiteScreenshot } from "@/components/dashboard/SiteScreenshot";
import { AnimatedScoreRing } from "@/components/dashboard/AnimatedScoreRing";
import { PaidReportCard } from "@/components/dashboard/PaidReportCard";
import { Recommendations } from "@/components/geo/Recommendations";
import { TierGate } from "@/components/tableau-de-bord/TierGate";
import {
  FREE_RECOMMENDATION_LIMIT,
  analysisNeedsUpgrade,
  canSee,
  offerForBlock,
  seesRecommendation,
  tierAtLeast,
} from "@/constants/access";

/** L'audit d'entrée peut durer plusieurs minutes sur un gros site. */
export const maxDuration = 300;

/**
 * L'accueil du tableau de bord, dans l'ordre où le client se pose ses questions.
 *
 * En haut, ce qu'il vient vérifier : son site tel qu'on le voit, avec la note
 * posée dessus, et le constat écrit à la frappe juste en dessous. Les deux ne
 * se séparent pas : c'est le couple qu'il a découvert en achetant son analyse,
 * et le texte dit à voix haute ce que la note résume en un chiffre.
 *
 * Viennent ensuite les deux réponses qu'il est venu chercher — sa place dans
 * ChatGPT et Gemini, et ce qu'il faut corriger pour la gagner.
 *
 * En bas, ce qui court dans la durée : le trafic amené par les IA et le
 * calendrier de rédaction. Et l'exécution ne vit pas dans la page : elle tient
 * dans la barre fixe « résoudre avec les agents IA », à portée de pouce d'un
 * bout à l'autre.
 *
 * Le suivi des mentions dans les IA a été retiré de cet écran : le relevé
 * n'était vendu qu'à l'abonnement, coûtait un appel DataForSEO par visite, et
 * n'a pas trouvé son public. Le module reste en place dans le code
 * (`features/dashboard/llmMentions`), simplement plus appelé.
 */
export default async function DashboardHomePage() {
  const user = await requireUser();
  const context = await getDashboardContext(user.id);
  const t = await getTranslations("dashboard.home");
  const ta = await getTranslations("analysisReport");

  // Aucune analyse : c'est la première ouverture, l'écran d'attente la lance.
  //
  // Une analyse plus étroite que l'offre du compte : c'est un achat qui vient
  // d'avoir lieu. Le compte gratuit n'avait fait mesurer qu'un moteur et aucun
  // relevé hors-site ; le Coup de Boost et l'abonnement les ouvrent, et ces
  // appels-là doivent partir maintenant. On repasse donc par le même écran
  // d'attente que la mise en route — même barre, même animation : le client
  // reconnaît ce qu'il regarde, et il n'a rien à cliquer.
  if (!context.analysis || analysisNeedsUpgrade(context.analysis.accessTier, context.tier)) {
    return <PreparingAnalysis tier={context.tier} />;
  }

  const analysis = context.analysis;
  const diagnostic = buildDiagnostic(analysis);

  // L'accueil est le seul écran ouvert à tous : le verrou s'y pose bloc par
  // bloc plutôt que sur la page entière. Reste en clair ce qui montre le
  // produit sans le donner — le site, sa note, la niche détectée, le constat
  // écrit. Le reste garde sa forme sous un voile, avec l'offre qui l'ouvre.
  const tier = context.tier;
  const sees = (block: Parameters<typeof canSee>[1]) => canSee(tier, block);

  // Sous le voile, on montre une carte d'exemple, jamais la vraie donnée : le
  // seul relevé qui coûte un appel ici — Analytics — n'est donc lancé que pour
  // qui le verra. La carte sait déjà quoi faire d'un rapport absent : elle
  // bascule sur sa version de démonstration.
  //
  // Les articles, eux, sont relus pour tout le monde : le calendrier est ouvert
  // à tous les niveaux, et c'est une lecture en base, pas un appel de modèle.
  const [traffic, articles] = await Promise.all([
    sees("traffic") ? fetchAiTraffic(user.id, 30) : null,
    listArticles(user.id),
  ]);

  const upcoming = articles.filter((article) => article.status !== "published");

  // Le plan d'action se coupe en deux sur un compte gratuit : les correctifs de
  // contenu se lisent — l'onglet qui les exécute est ouvert —, les autres
  // gardent leur forme sous voile. Les premiers sont bornés : quelques cartes
  // démontrent, la liste entière remplacerait l'offre.
  const openRecommendations = analysis.recommendations
    .filter((r) => seesRecommendation(tier, r.category))
    .slice(0, sees("recommendations") ? undefined : FREE_RECOMMENDATION_LIMIT);
  const lockedRecommendations = analysis.recommendations.filter(
    (r) => !openRecommendations.includes(r),
  );

  const date = new Date(analysis.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader />

      {/* 1. La fenêtre du site, assombrie, avec la note posée dessus. */}
      <SiteScreenshot
        url={analysis.url}
        domain={analysis.domain}
        variant="site"
        stack={analysis.signals.stack ?? null}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
          {ta("heroEyebrow")}
        </p>
        <AnimatedScoreRing
          score={analysis.overallScore}
          sizeSm={124}
          label={scoreLabel(analysis.overallScore)}
          trackColor="rgba(255,255,255,0.18)"
          labelClassName="text-white/80"
        />
        <div>
          <h2 className="text-balance text-xl font-bold text-white sm:text-3xl">
            {analysis.businessName}
          </h2>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[13px] text-white/80 sm:text-sm">
            <a
              href={analysis.url}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer font-medium text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
            >
              {analysis.domain}
            </a>
            <span aria-hidden>·</span>
            <span>{analysis.profile.niche}</span>
            <span aria-hidden>·</span>
            <span>{date}</span>
          </div>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-white/90 sm:text-base">
            {analysis.verdict}
          </p>
        </div>
      </SiteScreenshot>

      {/* 2. Le constat écrit à la frappe, collé à la capture : le client vient
             de voir son site et sa note, il lit dans la foulée ce qu'on a
             relevé chez lui. Il n'est jamais voilé. En gratuit, il ne rend
             compte que de ce qui est ouvert — le contenu, le classement Gemini
             — et annonce le reste sans le détailler. */}
      <PaidReportCard
        result={analysis}
        diagnostic={diagnostic}
        scope={tierAtLeast(tier, "boost") ? "dashboard" : "free"}
      />

      {/* 3. La place du commerce dans ChatGPT et Gemini. C'est la question qui
             amène le client ici. Le voile y est posé moteur par moteur : un
             compte gratuit fait mesurer Gemini, et voit la carte ChatGPT sous
             voile — faute d'avoir été exécutée. */}
      <RankingsSection engines={analysis.engines} tier={tier} />

      {/* 4. Les corrections, dans la foulée du classement : le client vient de
             lire sa place, il doit lire tout de suite ce qui la lui coûte. */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold">{t("priorities")}</h2>
          <p className="text-sm text-muted">{t("prioritiesHint")}</p>
        </div>
        {/* En clair, les correctifs de contenu ; sous voile, tout le reste. Les
            deux listes se suivent sans rupture : le client lit trois cartes,
            puis voit la forme de celles qu'il n'a pas encore. */}
        <div className="space-y-4">
          {openRecommendations.length > 0 && (
            <Recommendations
              recommendations={openRecommendations}
              emptyLabel={ta("results.noRecommendations")}
            />
          )}
          {lockedRecommendations.length > 0 && (
            <Block block="recommendations" open={sees("recommendations")}>
              <Recommendations
                recommendations={lockedRecommendations}
                emptyLabel={ta("results.noRecommendations")}
              />
            </Block>
          )}
          {openRecommendations.length === 0 && lockedRecommendations.length === 0 && (
            <Recommendations
              recommendations={[]}
              emptyLabel={ta("results.noRecommendations")}
            />
          )}
        </div>
      </section>

      {/* ---- Ce qui court dans la durée ---- */}

      {/* 5. La courbe du trafic amené par les IA — d'exemple tant qu'Analytics
             n'est pas rattaché. Les dates sont lues ici, côté serveur, pour que
             le navigateur reçoive le même axe que le rendu initial. */}
      <Block block="traffic" open={sees("traffic")}>
        <AiTrafficCard
          report={traffic}
          demo={buildDemoAiTraffic()}
          domain={context.domain ?? analysis.domain}
        />
      </Block>

      {/* 6. Le calendrier de rédaction, en clair à tous les niveaux. Un compte
             gratuit y lit les premiers sujets de sa semaine, datés : c'est la
             pièce du produit qui se montre mieux qu'elle ne se raconte. Ce qu'il
             ne peut pas faire, c'est publier — l'onglet Articles s'achète, et
             les liens mènent alors aux tarifs. */}
      <ArticleAgenda articles={upcoming} limit={4} locked={!tierAtLeast(tier, "boost")} />

      {/* Tant que le rattachement du site n'est pas ouvert, le prompt est la
          voie d'exécution. Il ne vit plus au bas de la page : la barre fixe le
          porte, et il couvre désormais les six sections d'un coup — le client
          n'a plus à passer d'onglet en onglet pour ramasser ses correctifs. */}
      {/* La barre est là pour tout le monde : c'est le geste que le produit
          vend, et une page qui ne le montre pas ne le vend pas. Sur un compte
          gratuit elle s'ouvre sur la console des agents — les manques relevés
          chez lui, corrigés ligne à ligne — puis le voile prend le relais :
          ni rattachement du site, ni prompt de correction tant que la passe
          n'est pas prise. Le prompt n'est alors même pas écrit côté serveur :
          ce qui n'arrive pas au navigateur ne se copie pas. */}
      <SolveAgentsDock
        locked={!tierAtLeast(tier, "boost")}
        result={analysis}
        diagnostic={diagnostic}
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
    </>
  );
}

/**
 * Un bloc de l'accueil, en clair ou sous voile.
 *
 * Le contenu est écrit une seule fois : c'est le même balisage qui se montre et
 * qui se cache, sinon le voile finirait par promettre autre chose que ce qu'il
 * y a dessous.
 */
function Block({
  block,
  open,
  children,
}: {
  block: Parameters<typeof offerForBlock>[0];
  open: boolean;
  children: React.ReactNode;
}) {
  if (open) return <>{children}</>;
  return (
    <TierGate offer={offerForBlock(block)} item={block}>
      {children}
    </TierGate>
  );
}
