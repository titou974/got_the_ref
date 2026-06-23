import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { hydrateAnalysisResult } from "@/lib/geo/hydrate";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Dashboard } from "@/components/dashboard/Dashboard";

type Props = { params: Promise<{ id: string }> };

async function loadAnalysis(id: string): Promise<GeoAnalysisResult | null> {
  const record = await prisma.analysis.findUnique({ where: { id } });
  if (!record) return null;
  try {
    return hydrateAnalysisResult(JSON.parse(record.data) as GeoAnalysisResult);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await loadAnalysis(id);
  if (!result) return { title: "Analyse introuvable" };
  return {
    title: `Analyse GEO de ${result.domain} — Score ${result.overallScore}/100`,
    description: result.verdict,
  };
}

export default async function AnalysePage({ params }: Props) {
  const { id } = await params;
  const result = await loadAnalysis(id);
  if (!result) notFound();

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <Nav />
      <div className="flex-1">
        <Dashboard result={result} />
      </div>
      <Footer />
    </main>
  );
}
