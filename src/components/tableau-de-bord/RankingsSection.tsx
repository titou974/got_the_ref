"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { refreshRankingsAction } from "@/features/dashboard/actions";
import { EngineCard } from "@/components/geo/EngineRankings";
import { SearchLoader } from "@/components/SearchLoader";
import { DASHBOARD_ENGINES, type EngineScore } from "@/lib/geo/types";

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
 */
export function RankingsSection({ engines }: { engines: EngineScore[] }) {
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
          {shown.map((engine, i) => (
            <EngineCard
              key={engine.engine}
              engine={engine}
              delay={i * 0.05}
              compact={shown.length === 2}
            />
          ))}
        </div>
      )}
    </section>
  );
}
