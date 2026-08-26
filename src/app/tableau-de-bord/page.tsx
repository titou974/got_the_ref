import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import { getDashboardContext, listArticles } from "@/features/dashboard/queries";
import { fetchAiTraffic } from "@/features/dashboard/ga4";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { scoreLabel } from "@/lib/score";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { ConnectStrip } from "@/components/tableau-de-bord/ConnectStrip";
import { AiTrafficCard } from "@/components/tableau-de-bord/AiTrafficCard";
import { ArticleAgenda } from "@/components/tableau-de-bord/ArticleAgenda";
import { SolveAgentsDock } from "@/components/tableau-de-bord/SolveAgentsDock";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { RankingsSection } from "@/components/tableau-de-bord/RankingsSection";
import { SiteScreenshot } from "@/components/dashboard/SiteScreenshot";
import { AnimatedScoreRing } from "@/components/dashboard/AnimatedScoreRing";
import { AnimatedCard } from "@/components/dashboard/AnimatedCard";
import { PaidReportCard } from "@/components/dashboard/PaidReportCard";
import { ProfileHeader } from "@/components/geo/SiteProfile";
import { DiagnosticGrid } from "@/components/geo/DiagnosticGrid";
import { Recommendations } from "@/components/geo/Recommendations";

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
  const [traffic, articles] = await Promise.all([
    fetchAiTraffic(user.id, 30),
    listArticles(user.id),
  ]);

  const upcoming = articles.filter((article) => article.status !== "published");

  const date = new Date(analysis.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={context.domain ? t("subtitle", { domain: context.domain }) : null}
        actions={
          context.analysisId ? (
            <Link
              href={ROUTES.analysis(context.analysisId)}
              className="inline-flex cursor-pointer items-center rounded-pill border border-graphite px-5 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist"
            >
              {t("fullReport")}
            </Link>
          ) : null
        }
      />

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

      {/* 1bis. Le constat écrit à la frappe, comme sur le rapport d'analyse. */}
      <PaidReportCard result={analysis} diagnostic={diagnostic} scope="dashboard" />

      {/* 2. La courbe du trafic amené par les IA. */}
      <AiTrafficCard report={traffic} />

      {/* 3. La place du commerce dans ChatGPT et Gemini. */}
      <RankingsSection engines={analysis.engines} liveQuery={analysis.liveQuery ?? null} />

      {/* ---- Ce qui explique les chiffres du haut ---- */}

      <ConnectStrip />

      <ProfileHeader profile={analysis.profile} />

      <AnimatedCard delay={0.05} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col items-center justify-center gap-3 text-center lg:border-r lg:border-fog">
          <AnimatedScoreRing
            score={diagnostic.architecture.score}
            size={120}
            stroke={10}
            label={ta("results.scoreLabel")}
          />
          <div>
            <h3 className="font-semibold">{ta("results.diagnosisTitle")}</h3>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
              {ta("results.diagnosisSubtitle")}
            </p>
          </div>
        </div>
        <div className="lg:col-span-2">
          <DiagnosticGrid section={diagnostic.architecture} labelNs="architecture" />
        </div>
      </AnimatedCard>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold">{t("priorities")}</h2>
          <p className="text-sm text-muted">{t("prioritiesHint")}</p>
        </div>
        <Recommendations
          recommendations={analysis.recommendations}
          emptyLabel={ta("results.noRecommendations")}
        />
      </section>

      <ArticleAgenda articles={upcoming} limit={4} />

      {/* Tant que le rattachement du site n'est pas ouvert, le prompt est la
          voie d'exécution. Il ne vit plus au bas de la page : la barre fixe le
          porte, et il couvre désormais les six sections d'un coup — le client
          n'a plus à passer d'onglet en onglet pour ramasser ses correctifs. */}
      <SolveAgentsDock
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
