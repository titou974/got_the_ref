"use client";

import { useTranslations } from "next-intl";
import { CATEGORY_META, type Recommendation } from "@/lib/geo/types";
import { priorityColor } from "@/lib/score";
import { AnimatedCard } from "@/components/dashboard/AnimatedCard";

/**
 * Le plan d'action, une carte par correctif.
 *
 * L'ordre vient de l'audit : le plus rentable d'abord, pas le plus facile. La
 * priorité et l'impact restent affichés côte à côte, sinon « critique » se lit
 * comme un cri et non comme un rang.
 */
export function Recommendations({
  recommendations,
  emptyLabel,
}: {
  recommendations: Recommendation[];
  emptyLabel: string;
}) {
  const t = useTranslations("analysisReport.results");

  if (!recommendations.length) {
    return (
      <AnimatedCard>
        <p className="text-sm text-muted">{emptyLabel}</p>
      </AnimatedCard>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((r, i) => (
        <AnimatedCard
          key={`${r.title}-${i}`}
          delay={i * 0.03}
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <span
            className="inline-flex h-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
            style={{ background: `${priorityColor(r.priority)}22`, color: priorityColor(r.priority) }}
          >
            {r.priority}
          </span>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <h4 className="font-semibold">{r.title}</h4>
              <span className="shrink-0 text-xs text-muted">
                {t("impact", { value: r.impact })}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{r.description}</p>
            <span className="mt-2 inline-block text-xs text-steel">
              {CATEGORY_META[r.category].label}
            </span>
          </div>
        </AnimatedCard>
      ))}
    </div>
  );
}
