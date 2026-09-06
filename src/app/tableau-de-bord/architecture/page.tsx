import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { businessHint, getDashboardContext } from "@/features/dashboard/queries";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { buildSiteTree, veilSiteTree } from "@/lib/geo/site-tree";
import { CATEGORY_META } from "@/lib/geo/types";
import { Card, CardTitle, PageHeader } from "@/components/tableau-de-bord/Card";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { AnimatedCard } from "@/components/dashboard/AnimatedCard";
import { AnimatedScoreRing } from "@/components/dashboard/AnimatedScoreRing";
import { AxisBars } from "@/components/dashboard/AxisBars";
import { DiagnosticGrid } from "@/components/geo/DiagnosticGrid";
import { CrawlerGrid } from "@/components/geo/SiteProfile";
import { SiteSkeleton } from "@/components/geo/SiteSkeleton";
import { SectionGate } from "@/components/tableau-de-bord/SectionGate";
import { TierGate } from "@/components/tableau-de-bord/TierGate";
import { canOpen } from "@/constants/access";

export const maxDuration = 300;

/**
 * Architecture : le squelette du site, puis ce que le passage a vérifié.
 *
 * L'écran rejouait l'onglet Architecture du rapport d'analyse — même anneau,
 * même radar, mêmes contrôles. C'était juste tant que la page n'avait rien à
 * proposer : un rapport se lit, et deux copies d'un même rapport valent mieux
 * qu'un second verdict divergent.
 *
 * Elle s'en écarte maintenant, sur un point qui change sa nature. Le rapport
 * constate ; le tableau de bord corrige. La carte du squelette ouvre donc
 * l'écran : elle montre les adresses que les moteurs de réponse vont chercher à
 * la racine, marque celles qui manquent à leur place dans l'arbre, tient le
 * contenu déjà rédigé pour chacune, et porte le bouton qui les dépose. C'est le
 * livrable du Coup de Boost, resté jusqu'ici sans porte d'entrée : l'action
 * serveur existait, aucun écran ne l'appelait.
 *
 * Le rapport, lui, ne bouge pas : il garde son radar et l'ordre de ses
 * contrôles.
 *
 * La grille du contenu éditorial n'est plus ici. Elle s'affichait sous les
 * contrôles techniques alors que sa note se calcule ailleurs — l'anneau de cet
 * écran ne pèse que le technique et les données structurées — et le client la
 * lisait comme une part de l'architecture. Elle est passée à l'écran Contenu,
 * au-dessus du tableau des mots-clés, où elle compte dans la note contenu.
 */
export default async function ArchitecturePage() {
  const user = await requireUser();
  const context = await getDashboardContext(user.id);
  const t = await getTranslations("dashboard.architecture");
  const ta = await getTranslations("analysisReport");

  if (!context.analysis) return <PreparingAnalysis tier={context.tier} business={businessHint(context)} />;

  const analysis = context.analysis;
  const diagnostic = buildDiagnostic(analysis);
  const crawl = analysis.signals.crawl;
  const tree = buildSiteTree(analysis);

  // Le diagnostic passe sous voile quand l'offre ne l'ouvre pas : le client
  // voit la forme d'un rapport — l'anneau, les axes, la grille de contrôles —
  // sans qu'aucune de ses valeurs ne soit rendue, et l'appel le mène aux tarifs
  // (cf. `SectionGate`).
  //
  // Le squelette, lui, reste au-dessus du voile, et c'est le seul écart. Il ne
  // coûte aucun appel — l'arbre se déduit de l'analyse déjà en base — et c'est
  // la pièce qui se comprend sans explication : sept adresses, celles qui
  // répondent en vert, celles qui manquent masquées à leur place exacte. Le
  // client voit la forme de son site et l'endroit du trou ; ce qu'il achète,
  // c'est le nom du fichier absent et le contenu prêt à déposer (cf.
  // `veilSiteTree`).
  const locked = !canOpen(context.tier, "architecture");

  // Le dépôt demande un rattachement vivant ET un connecteur qui sait écrire :
  // l'action le revérifie côté serveur, le bouton ne fait qu'éviter au client
  // un clic dont il connaîtrait déjà l'échec.
  const canApply =
    context.site?.status === "connected" && context.site.capabilities.includes("edit");

  const axes = analysis.categories
    .filter((c) => ["technical", "structuredData", "platform"].includes(c.key))
    .map((c) => ({ label: CATEGORY_META[c.key].short, score: c.score }));

  const checks = diagnostic.architecture.checks;
  const passing = checks.filter((c) => c.status === "ok").length;
  const pending = checks.length - passing;
  const openFixes = tree.missingCount + tree.warnCount;

  return (
    <>
      <PageHeader title={t("pageTitle")} subtitle={ta("architecture.subtitle")} />

      <div className="flex flex-col gap-4">
        {locked ? (
          <TierGate
            offer="boost"
            item="architectureFiles"
            reveal
            values={{ count: openFixes }}
          >
            <SiteSkeleton
              tree={veilSiteTree(tree)}
              stack={analysis.signals.stack ?? null}
              pagesCrawled={crawl.pagesCrawled}
              canApply={false}
              locked
            />
          </TierGate>
        ) : (
          <SiteSkeleton
            tree={tree}
            stack={analysis.signals.stack ?? null}
            pagesCrawled={crawl.pagesCrawled}
            canApply={canApply}
          />
        )}

        <SectionGate section="architecture" locked={locked}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <AnimatedCard className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left lg:col-span-2">
                <AnimatedScoreRing
                  score={diagnostic.architecture.score}
                  size={140}
                  stroke={12}
                  label={ta("architecture.scoreLabel")}
                />
                <div className="flex-1">
                  <h2 className="text-lg font-bold">{ta("architecture.title")}</h2>
                  <p className="mt-2 text-pretty text-sm text-muted">{t("scoreHint")}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-mist px-3 py-1.5 text-xs text-slate">
                      <span
                        aria-hidden
                        className={`size-1.5 rounded-full ${openFixes ? "bg-danger" : "bg-success"}`}
                      />
                      {openFixes ? t("openFixes", { count: openFixes }) : t("noFixes")}
                    </span>
                    <span className="inline-flex items-center rounded-pill bg-mist px-3 py-1.5 text-xs text-slate">
                      {t("crawledPages", { count: crawl.pagesCrawled })}
                    </span>
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.05}>
                <h3 className="font-semibold">{t("axes")}</h3>
                <p className="mt-0.5 text-xs text-muted">{t("axesHint")}</p>
                <div className="mt-4">
                  <AxisBars axes={axes} />
                </div>
              </AnimatedCard>
            </div>

            <AnimatedCard delay={0.1}>
              <CardTitle
                title={t("checks")}
                hint={t("checksHint")}
                action={
                  <span className="rounded-pill bg-mist px-3 py-1 text-[11px] font-semibold text-slate">
                    {t("checksSummary", { passing, pending })}
                  </span>
                }
              />
              <DiagnosticGrid section={diagnostic.architecture} labelNs="architecture" issuesFirst />
            </AnimatedCard>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CrawlerGrid
                crawlers={analysis.signals.crawlers}
                className=""
                hint={t("crawlersHint")}
                compact
              />

              <Card>
                <CardTitle title={t("crawl")} hint={t("crawlHint")} />
                <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-2">
                  <Metric
                    label={t("pages")}
                    value={String(crawl.pagesCrawled)}
                    hint={t("pagesHint")}
                  />
                  <Metric
                    label={t("words")}
                    value={crawl.totalWordCount.toLocaleString("fr-FR")}
                    hint={t("wordsHint")}
                  />
                  <Metric
                    label={t("internalLinks")}
                    value={String(crawl.internalLinks)}
                    hint={t("internalLinksHint")}
                  />
                  <Metric
                    label={t("schemas")}
                    value={crawl.schemaTypes.length ? crawl.schemaTypes.join(", ") : t("noSchema")}
                    hint={t("schemasHint")}
                  />
                </dl>
              </Card>
            </div>
          </div>
        </SectionGate>
      </div>
    </>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-steel">{label}</dt>
      <dd className="mt-1.5 text-[22px] font-bold tabular-nums tracking-tight">{value}</dd>
      <dd className="mt-0.5 text-xs text-ash">{hint}</dd>
    </div>
  );
}
