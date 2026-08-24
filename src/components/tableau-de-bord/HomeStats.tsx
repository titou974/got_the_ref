"use client";

import { useTranslations } from "next-intl";
import { Delta } from "./Card";
import { Sparkline, type Point } from "./Charts";

/**
 * La rangée de chiffres en tête de page : note IA, visites venues des IA,
 * corrections en attente.
 *
 * Chaque carte porte une valeur, sa variation quand elle existe, et rien
 * d'autre. La miniature dit l'allure des trente derniers jours ; le détail est
 * un écran plus bas.
 */
export function HomeStats({
  score,
  scoreLabel,
  sessions,
  sessionsDelta,
  series,
  pendingFixes,
}: {
  score: number;
  scoreLabel: string;
  sessions: number | null;
  sessionsDelta: number | null;
  series: Point[];
  pendingFixes: number;
}) {
  const t = useTranslations("dashboard.stats");

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Tile label={t("score")} caption={scoreLabel}>
        <p className="text-[32px] font-bold leading-none tabular-nums">{score}</p>
      </Tile>

      <Tile
        label={t("sessions")}
        caption={sessions === null ? t("sessionsMissing") : t("sessionsWindow")}
        chart={series.length ? <Sparkline data={series} /> : null}
      >
        <div className="flex items-end gap-2">
          <p className="text-[32px] font-bold leading-none tabular-nums">
            {sessions === null ? "—" : sessions}
          </p>
          <Delta value={sessionsDelta} />
        </div>
      </Tile>

      <Tile label={t("fixes")} caption={pendingFixes === 0 ? t("fixesNone") : t("fixesCaption")}>
        <p className="text-[32px] font-bold leading-none tabular-nums">{pendingFixes}</p>
      </Tile>
    </div>
  );
}

function Tile({
  label,
  caption,
  chart,
  children,
}: {
  label: string;
  caption: string;
  chart?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-border bg-surface p-5">
      <p className="text-sm font-medium text-steel">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {children}
          <p className="mt-2 truncate text-xs text-muted">{caption}</p>
        </div>
        {chart ? <div className="shrink-0">{chart}</div> : null}
      </div>
    </section>
  );
}
