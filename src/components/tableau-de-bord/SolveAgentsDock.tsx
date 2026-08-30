import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { writeSolutionPrompt } from "@/features/dashboard/solution-prompt";
import type { ArticleFact } from "@/lib/geo/solution-facts";
import type { AnalysisDiagnostic } from "@/lib/geo/diagnostic";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { SolveAgentsBar } from "@/components/dashboard/SolveAgentsBar";

/**
 * La barre « résoudre avec les agents IA » de l'accueil du tableau de bord.
 *
 * C'est la même barre que celle du rapport d'analyse, à une différence près :
 * le prompt qu'elle porte ne couvre pas une section mais les six. Le client
 * n'a plus à passer d'onglet en onglet pour ramasser ses correctifs — il copie
 * une fois, son agent applique tout.
 *
 * L'écriture du prompt prend deux à trois secondes. Derrière une frontière
 * `Suspense` sans repli : la page s'affiche entière tout de suite, la barre
 * arrive après. Un repli qui montrerait la barre avec un prompt provisoire
 * fermerait la modale au moment de la bascule, en pleine lecture.
 */
export function SolveAgentsDock({
  result,
  diagnostic,
  articles,
  locked = false,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  /** Le planning éditorial : les articles rédigés partent dans le prompt. */
  articles: ArticleFact[];
  /**
   * Compte gratuit : la barre s'affiche et la modale s'ouvre, mais le
   * rattachement du site et le prompt passent sous voile. Le prompt n'est alors
   * pas écrit du tout — c'est un appel au modèle de deux à trois secondes, et
   * un texte qui n'atteint pas le navigateur ne se copie pas.
   */
  locked?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <Dock result={result} diagnostic={diagnostic} articles={articles} locked={locked} />
    </Suspense>
  );
}

async function Dock({
  result,
  diagnostic,
  articles,
  locked,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  articles: ArticleFact[];
  locked: boolean;
}) {
  const t = await getTranslations("analysisReport");

  // Manques réellement relevés : la barre en annonce le nombre, la modale les
  // rejoue. Faute de manque, on montre les premiers contrôles d'architecture —
  // ce sont ceux que les agents tiennent à jour.
  const failing = [
    ...diagnostic.architecture.checks
      .filter((c) => c.status === "ko" || c.status === "warn")
      .map((c) => `architecture.checks.${c.key}`),
    ...diagnostic.content.checks
      .filter((c) => c.status === "ko" || c.status === "warn")
      .map((c) => `content.checks.${c.key}`),
  ];
  const issueKeys = (
    failing.length
      ? failing
      : diagnostic.architecture.checks.map((c) => `architecture.checks.${c.key}`)
  ).slice(0, 3);

  const solutionPrompt = locked
    ? ""
    : await writeSolutionPrompt({
        tab: "all",
        result,
        diagnostic,
        articles,
      });

  return (
    <>
      {/* La barre est fixée au bas de l'écran : sans cette réserve, elle
          recouvrirait la dernière carte de la page une fois défilée. */}
      <div className="h-20 sm:h-16" aria-hidden />
      <SolveAgentsBar
        domain={result.domain}
        stack={result.signals.stack ?? null}
        issues={issueKeys.map((key) => t(key))}
        solutionPrompt={solutionPrompt}
        scope="dashboard"
        locked={locked}
      />
    </>
  );
}
