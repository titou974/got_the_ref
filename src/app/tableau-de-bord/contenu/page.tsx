import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getDashboardContext } from "@/features/dashboard/queries";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { buildSolutionPrompt } from "@/lib/geo/solution-prompts";
import { connectorForStack } from "@/constants/site-platforms";
import { Card, CardTitle, PageHeader } from "@/components/tableau-de-bord/Card";
import { ConnectStrip } from "@/components/tableau-de-bord/ConnectStrip";
import { ContentCompare } from "@/components/tableau-de-bord/ContentCompare";
import { KeywordTable } from "@/components/tableau-de-bord/KeywordTable";
import { PromptCard } from "@/components/tableau-de-bord/PromptCard";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";
import { OnPageElement, OpeningHoursBlock } from "@/components/geo/OnPageElement";

export const maxDuration = 300;

/**
 * Contenu : les mots-clés de la niche, puis ce que le site en dit aujourd'hui
 * face à ce qu'il pourrait en dire.
 *
 * La balise title et la meta description restent présentées en résultat Google,
 * forme sous laquelle le client les a déjà vues passer. Le H1 et le premier
 * paragraphe, eux, reprennent les cartes du rapport d'analyse : elles montrent
 * le texte réel, les critères attendus un par un, et le conseil qui va avec —
 * ce qu'une ligne de définition ne dirait pas.
 */
export default async function ContenuPage() {
  const user = await requireUser();
  const context = await getDashboardContext(user.id);
  const t = await getTranslations("dashboard.content");
  const ta = await getTranslations("analysisReport.content.onPage");

  if (!context.analysis) return <PreparingAnalysis />;

  const analysis = context.analysis;
  const diagnostic = buildDiagnostic(analysis);
  const onPage = analysis.onPageContent;

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
          url: analysis.url,
          domain: analysis.domain,
        }}
        suggested={analysis.trendingKeywords?.suggested ?? null}
      />

      <Card>
        <CardTitle title={ta("title")} hint={ta("subtitle")} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OnPageElement label={ta("elements.h1")} check={onPage.h1} />
          <OnPageElement label={ta("elements.firstSentence")} check={onPage.firstSentence} />
        </div>
        <OpeningHoursBlock value={onPage.openingHours} />
      </Card>

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
