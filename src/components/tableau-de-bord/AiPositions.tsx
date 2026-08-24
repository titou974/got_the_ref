import { getTranslations } from "next-intl/server";
import type { EngineScore } from "@/lib/geo/types";
import { Card, CardTitle } from "./Card";

/**
 * La place du commerce dans chaque IA.
 *
 * Un moteur peut ne rien renvoyer : `targetRank` vaut alors `null`, et la ligne
 * dit « hors classement » plutôt que d'afficher un rang inventé. Le classement
 * indirect (catégorie large) n'existe que pour les commerces avec une adresse.
 */
export async function AiPositions({ engines }: { engines: EngineScore[] }) {
  const t = await getTranslations("dashboard.positions");

  return (
    <Card>
      <CardTitle title={t("title")} hint={t("hint")} />

      <div className="space-y-3">
        {engines.map((engine) => {
          const direct = engine.rankings.find((ranking) => ranking.scope === "direct");
          const indirect = engine.rankings.find((ranking) => ranking.scope === "indirect");

          return (
            <div
              key={engine.engine}
              className="rounded-2xl border border-border px-4 py-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold">{engine.engine}</span>
                  <span className="rounded-xl bg-mist px-2 py-0.5 text-[11px] font-medium text-steel">
                    {t(`visibility.${engine.visibility}`)}
                  </span>
                  {!engine.measured ? (
                    <span className="text-[11px] text-ash">{t("estimated")}</span>
                  ) : null}
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {direct?.targetRank ? `#${direct.targetRank}` : t("unranked")}
                </span>
              </div>

              {direct ? (
                <p className="mt-1.5 truncate text-sm text-muted">{direct.label}</p>
              ) : null}

              {indirect ? (
                <p className="mt-1 truncate text-sm text-ash">
                  {t("indirect", {
                    label: indirect.label,
                    rank: indirect.targetRank ? `#${indirect.targetRank}` : t("unranked"),
                  })}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
