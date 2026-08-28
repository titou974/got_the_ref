import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getDashboardContext } from "@/features/dashboard/queries";
import { PageHeader } from "@/components/tableau-de-bord/Card";
import { ContentCompare } from "@/components/tableau-de-bord/ContentCompare";
import { PreparingAnalysis } from "@/components/tableau-de-bord/PreparingAnalysis";

export const maxDuration = 300;

/**
 * Contenu : la balise title et la meta description, avant et après.
 *
 * Un seul objet sur la page. Le tableau des mots-clés et l'audit du H1 et de la
 * première phrase sont retirés : ils doublaient le rapport d'analyse et
 * repoussaient la comparaison, qui est ce que le client vient voir. Ce qu'il
 * reste des mots-clés tient en badges sous le diptyque — ceux réellement placés
 * dans la réécriture — et le niveau estimé dit où en est chaque version.
 */
export default async function ContenuPage() {
  const user = await requireUser();
  const context = await getDashboardContext(user.id);
  const t = await getTranslations("dashboard.content");

  if (!context.analysis) return <PreparingAnalysis />;

  const analysis = context.analysis;

  return (
    <>
      <PageHeader title={t("pageTitle")} />

      <ContentCompare
        current={{
          title: analysis.signals.title,
          metaDescription: analysis.signals.metaDescription,
          url: analysis.url,
          domain: analysis.domain,
        }}
        insight={analysis.trendingKeywords ?? null}
      />
    </>
  );
}
