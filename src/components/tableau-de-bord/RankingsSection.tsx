"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { refreshRankingsAction } from "@/features/dashboard/actions";
import { EngineCard, ENGINE_LOGOS } from "@/components/geo/EngineRankings";
import { SearchLoader } from "@/components/SearchLoader";
import { DASHBOARD_ENGINES, type EngineScore } from "@/lib/geo/types";
import { runsEngine, type AccessTier } from "@/constants/access";
import { TierGate } from "./TierGate";

/**
 * La place du commerce dans les moteurs suivis, et le bouton qui la reprend.
 *
 * Le relevé se fait ici, sur la page, et non derrière un bouton qui mènerait
 * ailleurs : les API à interroger prennent une trentaine de secondes, et
 * pendant ce temps les cartes cèdent la place à l'attente. Laisser les anciens
 * classements à l'écran pendant le relevé laisserait croire qu'ils sont à jour.
 *
 * Seuls les moteurs de `DASHBOARD_ENGINES` sont montrés. Le top 10 direct et
 * indirect qu'ils portent vient de leur propre réponse : ChatGPT par son outil
 * de recherche, Gemini par le grounding Google Search. Aucun modèle de service
 * ne fabrique un classement à leur place.
 *
 * Un compte gratuit ne fait mesurer que Gemini : la carte ChatGPT est bien à sa
 * place, à la bonne taille, mais sous voile — elle porte l'estimation du modèle,
 * pas un relevé, et la faire passer pour une position serait mentir. Le voile
 * dit ce qu'il en est et mène aux tarifs.
 */
export function RankingsSection({
  engines,
  tier,
}: {
  engines: EngineScore[];
  tier: AccessTier;
}) {
  const t = useTranslations("analysisReport.results");
  const tr = useTranslations("dashboard.rankings");
  const router = useRouter();

  const shown = engines.filter((engine) => DASHBOARD_ENGINES.includes(engine.engine));

  const { execute, isPending, result } = useAction(refreshRankingsAction, {
    onSuccess: () => router.refresh(),
  });

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{t("engineScoresTitle")}</h2>
          {/* La requête exacte envoyée aux moteurs ne s'affiche plus ici :
              trois lignes de prompt sous un titre repoussaient les classements
              hors du premier écran, et le client vient lire son rang, pas la
              question posée en son nom. */}
          <p className="mt-0.5 max-w-2xl text-sm text-muted">{t("engineScoresSubtitle")}</p>
        </div>
        <span className="flex flex-col items-end gap-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() => execute({})}
            className="inline-flex cursor-pointer items-center rounded-pill border border-graphite px-4 py-2 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist disabled:opacity-60"
          >
            {isPending ? tr("refreshing") : tr("refresh")}
          </button>
          {result.serverError ? (
            <span className="max-w-xs text-right text-xs text-danger">{result.serverError}</span>
          ) : null}
        </span>
      </div>

      {isPending ? (
        <SearchLoader kind="audit" title={tr("refreshing")} />
      ) : (
        // Deux moteurs tiennent côte à côte sur un écran d'ordinateur : les
        // empiler obligeait à faire défiler pour comparer ChatGPT et Gemini,
        // alors que la comparaison est tout l'intérêt de la section. Au-delà de
        // deux, la rangée redevient une pile — trois demi-largeurs tronqueraient
        // les noms de concurrents.
        <div className={shown.length === 2 ? "grid gap-4 lg:grid-cols-2" : "space-y-4"}>
          {shown.map((engine, i) => {
            const card = (
              <EngineCard engine={engine} delay={i * 0.05} compact={shown.length === 2} />
            );
            return runsEngine(tier, engine.engine) ? (
              <div key={engine.engine}>{card}</div>
            ) : (
              // Le logo du moteur est repris net sur le voile : sous le flou,
              // celui de la carte n'est plus lisible, et l'appel doit dire de
              // quel moteur il parle avant de dire ce qu'il coûte.
              <TierGate
                key={engine.engine}
                offer="boost"
                item="rankings"
                compact
                logo={ENGINE_LOGOS[engine.engine]}
                logoAlt={engine.engine}
              >
                {card}
              </TierGate>
            );
          })}
        </div>
      )}
    </section>
  );
}
