"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { refreshRankingsAction } from "@/features/dashboard/actions";
import { EngineCard, ENGINE_LOGOS } from "@/components/geo/EngineRankings";
import { SearchLoader } from "@/components/SearchLoader";
import { DASHBOARD_ENGINES, type EngineScore } from "@/lib/geo/types";
import { decoyEngine } from "@/lib/geo/decoy-ranking";
import { runsEngine, type AccessTier } from "@/constants/access";
import { GatePanel } from "./TierGate";

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
 * de recherche, Gemini par le grounding Google Search, Perplexity par
 * construction, Claude par son outil `web_search`. Aucun modèle de service ne
 * fabrique un classement à leur place.
 *
 * Un compte gratuit ne fait mesurer que Gemini : les trois autres cartes sont
 * bien à leur place, à la bonne taille, mais sous voile — elles portent
 * l'estimation du modèle, pas un relevé, et les faire passer pour des positions
 * serait mentir. Le voile dit ce qu'il en est et mène aux tarifs. Elles
 * s'ouvrent au Coup de Boost, qui fait partir les quatre relevés.
 *
 * Sous ce voile, la carte ne montre donc rien du client : `decoyEngine` lui
 * reprend la forme de la carte ouverte — mêmes blocs, mêmes intitulés — et la
 * remplit d'un top 10 fictif, sans ligne surlignée. C'est ce qui lui donne
 * exactement la hauteur de sa jumelle : les deux cartes de la rangée se
 * terminent au même endroit, voile compris.
 */
export function RankingsSection({
  engines,
  tier,
  canRefresh = true,
}: {
  engines: EngineScore[];
  tier: AccessTier;
  /**
   * Reprendre le relevé écrit en base : réservé à qui a un compte.
   *
   * L'aperçu public d'une analyse affiche les mêmes cartes, mais il n'y a rien à
   * rafraîchir — l'analyse n'appartient à personne, et l'action serveur refuse
   * un visiteur anonyme. Un bouton qui ne peut qu'échouer ne se montre pas.
   */
  canRefresh?: boolean;
}) {
  const t = useTranslations("analysisReport.results");
  const tr = useTranslations("dashboard.rankings");
  const router = useRouter();

  const shown = engines.filter((engine) => DASHBOARD_ENGINES.includes(engine.engine));

  // La carte ouverte sert de patron aux cartes voilées : c'est elle qui dit
  // combien de blocs de classement afficher, et sous quels intitulés.
  const reference =
    shown.find((engine) => runsEngine(tier, engine.engine) && engine.rankings.length > 0) ?? null;

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
        {canRefresh ? (
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
        ) : null}
      </div>

      {isPending ? (
        <SearchLoader kind="audit" title={tr("refreshing")} />
      ) : (
        // Deux moteurs tiennent côte à côte sur un écran d'ordinateur : les
        // empiler obligeait à faire défiler pour les comparer, alors que la
        // comparaison est tout l'intérêt de la section. Deux par rangée et pas
        // plus : trois demi-largeurs tronqueraient les noms de concurrents.
        <div className={shown.length > 1 ? "grid gap-4 lg:grid-cols-2" : "space-y-4"}>
          {shown.map((engine, i) => {
            const open = runsEngine(tier, engine.engine);

            // La carte reste lisible : on doit voir quel moteur a été
            // interrogé, sur quelles requêtes, et qu'un top 10 existe. Seules
            // les bandes du classement et la note sont retenues, et l'appel se
            // pose dessus — pas en pied de carte, où il faudrait faire le lien
            // soi-même entre le flou du milieu et l'offre du bas. Le logo y est
            // repris net : sous le flou, celui de la carte n'est plus lisible.
            return (
              <div key={engine.engine}>
                <EngineCard
                  engine={open ? engine : decoyEngine(engine, reference)}
                  delay={i * 0.05}
                  compact={shown.length > 1}
                  preview={!open}
                  overlay={
                    open ? undefined : (
                      // Le voile nomme le moteur qu'il couvre : trois cartes
                      // fermées portent le même appel, et un appel qui parlerait
                      // de ChatGPT sur la carte Claude ne se rattacherait à rien.
                      <GatePanel
                        offer="boost"
                        item="rankings"
                        logo={ENGINE_LOGOS[engine.engine]}
                        logoAlt={engine.engine}
                        values={{ engine: engine.engine }}
                      />
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
