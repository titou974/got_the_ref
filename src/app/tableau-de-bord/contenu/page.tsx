import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getDashboardContext, getOnPageRewriteQuota } from "@/features/dashboard/queries";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { ContentCompare } from "@/components/tableau-de-bord/ContentCompare";
import { KeywordTable } from "@/components/tableau-de-bord/KeywordTable";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";

export const maxDuration = 300;

/**
 * Contenu : les mots-clés de la niche, puis les trois endroits où ils
 * s'écrivent — la balise title et la meta description, le H1, le paragraphe
 * d'introduction. Chacun montre l'existant et la réécriture côte à côte, et
 * rien d'autre que les mots-clés effectivement placés.
 */
export default async function ContenuPage() {
  const user = await requireUser();
  const [context, quota, t] = await Promise.all([
    getDashboardContext(user.id),
    getOnPageRewriteQuota(user.id),
    getTranslations("dashboard.content"),
  ]);

  if (!context.analysis) return <PreparingAnalysis />;

  const analysis = context.analysis;

  return (
    <>
      <PageHeader title={t("pageTitle")} />

      <KeywordTable insight={analysis.trendingKeywords ?? null} />

      <ContentCompare
        current={{
          title: analysis.signals.title,
          metaDescription: analysis.signals.metaDescription,
          h1: analysis.signals.h1[0] ?? null,
          intro: analysis.signals.firstParagraph,
          url: analysis.url,
          domain: analysis.domain,
        }}
        insight={analysis.trendingKeywords ?? null}
        quota={quota}
      />
    </>
  );
}
