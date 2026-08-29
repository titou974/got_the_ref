"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { LlmMentionsReport } from "@/features/dashboard/llmMentions";
import { Card, CardTitle, Delta } from "./Card";
import {
  ModelMentionsChart,
  MonthlyMentionsChart,
  type ModelBar,
  type MonthBar,
} from "./Charts";

/**
 * Combien de fois chaque modèle cite le commerce.
 *
 * La carte du dessus compte les visites que les IA envoient ; celle-ci compte
 * les fois où elles prononcent le nom du commerce. Ce sont deux mesures
 * différentes et la seconde précède toujours la première : on est cité bien
 * avant d'être cliqué, et c'est le premier signe qu'un travail GEO prend.
 *
 * Sans compte DataForSEO — ou tant que l'archive ne connaît pas le domaine —
 * la carte montre un exemple, net et lisible, sous un bandeau « données
 * d'exemple ». Le voile a été retiré : il cachait justement ce que l'exemple
 * est là pour montrer, la forme qu'aura l'écran une fois branché. Le bandeau
 * suffit à dire que ces chiffres sont inventés.
 */
export function LlmMentionsCard({
  report,
  demo,
  domain,
}: {
  report: LlmMentionsReport | null;
  demo: LlmMentionsReport;
  domain: string | null;
}) {
  const t = useTranslations("dashboard.mentions");

  const shown = report ?? demo;
  const isDemo = report === null;

  const bars: ModelBar[] = shown.models.map((model) => ({
    label: model.label,
    value: model.mentions,
    platform: model.platform,
  }));

  const history = shown.history ?? [];
  const months: MonthBar[] = history.map((point) => ({
    label: formatMonth(point.month),
    value: point.mentions,
  }));

  // Le dernier mois relevé, et sa variation : le chiffre qui répond à « est-ce
  // que ça monte ? » avant même que l'œil ait lu le graphique.
  const lastMonth = history.at(-1) ?? null;
  const previousMentions = history.at(-2)?.mentions ?? null;
  const monthChange =
    lastMonth && previousMentions
      ? ((lastMonth.mentions - previousMentions) / previousMentions) * 100
      : null;

  const body = (
    <>
      {/* 1. Les douze derniers mois de la marque, mois par mois. */}
      {months.length > 0 ? (
        <section className="mb-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">
                {t("historyTitle", { brand: shown.brand ?? domain ?? "" })}
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                {t("historyHint", { months: months.length })}
              </p>
            </div>
            {lastMonth ? (
              <p className="flex items-center gap-2 text-sm">
                <span className="font-semibold tabular-nums">
                  {numberFormatter.format(lastMonth.mentions)}
                </span>
                <Delta value={monthChange} />
              </p>
            ) : null}
          </div>

          <div className="mt-3">
            <MonthlyMentionsChart data={months} />
          </div>
        </section>
      ) : null}

      {/* 2. Le détail par modèle, sur le domaine. */}
      <div className="flex flex-wrap items-end gap-3">
        <p className="text-[32px] font-bold leading-none tabular-nums">
          {numberFormatter.format(shown.totalMentions)}
        </p>
        <p className="text-sm text-muted">
          {t("subtitle", { count: shown.models.length })}
        </p>
      </div>

      <div className="mt-4">
        {bars.length > 0 ? (
          <ModelMentionsChart data={bars} />
        ) : (
          <p className="py-6 text-center text-sm text-muted">{t("empty")}</p>
        )}
      </div>

      <ul className="mt-2 space-y-3 border-t border-border pt-4">
        {shown.models.map((model) => (
          <li key={model.id} className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-start gap-2.5">
              <Image
                src={model.logo}
                alt=""
                width={20}
                height={20}
                className="mt-0.5 h-5 w-5 shrink-0 rounded-md object-contain"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{model.label}</span>
                {model.topQuestion ? (
                  <span className="block truncate text-xs text-muted">
                    {t("topQuestion", { question: model.topQuestion })}
                  </span>
                ) : null}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold tabular-nums">
                {numberFormatter.format(model.mentions)}
              </span>
              <span className="block text-xs text-muted tabular-nums">
                {t("searchVolume", {
                  value: numberFormatter.format(model.searchVolume),
                })}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <Card>
      <CardTitle
        title={t("title")}
        hint={t("hint", { domain: domain ?? shown.domain })}
        action={
          isDemo ? (
            <span className="inline-flex items-center rounded-pill border border-border bg-mist px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-steel">
              {t("demoBadge")}
            </span>
          ) : null
        }
      />

      {body}

      <p className="mt-4 text-xs text-ash">
        {isDemo
          ? t("demoNote")
          : `${t("source")} ${t("measuredOn", { date: formatDay(shown.fetchedAt) })}${
              shown.nextRefreshAt
                ? ` ${t("nextRefresh", { date: formatDay(shown.nextRefreshAt) })}`
                : ""
            }`}
        {!isDemo && shown.truncated ? ` ${t("truncated")}` : ""}
      </p>
    </Card>
  );
}

const numberFormatter = new Intl.NumberFormat("fr-FR");

/**
 * Le jour d'un horodatage ISO, en heure de Paris.
 *
 * Le fuseau est fixé plutôt que laissé au navigateur : le serveur rend cette
 * carte en UTC, et une date qui change entre le rendu initial et l'hydratation
 * casse la page pour économiser une nuance que personne ne lit.
 */
const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dayFormatter.format(date);
}

/** Le mois abrégé d'un « 2026-08-01 » : « août 26 » sous la barre. */
const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

function formatMonth(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : monthFormatter.format(date);
}
