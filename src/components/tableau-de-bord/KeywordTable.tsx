import { getTranslations } from "next-intl/server";
import type { TrendingKeywordsInsight } from "@/lib/geo/types";
import { Badge } from "@/components/tremor/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/tremor/Table";
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
 *
 * Les remarques qui suivaient le tableau ont disparu : elles répétaient en
 * prose ce que les colonnes disent déjà, et poussaient la suite de la page d'un
 * écran.
 */

/**
 * La dynamique d'un terme, en pastille.
 *
 * « En hausse » est la seule vraie bonne nouvelle, donc la seule en vert.
 * « Émergent » signale un pari, pas un acquis : il reste neutre plutôt que de
 * se peindre en avertissement, qui se lirait comme un défaut.
 */
const TREND_VARIANT: Record<
  TrendingKeywordsInsight["keywords"][number]["trend"],
  "success" | "default" | "neutral"
> = {
  montant: "success",
  émergent: "default",
  stable: "neutral",
};

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

      {/* Les marges négatives rendent au tableau la largeur que la carte lui
          prend : ses cellules portent déjà leur propre gouttière. */}
      <TableRoot className="-mx-5 w-[calc(100%+2.5rem)] sm:-mx-6 sm:w-[calc(100%+3rem)]">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t("columns.keyword")}</TableHeaderCell>
              <TableHeaderCell>{t("columns.intent")}</TableHeaderCell>
              <TableHeaderCell>{t("columns.trend")}</TableHeaderCell>
              <TableHeaderCell>{t("columns.placements")}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {insight.keywords.map((keyword) => (
              <TableRow key={keyword.keyword}>
                <TableCell className="font-medium text-ink">{keyword.keyword}</TableCell>
                <TableCell>{keyword.intent}</TableCell>
                <TableCell>
                  <Badge variant={TREND_VARIANT[keyword.trend]}>{t(`trend.${keyword.trend}`)}</Badge>
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    {keyword.placements.map((placement) => (
                      <Badge key={placement} variant="neutral">
                        {t(`placements.${placement}`)}
                      </Badge>
                    ))}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>
    </Card>
  );
}
