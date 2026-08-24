"use client";

import { useTranslations } from "next-intl";
import type { OnPageCheck } from "@/lib/geo/types";

/**
 * Un élément on-page réel du site, présenté comme une carte : le texte tel qu'il
 * est écrit, les critères attendus, puis le conseil.
 *
 * Le rapport d'analyse l'emploie pour les quatre éléments de la page d'accueil.
 * Le tableau de bord ne s'en sert que pour le H1 et la première phrase : la
 * balise title et la meta description y sont montrées en résultat Google, forme
 * sous laquelle le client les reconnaît, et une carte de plus n'ajouterait rien.
 */

const ON_PAGE_STATUS_COLOR: Record<OnPageCheck["status"], string> = {
  ok: "#11b48c",
  warn: "#f59e0b",
  ko: "#e5484d",
};

export function OnPageElement({ label, check }: { label: string; check: OnPageCheck }) {
  const t = useTranslations("analysisReport.content.onPage");
  const color = ON_PAGE_STATUS_COLOR[check.status];

  return (
    <div className="flex flex-col rounded-2xl border border-fog bg-mist p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-steel">{label}</span>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      </div>

      {check.text ? (
        <p className="mt-2 text-sm leading-relaxed text-text">{check.text}</p>
      ) : (
        <p className="mt-2 text-sm italic text-muted">{t("empty")}</p>
      )}

      {check.signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {check.signals.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={
                s.present
                  ? { background: "rgba(17,180,140,0.15)", color: "#0a8f6e" }
                  : { background: "rgba(229,72,77,0.12)", color: "#c2363b" }
              }
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                {s.present ? (
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                )}
              </svg>
              {s.label}
            </span>
          ))}
        </div>
      )}

      {check.note && <p className="mt-2 text-xs leading-relaxed text-muted">{check.note}</p>}
    </div>
  );
}

/** Horaires d'ouverture extraits du site (ou état vide explicite). */
export function OpeningHoursBlock({ value }: { value: string | null }) {
  const t = useTranslations("analysisReport.content.onPage");
  return (
    <div className="mt-3 flex items-start gap-3 rounded-2xl border border-fog bg-snow p-4">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mist text-accent">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 7.5V12l3 2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">
          {t("openingHoursTitle")}
        </p>
        {value ? (
          <p className="mt-1 text-sm text-text">{value}</p>
        ) : (
          <p className="mt-1 text-sm italic text-muted">{t("openingHoursEmpty")}</p>
        )}
      </div>
    </div>
  );
}
