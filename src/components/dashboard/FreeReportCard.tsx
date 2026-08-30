import { getTranslations } from "next-intl/server";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import type { AnalysisDiagnostic } from "@/lib/geo/diagnostic";
import { buildFreeReport, pickVariant } from "@/lib/geo/free-report";
import { parseSegments } from "@/lib/rich-text";
import { ROUTES } from "@/constants/routes";
import { AiOverview, type OverviewBlock } from "./AiOverview";

/**
 * Le constat livré d'office sur une analyse gratuite : ce qui tient, ce qui
 * manque, et surtout ce qui n'a pas encore été mesuré — la part qui porte le
 * gain de classement sur les IA et Google. La formulation change d'un rapport à
 * l'autre (graine déterministe), le fond reste factuel.
 *
 * La mise en forme reprend celle d'un aperçu IA — en-tête signé, passages
 * surlignés, amorces de puces en gras, pastilles de source — et le texte
 * s'écrit à la frappe, comme si l'agent le rédigeait. Ce composant reste côté
 * serveur : il assemble les blocs, `AiOverview` les anime.
 */
export async function FreeReportCard({
  result,
  diagnostic,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
}) {
  const t = await getTranslations("freeReport");
  const ta = await getTranslations("analysisReport.architecture.checks");
  const facts = buildFreeReport(result, diagnostic);

  const pool = (key: string) => t.raw(key) as string[];
  const variant = <T,>(items: readonly T[], offset: number) =>
    pickVariant(items, facts.seed, offset);

  const headline = variant(pool("headlines"), 1).replace("{domain}", result.domain);
  const intro = variant(pool("intros"), 2).replace("{score}", String(facts.score));
  const closing = variant(pool("closings"), 3);
  const cta = variant(pool("ctas"), 4);

  const blocks: OverviewBlock[] = [
    { kind: "paragraph", segments: parseSegments(intro) },
    {
      kind: "chip",
      text: t("sourceChip", { count: diagnostic.architecture.checks.length }),
    },
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

  blocks.push({ kind: "heading", text: t("unmeasuredTitle") });
  facts.unmeasured.forEach((angle, i) => {
    // Amorce en gras + explication, comme les puces d'un aperçu IA.
    const label = t(`angleLabels.${angle}`);
    const body = variant(pool(`unmeasured.${angle}`), 10 + i);
    blocks.push({
      kind: "bullet",
      icon: "dot",
      segments: parseSegments(`**${label}** : ${body}`),
    });
  });

  blocks.push({ kind: "paragraph", segments: parseSegments(closing) });

  return (
    <AiOverview headline={headline} blocks={blocks} cta={cta} ctaHref={ROUTES.pricing} />
  );
}
