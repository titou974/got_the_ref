"use client";

import { useTranslations } from "next-intl";
import type { AiTrafficReport } from "@/features/dashboard/ga4";
import { Card, CardTitle, Delta } from "./Card";
import { TrafficChart, type Point } from "./Charts";

/**
 * Le trafic amené par les assistants, jour par jour.
 *
 * Sans rattachement Analytics, la carte affiche ce qui manque plutôt qu'une
 * courbe plate : un zéro et une absence de mesure se ressemblent trop pour être
 * dessinés pareil.
 */
export function AiTrafficCard({ report }: { report: AiTrafficReport | null }) {
  const t = useTranslations("dashboard.traffic");

  if (!report) {
    return (
      <Card>
        <CardTitle title={t("title")} hint={t("hint")} />
        <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">
          {t("noAnalytics")}
        </p>
      </Card>
    );
  }

  const data: Point[] = report.series.map((point) => ({
    date: point.date,
    value: point.sessions,
  }));

  // Trois repères sur l'axe : début, milieu, fin. Au-delà, les dates se
  // chevauchent sur un écran de téléphone.
  const labels = [
    data[0]?.date,
    data[Math.floor(data.length / 2)]?.date,
    data[data.length - 1]?.date,
  ].filter(Boolean) as string[];

  const change =
    report.previousTotalSessions > 0
      ? ((report.totalSessions - report.previousTotalSessions) / report.previousTotalSessions) * 100
      : null;

  const share =
    report.siteSessions > 0 ? (report.totalSessions / report.siteSessions) * 100 : null;

  return (
    <Card>
      <CardTitle title={t("title")} hint={t("period", { days: report.days })} />

      <div className="flex flex-wrap items-end gap-3">
        <p className="text-[32px] font-bold leading-none tabular-nums">{report.totalSessions}</p>
        <Delta value={change} />
        {share !== null ? (
          <p className="text-sm text-muted">
            {t("share", { value: share < 1 ? share.toFixed(1) : String(Math.round(share)) })}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <TrafficChart data={data} labels={labels} />
      </div>

      <ul className="mt-4 space-y-2 border-t border-border pt-4">
        {report.engines.map((engine) => (
          <li key={engine.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">{engine.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">{engine.sessions}</span>
              <Delta
                value={
                  engine.previousSessions > 0
                    ? ((engine.sessions - engine.previousSessions) / engine.previousSessions) * 100
                    : null
                }
              />
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-ash">{t("geminiNote")}</p>
    </Card>
  );
}
