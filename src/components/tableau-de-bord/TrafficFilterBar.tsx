"use client";

import { useTranslations } from "next-intl";
import { cx } from "@/lib/utils";
import { SiteFavicon } from "./SiteFavicon";

/**
 * La barre de filtres posée au-dessus de la courbe de trafic.
 *
 * Reprise de la « filterbar » de Tremor, avec une substitution : le sélecteur de
 * projet du bloc d'origine n'a pas d'équivalent ici — un compte suit un site, et
 * un seul. Sa place revient donc au site lui-même, favicon en tête, pour que la
 * courbe dise de quel domaine elle parle sans qu'on ait à remonter en haut de
 * page. Ce n'est pas un menu déroulant : rien à choisir, donc pas de chevron qui
 * promettrait une liste.
 *
 * À droite, les périodes, en boutons collés comme dans le bloc Tremor.
 */

export const TRAFFIC_PERIODS = [7, 14, 30] as const;

export type TrafficPeriod = (typeof TRAFFIC_PERIODS)[number];

export function TrafficFilterBar({
  domain,
  period,
  onPeriodChange,
}: {
  domain: string | null;
  period: TrafficPeriod;
  onPeriodChange: (days: TrafficPeriod) => void;
}) {
  const t = useTranslations("dashboard.traffic");

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      {domain ? <SiteChip domain={domain} /> : <span />}

      <div
        role="group"
        aria-label={t("periodFilter")}
        className="inline-flex items-center rounded-xl border border-border bg-surface text-sm font-medium"
      >
        {TRAFFIC_PERIODS.map((days, index) => (
          <button
            key={days}
            type="button"
            aria-pressed={days === period}
            onClick={() => onPeriodChange(days)}
            className={cx(
              "cursor-pointer px-3.5 py-1.5 transition-colors duration-150",
              index === 0 ? "rounded-l-xl" : "border-l border-border",
              index === TRAFFIC_PERIODS.length - 1 ? "rounded-r-xl" : "",
              days === period
                ? "bg-obsidian text-white"
                : "text-graphite hover:bg-mist hover:text-obsidian",
            )}
          >
            {t("periodShort", { days })}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Le site, favicon à gauche — ce que le sélecteur de projet remplace. */
function SiteChip({ domain }: { domain: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium">
      <SiteFavicon domain={domain} />
      <span className="truncate">{domain}</span>
    </span>
  );
}
