import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import {
  getDashboardContext,
  listArticles,
} from "@/features/dashboard/queries";
import { fetchAiTraffic } from "@/features/dashboard/ga4";
import { fetchLlmMentions } from "@/features/dashboard/llmMentions";
import { buildDemoAiTraffic } from "@/features/dashboard/demoTraffic";
import { buildDemoLlmMentions } from "@/features/dashboard/demoLlmMentions";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { scoreLabel } from "@/lib/score";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { AiTrafficCard } from "@/components/tableau-de-bord/AiTrafficCard";
import { LlmMentionsCard } from "@/components/tableau-de-bord/LlmMentionsCard";
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
 * En haut, ce qu'il vient vérifier : son site tel qu'on le voit, la note posée
 * dessus, puis le constat écrit à la frappe. Ce sont les blocs du rapport
 * d'analyse, repris tels quels : l'écran qu'il a découvert en achetant doit
 * rester reconnaissable ensuite, semaine après semaine.
 *
 * La rangée de chiffres qui suivait (note, visites, corrections en attente) a
 * disparu : elle répétait la note du hero, une valeur vide tant qu'Analytics
 * n'est pas rattaché, et un décompte que la barre du bas porte déjà.
 *
 * En dessous, ce qui explique ces chiffres : la niche retenue, le diagnostic
 * d'architecture contrôle par contrôle, le plan d'action, le calendrier. Et
 * l'exécution ne vit plus au bas de la page : elle tient dans la barre fixe
 * « résoudre avec les agents IA », à portée de pouce d'un bout à l'autre.
 */
export default async function DashboardHomePage() {
  const user = await requireUser();
  const context = await getDashboardContext(user.id);
  const t = await getTranslations("dashboard.home");
  const ta = await getTranslations("analysisReport");

  if (!context.analysis) return <PreparingAnalysis />;

  const analysis = context.analysis;
  const diagnostic = buildDiagnostic(analysis);

  // L'accueil est le seul écran ouvert à tous : le verrou s'y pose bloc par
  // bloc plutôt que sur la page entière. Reste en clair ce qui montre le
  // produit sans le donner — le site, sa note, la niche détectée, le constat
  // écrit. Le reste garde sa forme sous un voile, avec l'offre qui l'ouvre.
  const tier = context.tier;
  const sees = (block: Parameters<typeof canSee>[1]) => canSee(tier, block);

  // Sous le voile, on montre une carte d'exemple, jamais la vraie donnée : les
  // deux relevés qui coûtent un appel — Analytics et le suivi des mentions —
  // ne sont donc lancés que pour qui les verra. Les cartes savent déjà quoi
  // faire d'un rapport absent : elles basculent sur leur version de
  // démonstration.
  const [traffic, mentions, articles] = await Promise.all([
    sees("traffic") ? fetchAiTraffic(user.id, 30) : null,
    sees("mentions")
      ? fetchLlmMentions(user.id, context.domain ?? analysis.domain, context.country)
      : null,
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

      {/* 1bis. Le constat écrit à la frappe, comme sur le rapport d'analyse. Il
             n'est jamais voilé : c'est le texte qui dit au client ce qu'on a vu
             chez lui. En gratuit, il ne rend compte que de ce qui est ouvert —
             le contenu, le classement Gemini — et annonce le reste sans le
             détailler. */}
      <PaidReportCard
        result={analysis}
        diagnostic={diagnostic}
        scope={tierAtLeast(tier, "boost") ? "dashboard" : "free"}
      />

      {/* 2. La courbe du trafic amené par les IA — d'exemple tant qu'Analytics
             n'est pas rattaché. Les dates sont lues ici, côté serveur, pour que
             le navigateur reçoive le même axe que le rendu initial. */}
      <Block block="traffic" open={sees("traffic")}>
        <AiTrafficCard
          report={traffic}
          demo={buildDemoAiTraffic()}
          domain={context.domain ?? analysis.domain}
        />
      </Block>

      {/* 2bis. Combien de fois chaque modèle cite le commerce. La mesure précède
             celle du dessus : on est cité avant d'être cliqué, et le relevé
             DataForSEO lit l'archive des réponses plutôt que d'en provoquer. */}
      <Block block="mentions" open={sees("mentions")}>
        <LlmMentionsCard
          report={mentions}
          demo={buildDemoLlmMentions(context.domain ?? analysis.domain)}
          domain={context.domain ?? analysis.domain}
        />
      </Block>

      {/* 3. La place du commerce dans ChatGPT et Gemini. Le voile y est posé
             moteur par moteur : un compte gratuit fait mesurer Gemini, et voit
             la carte ChatGPT sous voile — faute d'avoir été exécutée. */}
      <RankingsSection engines={analysis.engines} tier={tier} />

      {/* ---- Ce qui explique les chiffres du haut ---- */}

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

      <Block block="agenda" open={sees("agenda")}>
        <ArticleAgenda articles={upcoming} limit={4} />
      </Block>

      {/* L'exécution ne passe plus par un prompt à copier : la barre ouvre le
          rattachement de l'agent IA du client, qui va chercher lui-même les six
          chantiers et les applique.

          Elle est là pour tout le monde. Un compte gratuit installe la même
          prise qu'un abonné — c'est le geste que le produit vend, et une page
          qui ne le montre pas ne le vend pas. Ce que l'offre borne, c'est ce
          que le serveur MCP sert ensuite à l'agent : les chantiers fermés
          arrivent nommés et vides, jamais floutés. */}
      <SolveAgentsDock
        locked={!tierAtLeast(tier, "boost")}
        result={analysis}
        diagnostic={diagnostic}
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
