import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import {
  getDashboardContext,
  listArticles,
} from "@/features/dashboard/queries";
import { fetchAiTraffic } from "@/features/dashboard/ga4";
import { buildDemoAiTraffic } from "@/features/dashboard/demoTraffic";
import { buildDiagnostic, type AnalysisDiagnostic } from "@/lib/geo/diagnostic";
import { scoreLabel } from "@/lib/score";
import type { Recommendation } from "@/lib/geo/types";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { AiTrafficCard } from "@/components/tableau-de-bord/AiTrafficCard";
import { ArticleMonth } from "@/components/tableau-de-bord/ArticleMonth";
import { DashboardNotices } from "@/components/tableau-de-bord/DashboardNotices";
import { NicheBand } from "@/components/tableau-de-bord/NicheBand";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { RankingsSection } from "@/components/tableau-de-bord/RankingsSection";
import { SiteScreenshot } from "@/components/dashboard/SiteScreenshot";
import { AnimatedScoreRing } from "@/components/dashboard/AnimatedScoreRing";
import { PaidReportCard } from "@/components/dashboard/PaidReportCard";
import { Recommendations } from "@/components/geo/Recommendations";
import { GatePanel, TierGate } from "@/components/tableau-de-bord/TierGate";
import {
  FREE_RECOMMENDATION_LIMIT,
  PENDING_FIXES_RANGE,
  VEILED_RECOMMENDATION_PREVIEW,
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
 * calendrier de rédaction, posé sur sa grille de jours. Et l'exécution ne vit
 * pas dans la page : elle tient dans la barre fixe « résoudre avec les agents
 * IA », à portée de pouce d'un bout à l'autre.
 *
 * Ce qu'une offre n'ouvre pas encore garde sa carte entière et lisible : seuls
 * les chiffres et les tracés sont retenus — « X visites », « #X », une courbe
 * floutée — et l'appel descend en pied de carte (cf. `TierGate` en mode
 * `reveal`). Le client voit la forme exacte de ce qu'il achète, sans en lire
 * une valeur.
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

  // Sous voile, deux cartes suffisent. Une liste de quinze correctifs floutés
  // faisait défiler un écran entier de gris avant d'arriver à l'appel : le
  // client n'y lisait rien de plus qu'en deux cartes, et l'offre arrivait trop
  // tard. Les deux montrées sont les plus urgentes ; le compte total, lui, est
  // écrit sur la barre.
  const veiledRecommendations = [...lockedRecommendations]
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, VEILED_RECOMMENDATION_PREVIEW);

  const pendingFixes = countPendingFixes(diagnostic, lockedRecommendations.length);

  const date = new Date(analysis.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      {/* Ce qui se dit avant la première carte, et seulement sur téléphone : le
          relevé du jour, et l'écran où le produit se lit le mieux. */}
      <DashboardNotices tier={tier} />

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

      {/* 3. Sur quoi et où nous l'avons interrogé. Les classements qui suivent
             ne veulent rien dire sans ces deux mots-là : c'est la requête
             elle-même, écrite en clair juste avant son résultat. */}
      <NicheBand
        niche={context.niche ?? analysis.profile.niche ?? null}
        location={analysis.profile.location ?? context.cities[0] ?? null}
        isPhysical={context.isPhysical && analysis.profile.isPhysical}
        query={analysis.liveQuery ?? null}
      />

      {/* 4. La place du commerce dans ChatGPT et Gemini. C'est la question qui
             amène le client ici. Le voile y est posé moteur par moteur : un
             compte gratuit fait mesurer Gemini, et voit la carte ChatGPT sous
             voile — faute d'avoir été exécutée. */}
      <RankingsSection engines={analysis.engines} tier={tier} />

      {/* 5. Les corrections, dans la foulée du classement : le client vient de
             lire sa place, il doit lire tout de suite ce qui la lui coûte. */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold">{t("priorities")}</h2>
          <p className="text-sm text-muted">{t("prioritiesHint")}</p>
        </div>
        {/* En clair, les correctifs que l'offre ouvre ; sous voile, deux cartes
            et le compte de ce qui reste. Les deux listes se suivent sans
            rupture : le client lit ce qu'il peut appliquer aujourd'hui, puis
            voit la forme de ce qui l'attend et combien il en reste. */}
        <div className="space-y-4">
          {openRecommendations.length > 0 && (
            <Recommendations
              recommendations={openRecommendations}
              emptyLabel={ta("results.noRecommendations")}
            />
          )}
          {veiledRecommendations.length > 0 && (
            <TierGate
              offer={offerForBlock("recommendations")}
              item="recommendations"
              reveal
              values={{ count: pendingFixes }}
            >
              <Recommendations
                recommendations={veiledRecommendations}
                emptyLabel={ta("results.noRecommendations")}
                veiled
              />
            </TierGate>
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

      {/* 6. La courbe du trafic amené par les IA — d'exemple tant qu'Analytics
             n'est pas rattaché. Les dates sont lues ici, côté serveur, pour que
             le navigateur reçoive le même axe que le rendu initial. */}
      <AiTrafficCard
        report={traffic}
        demo={buildDemoAiTraffic()}
        domain={context.domain ?? analysis.domain}
        veiled={!sees("traffic")}
        overlay={
          sees("traffic") ? undefined : (
            <GatePanel offer={offerForBlock("traffic")} item="traffic" />
          )
        }
      />

      {/* 7. Le calendrier de rédaction, en clair à tous les niveaux. Sur grand
             écran, le mois entier sur sa grille de jours — vingt-deux
             publications alignées du lundi au vendredi disent le rythme d'un
             coup d'œil, là où quatre lignes ressemblaient à une liste de
             tâches — et les flèches font défiler les mois. Sur téléphone, la
             grille cède la place aux sept jours qui viennent, un par ligne,
             avec le sujet écrit en toutes lettres. Ce que le client ne peut pas
             faire, c'est publier — l'onglet Articles s'achète, et les sujets
             mènent alors aux tarifs.

             La journée en cours est lue ici, côté serveur : elle sert de
             repère au rail du téléphone, et un `new Date()` appelé dans le
             navigateur ferait diverger le premier rendu de l'hydratation. */}
      <ArticleMonth
        today={new Date().toISOString().slice(0, 10)}
        articles={articles.map((article) => ({
          id: article.id,
          title: article.title,
          status: article.status,
          scheduledFor: article.scheduledFor?.toISOString() ?? null,
        }))}
        locked={!tierAtLeast(tier, "boost")}
      />
    </>
  );
}

/** L'ordre d'urgence des correctifs, pour ne montrer que les plus pressants. */
const PRIORITY_RANK: Record<Recommendation["priority"], number> = {
  critique: 0,
  haute: 1,
  moyenne: 2,
  basse: 3,
};

/**
 * Combien de corrections séparent ce site du haut des réponses IA.
 *
 * Le compte est réel : chaque contrôle raté du diagnostic — structure et
 * contenu — est une correction à faire, et chaque correctif encore fermé en est
 * une autre. C'est le seul chiffre du voile qui reste en clair, et il ne doit
 * donc rien à une estimation.
 *
 * Il est ensuite ramené dans la fourchette annoncée sur la barre d'appel : un
 * site déjà propre n'a pas de quoi remplir une passe, et un site en ruine en
 * afficherait quarante, ce qui décourage au lieu de vendre.
 */
function countPendingFixes(diagnostic: AnalysisDiagnostic, lockedCount: number): number {
  const failed = [...diagnostic.architecture.checks, ...diagnostic.content.checks].filter(
    (check) => check.status === "ko" || check.status === "warn",
  ).length;

  const [min, max] = PENDING_FIXES_RANGE;
  return Math.min(max, Math.max(min, failed + lockedCount));
}
