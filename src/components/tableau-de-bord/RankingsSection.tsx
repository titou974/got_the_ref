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
 * Seuls les moteurs de `DASHBOARD_ENGINES` sont montrés : Claude reste dans
 * l'analyse enregistrée, mais son classement n'est pas affiché ici.
 */
export function RankingsSection({
  engines,
  liveQuery,
}: {
  engines: EngineScore[];
  /** Requête réellement envoyée aux moteurs, quand un relevé a abouti. */
  liveQuery: string | null;
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
          <p className="mt-0.5 max-w-2xl text-sm text-muted">
            {liveQuery ? t("testedOn", { query: liveQuery }) : t("engineScoresSubtitle")}
          </p>
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
        <div className="space-y-4">
          {shown.map((engine, i) => (
            <EngineCard key={engine.engine} engine={engine} delay={i * 0.05} />
          ))}
        </div>
      )}
    </section>
  );
}
