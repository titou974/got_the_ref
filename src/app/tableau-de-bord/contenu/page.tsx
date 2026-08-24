import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getDashboardContext } from "@/features/dashboard/queries";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { buildSolutionPrompt } from "@/lib/geo/solution-prompts";
import { connectorForStack } from "@/constants/site-platforms";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { ConnectStrip } from "@/components/tableau-de-bord/ConnectStrip";
import { ContentCompare } from "@/components/tableau-de-bord/ContentCompare";
import { KeywordTable } from "@/components/tableau-de-bord/KeywordTable";
import { PromptCard } from "@/components/tableau-de-bord/PromptCard";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";

export const maxDuration = 300;

/**
 * Contenu : les mots-clés de la niche, puis ce que le site en dit aujourd'hui
 * face à ce qu'il pourrait en dire.
 */
export default async function ContenuPage() {
  const user = await requireUser();
  const context = await getDashboardContext(user.id);
  const t = await getTranslations("dashboard.content");

  if (!context.analysis) return <PreparingAnalysis />;

  const analysis = context.analysis;
  const diagnostic = buildDiagnostic(analysis);

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
        subtitle={context.domain ? t("pageSubtitle", { domain: context.domain }) : null}
      />

      <KeywordTable insight={analysis.trendingKeywords ?? null} />

      <ContentCompare
        current={{
          title: analysis.signals.title,
          metaDescription: analysis.signals.metaDescription,
          h1: analysis.signals.h1.find((heading) => heading.trim().length > 0) ?? null,
          firstParagraph: analysis.signals.firstParagraph,
          url: analysis.url,
          domain: analysis.domain,
        }}
        suggested={analysis.trendingKeywords?.suggested ?? null}
      />

      <ConnectStrip
        analyticsConnected={context.google.analytics}
        propertyName={context.google.propertyName}
        site={context.site}
        suggestedPlatform={connectorForStack(analysis.signals.stack?.id).id}
      />

      <PromptCard prompt={buildSolutionPrompt("content", analysis, diagnostic)} />
    </>
  );
}
