import { getTranslations } from "next-intl/server";
import type { TrendingKeywordsInsight } from "@/lib/geo/types";
import { Card, CardTitle } from "./Card";

/**
 * Les mots-clés tendances de la niche, relevés par Gemini avec recherche Google.
 *
 * La colonne « emplacements » dit où chaque terme compte : la balise title, la
 * meta description, le H1. Un mot-clé sans emplacement n'est qu'une idée.
 *
 * Quand la recherche n'a pas tourné (`measured` faux), la source est annoncée :
 * une liste déduite du site vaut moins qu'une liste tirée des requêtes réelles,
 * et le client doit savoir laquelle il lit.
 */
export async function KeywordTable({ insight }: { insight: TrendingKeywordsInsight | null }) {
  const t = await getTranslations("dashboard.keywords");

  if (!insight || insight.keywords.length === 0) {
    return (
      <Card>
        <CardTitle title={t("title")} />
        <p className="rounded-2xl bg-mist px-4 py-8 text-center text-sm text-muted">{t("empty")}</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle
        title={t("title")}
        hint={
          insight.measured
            ? t("hintMeasured", { period: insight.period })
            : t("hintEstimated", { period: insight.period })
        }
      />

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-steel">
              <th className="py-2 font-medium">{t("columns.keyword")}</th>
              <th className="py-2 font-medium">{t("columns.intent")}</th>
              <th className="py-2 font-medium">{t("columns.trend")}</th>
              <th className="py-2 font-medium">{t("columns.placements")}</th>
            </tr>
          </thead>
          <tbody>
            {insight.keywords.map((keyword) => (
              <tr key={keyword.keyword} className="border-b border-border last:border-0">
                <td className="py-3 pr-3 font-medium">{keyword.keyword}</td>
                <td className="py-3 pr-3 text-muted">{keyword.intent}</td>
                <td className="py-3 pr-3">
                  <span className="rounded-xl bg-mist px-2 py-0.5 text-[11px] font-medium text-steel">
                    {t(`trend.${keyword.trend}`)}
                  </span>
                </td>
                <td className="py-3">
                  <span className="flex flex-wrap gap-1">
                    {keyword.placements.map((placement) => (
                      <span
                        key={placement}
                        className="rounded-xl border border-border px-2 py-0.5 text-[11px] text-steel"
                      >
                        {t(`placements.${placement}`)}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {insight.notes.length ? (
        <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
          {insight.notes.map((note) => (
            <li key={note} className="flex gap-2 text-sm text-muted">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-pebble" />
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
