"use client";

import { useTranslations } from "next-intl";
import type { AiTrafficReport } from "@/features/dashboard/ga4";
import type { DemoAiTraffic } from "@/features/dashboard/demoTraffic";
import { Obscured, Redacted } from "@/components/dashboard/LockedContent";
import { AiTrafficDemoCard } from "./AiTrafficDemoCard";
import { Card, CardTitle, Delta } from "./Card";
import { TrafficChart, type Point } from "./Charts";

/**
 * Le trafic amené par les assistants, jour par jour.
 *
 * Sans rattachement Analytics, il n'y a rien à mesurer. Plutôt qu'une phrase
 * seule dans une carte vide, la courbe d'exemple prend la place : elle montre à
 * quoi ressemblera l'écran une fois branché. Le bandeau « données d'exemple »
 * et la phrase sur le rattachement restent en place — un zéro et une absence de
 * mesure se ressemblent trop pour être dessinés pareil.
 */
export function AiTrafficCard({
  report,
  demo,
  domain,
  veiled = false,
  overlay,
  offerCall,
}: {
  report: AiTrafficReport | null;
  demo: DemoAiTraffic;
  /** Le domaine suivi, montré dans la barre de filtres de la carte d'exemple. */
  domain: string | null;
  /**
   * L'offre du compte n'ouvre pas encore le trafic : sur une mesure réelle, les
   * totaux s'écrivent « X » et la courbe se floute.
   */
  veiled?: boolean;
  /**
   * L'appel de l'offre posé **par-dessus** la courbe floutée d'une mesure
   * réelle. Attend un `GatePanel`, qui se cale sur le parent positionné.
   */
  overlay?: React.ReactNode;
  /**
   * L'appel de l'offre posé **en flux** sous la courbe d'exemple, qui n'est
   * plus floutée. Attend une `GateBar`.
   *
   * Deux emplacements parce qu'il y a deux situations : une mesure retenue se
   * couvre là où elle se lit, un exemple inventé n'a rien à couvrir.
   */
  offerCall?: React.ReactNode;
}) {
  const t = useTranslations("dashboard.traffic");

  if (!report) {
    return (
      <AiTrafficDemoCard demo={demo} domain={domain} veiled={veiled} offerCall={offerCall} />
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
        <p className="text-[32px] font-bold leading-none tabular-nums">
          {veiled ? <Redacted label="visites masquées" /> : report.totalSessions}
        </p>
        {veiled ? null : <Delta value={change} />}
        {veiled ? (
          <p className="text-sm text-muted">{t("shareMasked")}</p>
        ) : share !== null ? (
          <p className="text-sm text-muted">
            {t("share", { value: share < 1 ? share.toFixed(1) : String(Math.round(share)) })}
          </p>
        ) : null}
      </div>

      {/* Seule la courbe se floute : l'axe des dates et la hauteur de la carte
          restent les mêmes, et le client voit qu'il y a une mesure à lire.
          L'appel de l'offre se pose dessus, là où le voile se voit. */}
      <div className={`relative isolate mt-4 ${veiled ? "min-h-[17rem]" : ""}`}>
        {veiled ? (
          <>
            <Obscured>
              <TrafficChart data={data} labels={labels} />
            </Obscured>
            {overlay}
          </>
        ) : (
          <TrafficChart data={data} labels={labels} />
        )}
      </div>

      <ul className="mt-4 space-y-2 border-t border-border pt-4">
        {report.engines.map((engine) => (
          <li key={engine.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">{engine.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">
                {veiled ? (
                  <Redacted label={`visites depuis ${engine.label}, masquées`} />
                ) : (
                  engine.sessions
                )}
              </span>
              {veiled ? null : (
                <Delta
                  value={
                    engine.previousSessions > 0
                      ? ((engine.sessions - engine.previousSessions) / engine.previousSessions) * 100
                      : null
                  }
                />
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-ash">{t("geminiNote")}</p>
    </Card>
  );
}
