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
import { ensurePaidAnalysis } from "@/features/analysis/service";

type Props = { params: Promise<{ id: string }> };

type LoadedAnalysis = {
  result: GeoAnalysisResult;
  unlocked: boolean;
  userId: string | null;
  ownerPlan: string | null;
};

async function loadAnalysis(id: string): Promise<LoadedAnalysis | null> {
  // L'offre du propriétaire décide de la lecture publique du rapport : elle est
  // chargée avec l'analyse pour éviter une seconde requête.
  const record = await prisma.analysis.findUnique({
    where: { id },
    include: { user: { select: { plan: true } } },
  });
  if (!record) return null;
  try {
    return {
      result: hydrateAnalysisResult(JSON.parse(record.data) as GeoAnalysisResult),
      unlocked: record.unlocked,
      userId: record.userId,
      ownerPlan: record.user?.plan ?? null,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const analysis = await loadAnalysis(id);
  // Rapport propre à un visiteur : jamais indexé, quel que soit son état.
  const robots = { index: false, follow: false } as const;
  if (!analysis) return { title: "Analyse introuvable", robots };
  const { result } = analysis;
  return {
    title: `Analyse GEO de ${result.domain} : score ${result.overallScore}/100`,
    description: result.verdict,
    robots,
  };
}

export default async function AnalysePage({ params }: Props) {
  const { id } = await params;
  let analysis = await loadAnalysis(id);
  if (!analysis) notFound();

  // L'aperçu est gratuit ; le rapport complet s'ouvre après paiement de cette
  // analyse, pour un compte dont l'offre le couvre, ou pour tout visiteur si
  // l'analyse vient d'un compte abonné (rapport partageable).
  const user = await getCurrentUser();
  const locked = !isReportUnlocked(analysis, user);

  // Débloqué mais l'audit complet (Claude + moteurs live) n'a encore jamais
  // tourné pour cette analyse (paiement reçu sans passer par /paiement/succes) :
  // on le lance maintenant, une seule fois.
  if (!locked) {
    await ensurePaidAnalysis(id);
    analysis = await loadAnalysis(id);
    if (!analysis) notFound();
  }

  return (
    // Rapport ouvert : la barre d'action flotte au-dessus du bas de page — on
    // lui réserve sa hauteur pour qu'elle ne recouvre jamais le pied de page.
    <main className={`flex min-h-[100dvh] flex-col ${locked ? "" : "pb-24 sm:pb-28"}`}>
      <Nav minimal />
      <div className="flex-1">
        <Dashboard result={analysis.result} analysisId={id} locked={locked} />
      </div>
      <Footer />
    </main>
  );
}
