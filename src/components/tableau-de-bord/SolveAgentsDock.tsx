import { getTranslations } from "next-intl/server";
import type { AnalysisDiagnostic } from "@/lib/geo/diagnostic";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { SolveAgentsBar } from "@/components/dashboard/SolveAgentsBar";

/**
 * La barre « résoudre avec les agents IA » de l'accueil du tableau de bord.
 *
 * Elle n'écrit plus rien. Auparavant elle rédigeait, à chaque affichage de la
 * page, le prompt de correction des six sections — deux à trois secondes
 * d'appel au modèle, derrière une frontière `Suspense`, pour un texte que le
 * client copiait ensuite à la main. L'exécution passe désormais par le serveur
 * MCP : l'agent va chercher lui-même les correctifs, et la barre n'a plus qu'à
 * ouvrir la modale de rattachement.
 */
export async function SolveAgentsDock({
  result,
  diagnostic,
  locked = false,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  /**
   * Compte gratuit : la barre et la modale s'affichent à l'identique. Ce qui
   * change est ce que l'agent recevra une fois connecté — le serveur ne lui
   * sert que les chantiers ouverts par l'offre.
   */
  locked?: boolean;
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

  return (
    <>
      {/* La barre flotte au-dessus du bas de l'écran : sans cette réserve, elle
          recouvrirait la dernière carte de la page une fois défilée. La hauteur
          suit son décalage — pilule comprise, elle occupe environ 140 px sur
          téléphone, où elle est remontée pour dégager la bulle de discussion. */}
      <div className="h-40 sm:h-24" aria-hidden />
      <SolveAgentsBar
        domain={result.domain}
        stack={result.signals.stack ?? null}
        issues={issueKeys.map((key) => t(key))}
        locked={locked}
      />
    </>
  );
}
