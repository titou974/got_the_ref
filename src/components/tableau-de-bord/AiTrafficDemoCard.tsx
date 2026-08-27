"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AreaChart } from "@/components/tremor/AreaChart";
import {
  DEMO_ENGINES,
  windowDemoAiTraffic,
  type DemoAiTraffic,
  type DemoEngine,
} from "@/features/dashboard/demoTraffic";
import { useIsCompact } from "@/lib/useIsCompact";
import { Card, CardTitle, Delta } from "./Card";
import { TrafficFilterBar, type TrafficPeriod } from "./TrafficFilterBar";

/**
 * La carte de trafic en mode exemple : trois aires empilées, une par assistant.
 *
 * Reprise de la composition « chart-compositions » de Tremor — un chiffre en
 * tête, la courbe en dessous, le détail par série dans un tableau — mais montée
 * sur les couleurs du site plutôt que sur le bleu-violet-fuchsia livré.
 *
 * Le bandeau « données d'exemple » n'est pas décoratif : ces visites sont
 * inventées, et une courbe crédible sans mention se lirait comme une mesure.
 */

/** Une couleur de la palette du thème par assistant, dans l'ordre des séries. */
const ENGINE_COLORS = ["ink", "ember", "orchid"] as const;

const ENGINE_BAR: Record<DemoEngine, string> = {
  ChatGPT: "bg-ink",
  Gemini: "bg-ember",
  Perplexity: "bg-orchid",
};

const numberFormatter = new Intl.NumberFormat("fr-FR");

const formatVisits = (value: number) => numberFormatter.format(value);

export function AiTrafficDemoCard({
  demo,
  domain,
}: {
  demo: DemoAiTraffic;
  domain: string | null;
}) {
  const t = useTranslations("dashboard.traffic");
  const compact = useIsCompact();
  const [period, setPeriod] = useState<TrafficPeriod>(30);

  // Les trente jours sont déjà chargés : changer de période ne recompte que ce
  // qui est là, sans aller-retour serveur.
  const view = useMemo(() => windowDemoAiTraffic(demo, period), [demo, period]);

  const change =
    view.previousTotalSessions > 0
      ? ((view.totalSessions - view.previousTotalSessions) / view.previousTotalSessions) * 100
      : null;

  const gained = view.totalSessions - view.previousTotalSessions;
  const share = (view.totalSessions / view.siteSessions) * 100;
  const categories = [...DEMO_ENGINES];

  return (
    <Card>
      <CardTitle
        title={t("title")}
        hint={t("period", { days: view.days })}
        action={
          <span className="inline-flex items-center rounded-pill border border-border bg-mist px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-steel">
            {t("demoBadge")}
          </span>
        }
      />

      <TrafficFilterBar domain={domain} period={period} onPeriodChange={setPeriod} />

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <p className="text-[32px] font-bold leading-none tabular-nums">
          {formatVisits(view.totalSessions)}
        </p>
        <Delta value={change} />
        <p className="text-sm text-muted">
          {t("share", { value: share < 1 ? share.toFixed(1) : String(Math.round(share)) })}
        </p>
      </div>

      <p className="mt-1 text-sm text-muted">
        {t("demoGained", { count: formatVisits(gained), days: view.days })}
      </p>

      {/* Sur téléphone, la courbe perd ce qui ne tient pas dans la largeur :
          l'axe des ordonnées, la légende, et toutes les dates sauf les deux
          bouts. Le détail chiffré est dans le tableau juste en dessous, où les
          traits de couleur redisent quelle aire appartient à quel assistant. */}
      <AreaChart
        data={view.series}
        index="date"
        categories={categories}
        colors={[...ENGINE_COLORS]}
        valueFormatter={formatVisits}
        type="stacked"
        showYAxis={!compact}
        showLegend={!compact}
        startEndOnly={compact}
        yAxisWidth={44}
        className={compact ? "mt-6 h-56" : "mt-6 h-72"}
      />

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-steel">
              <th scope="col" className="py-2 pr-3 font-semibold">
                {t("tableEngine")}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                {t("tableVisits")}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                {t("tableShare")}
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                {t("tableTrend")}
              </th>
            </tr>
          </thead>
          <tbody>
            {view.engines.map((engine) => (
              <tr key={engine.name} className="border-b border-fog last:border-0">
                <td className="py-2.5 pr-3 font-medium">
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`h-4 w-1 shrink-0 rounded ${ENGINE_BAR[engine.name]}`}
                    />
                    {engine.name}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                  {formatVisits(engine.sessions)}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-muted">
                  {Math.round(engine.share)} %
                </td>
                <td className="py-2.5 text-right">
                  <Delta
                    value={
                      engine.previousSessions > 0
                        ? ((engine.sessions - engine.previousSessions) / engine.previousSessions) *
                          100
                        : null
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 border-t border-border pt-4 text-xs text-ash">{t("noAnalytics")}</p>
      <p className="mt-2 text-xs text-ash">{t("geminiNote")}</p>
    </Card>
  );
}
