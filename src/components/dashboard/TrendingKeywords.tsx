"use client";

import { useTranslations } from "next-intl";
import type { KeywordPlacement, TrendingKeywordsInsight } from "@/lib/geo/types";
import { AnimatedCard } from "./AnimatedCard";
import { LockedPill, Obscured, UnlockBar } from "./LockedContent";

/**
 * Mots-clés tendances de la niche, et où les écrire : balise title, meta
 * description, H1. La section garde sa structure quand elle est verrouillée —
 * on voit qu'il y a des mots-clés et trois réécritures prêtes — seul leur
 * contenu se floute.
 */

const TREND_COLOR: Record<TrendingKeywordsInsight["keywords"][number]["trend"], string> = {
  montant: "#11b48c",
  émergent: "#f59e0b",
  stable: "#71717a",
};

function PlacementBadges({ placements }: { placements: KeywordPlacement[] }) {
  const t = useTranslations("analysisReport.keywords.placements");
  return (
    <span className="flex flex-wrap gap-1">
      {placements.map((p) => (
        <span
          key={p}
          className="rounded-md bg-obsidian/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-graphite"
        >
          {t(p)}
        </span>
      ))}
    </span>
  );
}

/** Une réécriture proposée : l'élément on-page, l'actuel, puis le remplaçant. */
function Rewrite({
  label,
  current,
  suggested,
}: {
  label: string;
  current: string | null;
  suggested: string;
}) {
  const t = useTranslations("analysisReport.keywords");
  return (
    <div className="rounded-2xl border border-fog bg-mist p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-steel">{label}</p>
      <p className="mt-2 text-xs text-muted">
        {t("currentLabel")} :{" "}
        {current ? (
          <span className="text-text">{current}</span>
        ) : (
          <span className="italic">{t("currentEmpty")}</span>
        )}
      </p>
      <p className="mt-2 rounded-xl border border-pebble/60 bg-snow p-3 text-sm leading-relaxed text-text">
        {suggested}
      </p>
      <p className="mt-1.5 text-right text-[11px] tabular-nums text-steel">
        {t("charCount", { count: suggested.length })}
      </p>
    </div>
  );
}

export function TrendingKeywords({
  insight,
  current,
  locked,
}: {
  insight: TrendingKeywordsInsight;
  /** Valeurs on-page réellement en place, pour la comparaison. */
  current: { title: string | null; metaDescription: string | null; h1: string | null };
  locked: boolean;
}) {
  const t = useTranslations("analysisReport.keywords");

  const body = (
    <div className="space-y-4">
      <AnimatedCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">{t("listTitle")}</h4>
          <span className="rounded-full bg-mist px-2.5 py-0.5 text-[11px] font-medium text-steel">
            {insight.measured ? t("sourceMeasured") : t("sourceEstimated")} · {insight.period}
          </span>
        </div>
        <ul className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {insight.keywords.map((k) => (
            <li
              key={k.keyword}
              className="flex items-start justify-between gap-3 border-b border-fog py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{k.keyword}</p>
                <p className="mt-0.5 text-xs text-muted">{k.intent}</p>
                <div className="mt-1.5">
                  <PlacementBadges placements={k.placements} />
                </div>
              </div>
              <span
                className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: `${TREND_COLOR[k.trend]}1f`, color: TREND_COLOR[k.trend] }}
              >
                {k.trend}
              </span>
            </li>
          ))}
        </ul>
      </AnimatedCard>

      <AnimatedCard delay={0.05}>
        <h4 className="font-semibold">{t("rewritesTitle")}</h4>
        <p className="mt-1 text-sm text-muted">{t("rewritesSubtitle")}</p>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Rewrite label={t("elements.title")} current={current.title} suggested={insight.suggested.title} />
          <Rewrite
            label={t("elements.metaDescription")}
            current={current.metaDescription}
            suggested={insight.suggested.metaDescription}
          />
          <Rewrite label={t("elements.h1")} current={current.h1} suggested={insight.suggested.h1} />
        </div>
        {insight.notes.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-fog pt-4">
            {insight.notes.map((n, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-pebble" aria-hidden />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        )}
      </AnimatedCard>
    </div>
  );

  return (
    <section>
      <div className="mb-3 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="text-lg font-bold">{t("title")}</h3>
        {locked && <LockedPill />}
      </div>
      <p className="mb-4 max-w-2xl text-sm text-muted">{t("subtitle")}</p>

      {locked ? (
        <>
          <div className="relative isolate">
            <Obscured>{body}</Obscured>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-bg"
            />
          </div>
          <UnlockBar variant="keywords" />
        </>
      ) : (
        body
      )}
    </section>
  );
}
