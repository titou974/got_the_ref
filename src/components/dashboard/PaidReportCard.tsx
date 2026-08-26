import { getTranslations } from "next-intl/server";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import type { AnalysisDiagnostic } from "@/lib/geo/diagnostic";
import { pickVariant } from "@/lib/geo/free-report";
import { buildPaidReport } from "@/lib/geo/paid-report";
import { parseSegments } from "@/lib/rich-text";
import { AiOverview, type OverviewBlock } from "./AiOverview";

/**
 * Constat du rapport complet, dans la même écriture « aperçu IA » que celui de
 * l'analyse gratuite : en-tête signé, passages surlignés, frappe progressive.
 *
 * Le fond diffère : l'aperçu gratuit argumente sur ce qu'il n'a pas mesuré,
 * celui-ci rend compte des relevés — position par moteur, note éditoriale,
 * plan d'action. Et il ne porte pas d'appel à l'action : il n'y a plus rien à
 * débloquer.
 *
 * Deux surfaces l'affichent, et pas avec le même contenu. Sur le rapport
 * d'analyse, le constat récapitule tout ce qui a été mesuré, notoriété et
 * mots-clés tendances compris : le lecteur découvre l'audit, il a besoin de
 * l'inventaire. Sur l'accueil du tableau de bord, ces deux angles ont leur
 * propre section dans la colonne de gauche, et les répéter en tête ferait du
 * constat un sommaire.
 */
export async function PaidReportCard({
  result,
  diagnostic,
  scope = "report",
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  /** `dashboard` : sans les lignes notoriété et mots-clés tendances. */
  scope?: "report" | "dashboard";
}) {
  const t = await getTranslations("paidReport");
  const ta = await getTranslations("analysisReport.architecture.checks");
  const facts = buildPaidReport(result, diagnostic);

  const pool = (key: string) => t.raw(key) as string[];
  const variant = <T,>(items: readonly T[], offset: number) =>
    pickVariant(items, facts.seed, offset);

  const headline = variant(pool("headlines"), 1).replace("{domain}", result.domain);
  const intro = variant(pool("intros"), 2).replace("{score}", String(facts.score));
  const closing = variant(pool("closings"), 3);

  const blocks: OverviewBlock[] = [
    { kind: "paragraph", segments: parseSegments(intro) },
    { kind: "chip", text: t("sourceChip", { count: facts.engines.length }) },
  ];

  if (facts.strengths.length > 0) {
    blocks.push({ kind: "heading", text: t("strengthsTitle") });
    for (const key of facts.strengths) {
      blocks.push({ kind: "bullet", icon: "check", segments: parseSegments(ta(key)) });
    }
  }

  if (facts.gaps.length > 0) {
    blocks.push({ kind: "heading", text: t("gapsTitle") });
    for (const key of facts.gaps) {
      blocks.push({ kind: "bullet", icon: "cross", segments: parseSegments(ta(key)) });
    }
  }

  // Ce que l'audit a établi. Chaque ligne porte un chiffre : c'est la différence
  // avec l'aperçu, où ces mêmes angles étaient annoncés comme non mesurés.
  blocks.push({ kind: "heading", text: t("measuredTitle") });

  const rankDetail = facts.engines
    .map((e) =>
      e.rank != null
        ? t("rankOn", { engine: e.engine, rank: e.rank })
        : t("notRankedOn", { engine: e.engine }),
    )
    .join(" · ");

  const lines: string[] = [];
  if (facts.engines.length > 0) {
    lines.push(t("measured.rankings", { detail: rankDetail }));
  }
  lines.push(t("measured.content", { score: facts.contentScore }));
  if (scope === "report") {
    lines.push(t("measured.presence", { score: facts.presenceScore }));
    if (facts.keywordCount > 0) {
      lines.push(t("measured.keywords", { count: facts.keywordCount }));
    }
  }
  if (facts.recommendationCount > 0) {
    lines.push(
      facts.topRecommendation
        ? t("measured.recommendationsWithTop", {
            count: facts.recommendationCount,
            top: facts.topRecommendation,
          })
        : t("measured.recommendations", { count: facts.recommendationCount }),
    );
  }
  if (facts.mapsScore != null) {
    lines.push(t("measured.maps", { score: facts.mapsScore }));
  }

  for (const line of lines) {
    blocks.push({ kind: "bullet", icon: "dot", segments: parseSegments(line) });
  }

  blocks.push({ kind: "paragraph", segments: parseSegments(closing) });

  return <AiOverview headline={headline} blocks={blocks} />;
}
