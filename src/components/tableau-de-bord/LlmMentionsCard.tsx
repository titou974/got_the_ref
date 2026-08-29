"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { LlmMentionsReport } from "@/features/dashboard/llmMentions";
import { Card, CardTitle } from "./Card";
import {
  DELTA_COLORS,
  PlatformDeltaChart,
  type DeltaRow,
  type DeltaSeries,
} from "./Charts";

/**
 * Comment les mentions du commerce dans les IA bougent, mois par mois.
 *
 * La carte du dessus compte les visites que les IA envoient ; celle-ci compte
 * les fois où elles prononcent le nom du commerce. Ce sont deux mesures
 * différentes et la seconde précède toujours la première : on est cité bien
 * avant d'être cliqué, et c'est le premier signe qu'un travail GEO prend.
 *
 * Ce que portent les barres est un **écart**, pas un total : « +18 » veut dire
 * dix-huit citations de plus que le mois précédent. Le signe est donc écrit
 * partout, et une baisse descend sous la ligne de zéro.
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

  // Une série par modèle d'IA, chacune sa couleur dans la légende, toutes
  // rangées sur le même axe de mois.
  const platforms = shown.platforms.filter((entry) => entry.points.length > 0);
  const series: DeltaSeries[] = platforms.map((entry, index) => ({
    key: entry.platform,
    label: entry.label,
    color: DELTA_COLORS[index % DELTA_COLORS.length],
  }));

  // Les mois de la série la plus longue font l'axe : une plateforme absente
  // d'un mois y vaut zéro plutôt que d'en raccourcir le tracé.
  const monthKeys = [
    ...new Set(platforms.flatMap((entry) => entry.points.map((point) => point.month))),
  ].sort();

  const rows: DeltaRow[] = monthKeys.map((month) => {
    const row: DeltaRow = { label: formatMonth(month) };
    for (const entry of platforms) {
      row[entry.platform] =
        entry.points.find((point) => point.month === month)?.delta ?? 0;
    }
    return row;
  });

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

      {/* Le mouvement net des douze mois, avant tout graphique : c'est la
          réponse à « est-ce que ça monte ? ». */}
      <div className="flex flex-wrap items-end gap-3">
        <p
          className={`text-[32px] font-bold leading-none tabular-nums ${
            shown.netDelta < 0 ? "text-danger" : ""
          }`}
        >
          {signedFormatter.format(shown.netDelta)}
        </p>
        <p className="text-sm text-muted">{t("subtitle", { months: rows.length })}</p>
      </div>

      <div className="mt-4">
        {rows.length > 0 ? (
          <PlatformDeltaChart rows={rows} series={series} />
        ) : (
          <p className="py-6 text-center text-sm text-muted">{t("empty")}</p>
        )}
      </div>

      <ul className="mt-2 space-y-3 border-t border-border pt-4">
        {platforms.map((entry, index) => (
          <li key={entry.platform} className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-start gap-2.5">
              <Image
                src={entry.logo}
                alt=""
                width={20}
                height={20}
                className="mt-0.5 h-5 w-5 shrink-0 rounded-md object-contain"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {/* La pastille reprend la couleur de la barre : la liste et le
                      graphique doivent se lire comme un seul objet. */}
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: DELTA_COLORS[index % DELTA_COLORS.length] }}
                  />
                  <span className="truncate">{entry.label}</span>
                </span>
                <span className="block truncate text-xs text-muted">
                  {t("platformScope", { location: locationName(entry.locationCode) })}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span
                className={`block text-sm font-semibold tabular-nums ${
                  entry.netDelta < 0 ? "text-danger" : ""
                }`}
              >
                {signedFormatter.format(entry.netDelta)}
              </span>
              <span className="block text-xs text-muted tabular-nums">
                {t("searchVolume", {
                  value: signedFormatter.format(entry.netSearchVolume),
                })}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-ash">
        {isDemo
          ? t("demoNote")
          : `${t("source")} ${t("measuredOn", { date: formatDay(shown.fetchedAt) })}${
              shown.nextRefreshAt
                ? ` ${t("nextRefresh", { date: formatDay(shown.nextRefreshAt) })}`
                : ""
            }`}
      </p>
    </Card>
  );
}

/**
 * Le signe toujours écrit, plus comme moins.
 *
 * Ces chiffres sont des écarts, pas des totaux : « 18 » sans signe se lirait
 * comme un nombre de mentions, alors qu'il dit « dix-huit de plus qu'avant ».
 */
const signedFormatter = new Intl.NumberFormat("fr-FR", {
  signDisplay: "exceptZero",
});

/**
 * Le pays d'une série, écrit sous le nom du modèle.
 *
 * ChatGPT n'est historisé qu'aux États-Unis : sa ligne porte donc une
 * localisation différente de celle du commerce, et le taire ferait passer pour
 * une mesure locale un chiffre qui ne l'est pas.
 */
const LOCATION_NAMES: Record<number, string> = {
  2250: "France",
  2056: "Belgique",
  2756: "Suisse",
  2124: "Canada",
  2442: "Luxembourg",
  2840: "États-Unis",
  2826: "Royaume-Uni",
  2724: "Espagne",
  2380: "Italie",
  2276: "Allemagne",
};

function locationName(code: number): string {
  return LOCATION_NAMES[code] ?? `localisation ${code}`;
}

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
