import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { hydrateAnalysisResult } from "@/lib/geo/hydrate";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { buildRecommendationPlan } from "@/features/dashboard/plan";
import { buildDemoAiTraffic } from "@/features/dashboard/demoTraffic";
import { totalGainFor } from "@/lib/geo/traffic-gain";
import { scoreLabel } from "@/lib/score";
import { getCurrentUser } from "@/lib/auth";
import { isReportUnlocked } from "@/features/analysis/access";
import { ensurePaidAnalysis } from "@/features/analysis/service";
import { canSee, offerForBlock, type AccessTier } from "@/constants/access";
import { ROUTES } from "@/constants/routes";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SiteScreenshot } from "@/components/dashboard/SiteScreenshot";
import { AnimatedScoreRing } from "@/components/dashboard/AnimatedScoreRing";
import { PaidReportCard } from "@/components/dashboard/PaidReportCard";
import { AnimatedCard } from "@/components/dashboard/AnimatedCard";
import { NicheBand } from "@/components/tableau-de-bord/NicheBand";
import { RankingsSection } from "@/components/tableau-de-bord/RankingsSection";
import { AiTrafficCard } from "@/components/tableau-de-bord/AiTrafficCard";
import { GateBar, TierGate } from "@/components/tableau-de-bord/TierGate";
import { Recommendations } from "@/components/geo/Recommendations";
import { TrafficGainCards } from "@/components/geo/TrafficGainCards";
import { UrlAnalyzeForm } from "@/components/UrlAnalyzeForm";

type Props = { params: Promise<{ id: string }> };

/**
 * L'analyse lancée depuis la page d'accueil, rendue dans le tableau de bord.
 *
 * C'est le même écran que celui d'un client abonné : la capture du site et sa
 * note, le constat écrit à la frappe, la niche détectée, la place dans les
 * quatre moteurs, le plan de corrections avec ce qu'il rapporte, et la courbe de
 * trafic. Les mêmes composants, dans le même ordre, avec les mêmes voiles.
 *
 * Il a remplacé l'ancien rapport d'analyse — un second tableau de bord,
 * entretenu en parallèle, avec ses propres onglets, son propre paywall et sa
 * propre mise en page. Deux écrans pour dire la même chose finissaient par la
 * dire différemment : une correction apportée à l'un ne l'était jamais à
 * l'autre, et le visiteur qui s'abonnait découvrait un produit qui ne
 * ressemblait pas à ce qu'on lui avait montré. Il n'en reste qu'un, et ce qu'on
 * montre avant l'inscription est exactement ce qu'on livre après.
 *
 * Ce qui n'a pas de sens sans compte n'est pas rendu : le calendrier éditorial
 * (il n'y a pas d'articles à planifier pour personne), la barre d'exécution des
 * agents, et le bouton qui reprend le relevé des classements. À leur place, en
 * pied de page, l'ouverture d'un compte.
 */

type LoadedAnalysis = {
  result: GeoAnalysisResult;
  unlocked: boolean;
  userId: string | null;
  ownerPlan: string | null;
};

async function loadAnalysis(id: string): Promise<LoadedAnalysis | null> {
  // L'offre du propriétaire décide de la lecture publique du rapport : elle est
  // chargée avec l'analyse pour éviter une seconde requête.
  const record = await prisma.analysis.findUnique({
    where: { id },
    include: { user: { select: { plan: true } } },
  });
  if (!record) return null;
  try {
    return {
      result: hydrateAnalysisResult(JSON.parse(record.data) as GeoAnalysisResult),
      unlocked: record.unlocked,
      userId: record.userId,
      ownerPlan: record.user?.plan ?? null,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const analysis = await loadAnalysis(id);
  // Rapport propre à un visiteur : jamais indexé, quel que soit son état.
  const robots = { index: false, follow: false } as const;
  if (!analysis) return { title: "Analyse introuvable", robots };
  const { result } = analysis;
  return {
    title: `Analyse GEO de ${result.domain} : score ${result.overallScore}/100`,
    description: result.verdict,
    robots,
  };
}

export default async function AnalysePage({ params }: Props) {
  const { id } = await params;
  let analysis = await loadAnalysis(id);
  if (!analysis) notFound();

  // L'aperçu est gratuit ; le rapport complet s'ouvre après paiement de cette
  // analyse, pour un compte dont l'offre le couvre, ou pour tout visiteur si
  // l'analyse vient d'un compte abonné (rapport partageable).
  const user = await getCurrentUser();
  const unlocked = isReportUnlocked(analysis, user);

  // Débloqué mais l'audit complet (DeepSeek + moteurs live) n'a encore jamais
  // tourné pour cette analyse (paiement reçu sans passer par /paiement/succes) :
  // on le lance maintenant, une seule fois.
  if (unlocked) {
    await ensurePaidAnalysis(id);
    analysis = await loadAnalysis(id);
    if (!analysis) notFound();
  }

  const t = await getTranslations("dashboard.home");
  const ta = await getTranslations("analysisReport");
  const tg = await getTranslations("trafficGain");
  const tc = await getTranslations("common");

  const result = analysis.result;
  const diagnostic = buildDiagnostic(result);

  // Le même vocabulaire d'offres que le tableau de bord : une analyse payée
  // ouvre tout, une analyse gratuite garde ses voiles. Rien d'autre à décider —
  // les composants savent déjà quoi faire d'un palier.
  const tier: AccessTier = unlocked ? "allin" : "free";
  const sees = (block: Parameters<typeof canSee>[1]) => canSee(tier, block);

  const {
    open: openRecommendations,
    veiled: veiledRecommendations,
    locked: lockedRecommendations,
    pendingFixes,
  } = buildRecommendationPlan(result.recommendations, diagnostic, tier);

  const date = new Date(result.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Nav minimal />

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-5 py-8">
        {/* 1. La fenêtre du site, assombrie, avec la note posée dessus. */}
        <SiteScreenshot
          url={result.url}
          domain={result.domain}
          variant="site"
          stack={result.signals.stack ?? null}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {ta("heroEyebrow")}
          </p>
          <AnimatedScoreRing
            score={result.overallScore}
            sizeSm={124}
            label={scoreLabel(result.overallScore)}
            trackColor="rgba(255,255,255,0.18)"
            labelClassName="text-white/80"
          />
          <div>
            <h1 className="text-balance text-xl font-bold text-white sm:text-3xl">
              {result.businessName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[13px] text-white/80 sm:text-sm">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer font-medium text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
              >
                {result.domain}
              </a>
              <span aria-hidden>·</span>
              <span>{result.profile.niche}</span>
              <span aria-hidden>·</span>
              <span>{date}</span>
            </div>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-white/90 sm:text-base">
              {result.verdict}
            </p>
          </div>
        </SiteScreenshot>

        {/* 2. Le constat écrit à la frappe, collé à la capture. */}
        <PaidReportCard
          result={result}
          diagnostic={diagnostic}
          scope={unlocked ? "report" : "free"}
        />

        {/* 3. Sur quoi et où nous l'avons interrogé. */}
        <NicheBand
          niche={result.profile.niche ?? null}
          location={result.profile.location ?? null}
          isPhysical={result.profile.isPhysical}
        />

        {/* 4. La place du commerce dans les moteurs suivis. Sans compte, il n'y
               a rien à reprendre : le bouton de relevé ne s'affiche pas. */}
        <RankingsSection engines={result.engines} tier={tier} canRefresh={false} />

        {/* 5. Les corrections, et ce qu'elles rapportent. */}
        <section>
          <div className="mb-3">
            <h2 className="text-lg font-bold">{t("priorities")}</h2>
            <p className="text-sm text-muted">{t("prioritiesHint")}</p>
          </div>

          <div className="mb-4">
            <TrafficGainCards
              gain={totalGainFor(result)}
              title={tg("homeTitle")}
              caption={tg("homeCaption")}
              note={tg("homeNote")}
            />
          </div>

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

        {/* 6. La courbe du trafic amené par les IA. Personne n'a rattaché
               Analytics ici — il n'y a pas de compte —, donc c'est la courbe
               d'exemple, tirée du domaine analysé : deux sites n'ont pas la
               même, et elle monte, ce qui est le propos. */}
        <AiTrafficCard
          report={null}
          demo={buildDemoAiTraffic(result.domain)}
          domain={result.domain}
          veiled={!sees("traffic")}
          offerCall={
            sees("traffic") ? undefined : (
              <GateBar offer={offerForBlock("traffic")} item="traffic" />
            )
          }
        />

        {/* 7. Ce qu'il reste à faire : ouvrir un compte pour retrouver cet écran
               chez soi, ou analyser un autre site. */}
        <AnimatedCard className="text-center">
          <h2 className="text-xl font-bold">{ta("ctaAnotherTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {ta("ctaAnotherSubtitle")}
          </p>
          <div className="mx-auto mt-5 max-w-lg">
            <UrlAnalyzeForm size="md" />
          </div>
          <p className="mt-4 text-sm text-muted">
            {ta("ctaUnlimited")}{" "}
            <Link
              href={ROUTES.pricing}
              className="cursor-pointer font-medium text-text underline decoration-pebble underline-offset-2 hover:decoration-obsidian"
            >
              {tc("discoverOffers")}
            </Link>
          </p>
        </AnimatedCard>
      </div>

      <Footer />
    </main>
  );
}
