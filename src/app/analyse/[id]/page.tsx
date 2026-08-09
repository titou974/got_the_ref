import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { hydrateAnalysisResult } from "@/lib/geo/hydrate";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { getCurrentUser } from "@/lib/auth";
import { isReportUnlocked } from "@/features/analysis/access";

type Props = { params: Promise<{ id: string }> };

type LoadedAnalysis = {
  result: GeoAnalysisResult;
  unlocked: boolean;
  userId: string | null;
};

async function loadAnalysis(id: string): Promise<LoadedAnalysis | null> {
  const record = await prisma.analysis.findUnique({ where: { id } });
  if (!record) return null;
  try {
    return {
      result: hydrateAnalysisResult(JSON.parse(record.data) as GeoAnalysisResult),
      unlocked: record.unlocked,
      userId: record.userId,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const analysis = await loadAnalysis(id);
  if (!analysis) return { title: "Analyse introuvable" };
  const { result } = analysis;
  return {
    title: `Analyse GEO de ${result.domain} — Score ${result.overallScore}/100`,
    description: result.verdict,
  };
}

export default async function AnalysePage({ params }: Props) {
  const { id } = await params;
  const analysis = await loadAnalysis(id);
  if (!analysis) notFound();

  // L'aperçu est gratuit ; le rapport complet s'ouvre après paiement de cette
  // analyse, ou pour un compte dont l'offre le couvre.
  const user = await getCurrentUser();
  const locked = !isReportUnlocked(analysis, user);

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Nav />
      <div className="flex-1">
        <Dashboard result={analysis.result} analysisId={id} locked={locked} />
      </div>
      <Footer />
    </main>
  );
}
